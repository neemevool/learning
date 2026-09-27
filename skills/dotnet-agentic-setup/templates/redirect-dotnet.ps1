$in  = [Console]::In.ReadToEnd() | ConvertFrom-Json
$cmd = "$($in.tool_input.command)"
if ($cmd -match '(^|[;&|]\s*)dotnet\s+(build|test)\b') {
  [Console]::Error.WriteLine(@"
Use the wrapper instead of raw dotnet build/test:
  pwsh -NoProfile -File ./eng/verify.ps1 -Mode build                     # errors only (default check)
  pwsh -NoProfile -File ./eng/verify.ps1 -Mode warnings                  # full rebuild, lists all warnings too
  pwsh -NoProfile -File ./eng/verify.ps1 -Mode test -Filter "<filter>"
Add -Target <project path> to limit any mode to specific projects (comma-separated).
Use -Mode warnings only when you specifically need to see warnings; it is slower (non-incremental).
It returns condensed output and matches the stop gate.
"@)
  exit 2
}
exit 0