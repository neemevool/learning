#Requires -Version 7
<#
  Groups a warnings file written by `verify.ps1 -Mode warnings -OutFile` by warning code.
    -Log <file>        the file to count
    -Compare <file>    an older file: also lists codes that grew; exits 1 if a code is new
    -PathPrefix 'p1,p2' only count lines whose repo-relative path starts with one of the comma-separated prefixes (default VTMF.Terminal.SPA\)
    -Code <regex>       only count warning codes matching the regex (e.g. 'CS86\d\d')
  A missing log file is an error (exit 2).
#>
param(
  [Parameter(Mandatory)] [string]$Log,
  [string]$Compare,
  [string[]]$PathPrefix = @('VTMF.Terminal.SPA\'),
  [string]$Code = '.+'
)

# `pwsh -File ... -PathPrefix 'a,b'` arrives as one string: split on commas.
$PathPrefix = @($PathPrefix | ForEach-Object { "$_" -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

foreach ($f in @($Log, $Compare) | Where-Object { $_ }) {
  if (-not (Test-Path $f)) { Write-Error "Log not found: $f"; exit 2 }
}

function Get-Counts([string]$path) {
  $counts = @{}
  Get-Content $path |
    Where-Object { $line = $_; @($PathPrefix | Where-Object { $line.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0 } |
    ForEach-Object {
      if ($_ -match ': warning (\S+?):') {
        $c = $Matches[1]
        if ($c -match "^(?:$Code)$") { $counts[$c] = 1 + ($counts[$c] ?? 0) }
      }
    }
  $counts
}

$now = Get-Counts $Log
"Total: $(($now.Values | Measure-Object -Sum).Sum ?? 0)"
$now.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { '{0,-12} {1,5}' -f $_.Key, $_.Value }

if ($Compare) {
  $old = Get-Counts $Compare
  $grew = @($now.Keys | Where-Object { $old.ContainsKey($_) -and $now[$_] -gt $old[$_] })
  if ($grew) { 'Grew: ' + (($grew | ForEach-Object { "$_ $($old[$_])->$($now[$_])" }) -join ', ') }
  $gone = @($old.Keys | Where-Object { -not $now.ContainsKey($_) })
  if ($gone) { "Gone: $($gone -join ', ')" }
  $new = @($now.Keys | Where-Object { -not $old.ContainsKey($_) })
  if ($new) { "NEW CODES: $($new -join ', ')"; exit 1 }
  'No new codes.'
}
