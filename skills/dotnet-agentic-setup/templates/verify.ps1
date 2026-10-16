#Requires -Version 7
<#
  Single entry point for build/test. Used by humans, Claude Code, hooks and CI.
    -Mode build               incremental build, errors only
    -Mode warnings [-OutFile f] full (non-incremental) build, lists all compiler/analyzer warnings
                              plus errors; -OutFile also writes every unique warning line to f;
                              exits 0 when the build succeeds, even with warnings
    -Mode test [-Filter x]    build + tests (optional filter), failures only
    -Mode gate                build + gate test set (used by the SubagentStop hook)
  -Target a,b: projects/solutions (file or folder, relative to repo root) to build/test
               instead of the config's "targets". Each target is built separately, in order;
               MSBuild builds referenced projects on its own, so list only the top-level ones.
  -FromHook: read hook JSON from stdin, report failures on stderr with exit code 2.
#>
param(
  [ValidateSet('build','warnings','test','gate')] [string]$Mode = 'build',
  [string]$Filter,
  [string[]]$Target,
  [string]$OutFile,
  [switch]$FromHook
)

# --- hook input (cwd, session/agent id) ----------------------------------
$hookInput = $null
if ($FromHook) {
  $raw = [Console]::In.ReadToEnd()
  if ($raw) { $hookInput = $raw | ConvertFrom-Json }
}

# Emscripten's bundled Node (SPA wasm relink) rejects newer flags such as --use-system-ca,
# which Claude Code's settings env injects. Scoped to this process only.
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue

$root = if ($hookInput -and $hookInput.cwd) { $hookInput.cwd } else { Split-Path $PSScriptRoot -Parent }
Set-Location $root
$cfg = Get-Content (Join-Path $root 'eng/verify.config.json') -Raw | ConvertFrom-Json
$max = if ($cfg.maxOutputLines) { [int]$cfg.maxOutputLines } else { 60 }

# --- loop guard: never block the same agent forever ----------------------
$stateDir = Join-Path $root '.claude/state'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$key = if ($hookInput.agent_id) { $hookInput.agent_id }
       elseif ($hookInput.session_id) { $hookInput.session_id }
       else { 'manual' }
$counterFile = Join-Path $stateDir "gate-$key.count"

function Pass {
  if (Test-Path $counterFile) { Remove-Item $counterFile -Force }
  if (-not $FromHook) { Write-Output "OK ($Mode)" }
  exit 0
}

function Fail([string]$title, [object[]]$lines) {
  $msg = "$title`n" + (($lines | Select-Object -First $max) -join "`n")
  if (-not $FromHook) { Write-Output $msg; exit 1 }

  $count = if (Test-Path $counterFile) { [int](Get-Content $counterFile) } else { 0 }
  $count++
  Set-Content $counterFile $count
  $limit = if ($cfg.maxGateBlocks) { [int]$cfg.maxGateBlocks } else { 3 }
  if ($count -gt $limit) {
    Remove-Item $counterFile -Force
    [Console]::Error.WriteLine("verify gate: still failing after $limit blocks, letting the agent stop. The reviewer/controller must handle it.`n$msg")
    exit 1   # non-blocking: shown to you, agent may stop
  }
  [Console]::Error.WriteLine("verify gate failed (attempt $count of $limit). Fix this before finishing:`n$msg")
  exit 2     # blocking: stderr is fed back to the agent, which continues working
}

# --- targets: -Target > config "targets" > legacy config "solution" ------
# `pwsh -File verify.ps1 -Target a,b` passes "a,b" as one string, so split on commas too.
$targets = if ($Target) { $Target } elseif ($cfg.targets) { $cfg.targets } else { $cfg.solution }
$targets = @($targets | ForEach-Object { "$_" -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if (-not $targets) { Fail 'CONFIG ERROR' @('No build targets: set "targets" in eng/verify.config.json or pass -Target.') }
$missing = @($targets | Where-Object { -not (Test-Path (Join-Path $root $_)) })
if ($missing) { Fail 'CONFIG ERROR' ($missing | ForEach-Object { "Target not found: $_" }) }

# Keep the matching lines; if the filter caught nothing, show the tail so the failure isn't silent.
function Select-Failure([object[]]$out, [string]$pattern) {
  $hits = @($out | Where-Object { "$_" -match $pattern } | Select-Object -Unique)
  if ($hits) { $hits } else { $out | Select-Object -Last $max }
}

function Invoke-Build {
  foreach ($t in $targets) {
    $out = & dotnet build $t @($cfg.buildArgs) 2>&1
    if ($LASTEXITCODE -ne 0) {
      Fail "BUILD FAILED ($t)" (Select-Failure $out ': (error|warning) ')
    }
  }
}

# Warnings are only emitted for projects that actually compile, so this mode forces a
# non-incremental build. Shared projects are rebuilt per target; duplicates are dropped.
function Invoke-WarningsBuild {
  $wArgs = if ($cfg.warningsBuildArgs) { @($cfg.warningsBuildArgs) }
           else { @('-nologo', '-v', 'q', '-clp:NoSummary', '--no-incremental') }
  $maxWarn = if ($cfg.maxWarningLines) { [int]$cfg.maxWarningLines } else { 200 }
  $prefix = [regex]::Escape("$root\")
  $warnings = @()
  foreach ($t in $targets) {
    $out = @(& dotnet build $t @wArgs 2>&1 | ForEach-Object { ("$_" -replace $prefix, '').Trim() })
    if ($LASTEXITCODE -ne 0) {
      # errors first so they aren't pushed past the line cap by warnings
      $errs = @($out | Where-Object { $_ -match ': error ' } | Select-Object -Unique)
      $warns = @($out | Where-Object { $_ -match ': warning ' } | Select-Object -Unique)
      $max = $maxWarn
      Fail "BUILD FAILED ($t): $($errs.Count) error(s), $($warns.Count) warning(s)" `
        $(if ($errs -or $warns) { $errs + $warns } else { $out | Select-Object -Last $maxWarn })
    }
    $warnings += @($out | Where-Object { $_ -match ': warning ' })
  }
  $warnings = @($warnings | Select-Object -Unique)
  if ($OutFile) {
    New-Item -ItemType Directory -Force -Path (Split-Path $OutFile -Parent) | Out-Null
    $warnings | Set-Content -Path $OutFile -Encoding utf8
  }
  if (-not $warnings) { Write-Output "OK (warnings): build succeeded, 0 warnings"; exit 0 }

  $byCode = $warnings | ForEach-Object { if ($_ -match ': warning (\S+?):') { $Matches[1] } else { '?' } } |
    Group-Object | Sort-Object Count -Descending | ForEach-Object { "$($_.Name) x$($_.Count)" }
  Write-Output "OK (warnings): build succeeded, $($warnings.Count) unique warning(s): $($byCode -join ', ')"
  $warnings | Select-Object -First $maxWarn
  if ($warnings.Count -gt $maxWarn) {
    Write-Output "... $($warnings.Count - $maxWarn) more not shown; narrow with -Target or raise maxWarningLines."
  }
  exit 0
}

function Invoke-Tests([string[]]$extra) {
  foreach ($t in $targets) {
    $testArgs = @($t) + @($cfg.testArgs) + $extra
    $out = & dotnet test @testArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
      Fail "TESTS FAILED ($t)" (Select-Failure $out $cfg.testFailurePattern)
    }
  }
}

switch ($Mode) {
  'build' { Invoke-Build; Pass }
  'warnings' { Invoke-WarningsBuild }
  'test'  {
    Invoke-Build
    $extra = @(); if ($Filter) { $extra = @($cfg.filterArgName, $Filter) }
    Invoke-Tests $extra; Pass
  }
  'gate'  { Invoke-Build; Invoke-Tests @($cfg.gateTestArgs); Pass }
}