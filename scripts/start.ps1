param([switch]$Demo)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$candidates = @()
$installedNode = Get-Command node -ErrorAction SilentlyContinue
if ($installedNode) { $candidates += $installedNode.Source }
if (Test-Path -LiteralPath $bundledNode) { $candidates += $bundledNode }
$nodeRuntime = $null
foreach ($candidate in $candidates) {
  $version = & $candidate --version
  if ([int]($version.TrimStart('v').Split('.')[0]) -ge 24) { $nodeRuntime = $candidate; break }
}
if (-not $nodeRuntime) { throw 'Node.js 24 or later is required. Install it from nodejs.org, then rerun this script.' }
Push-Location -LiteralPath $projectRoot
try {
  if ($Demo) { & $nodeRuntime scripts/demo.js }
  else { & $nodeRuntime --env-file-if-exists=.env src/server.js }
} finally { Pop-Location }
