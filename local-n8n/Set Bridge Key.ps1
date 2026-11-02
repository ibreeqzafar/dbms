$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeRuntime = Join-Path $bridgeRoot 'runtime'
New-Item -ItemType Directory -Path $bridgeRuntime -Force | Out-Null
Write-Host 'Enter the SAME 32+ character connection key that you saved as N8N_SUPPORT_WORKER_KEY in Supabase.'
Write-Host 'Input is hidden. Do not enter your Groq key here.'
$bridgeSecureKey = Read-Host 'Connection key' -AsSecureString
$bridgeCredential = [PSCredential]::new('essyra-support-worker', $bridgeSecureKey)
if ($bridgeCredential.GetNetworkCredential().Password.Length -lt 32) { throw 'Use a connection key of at least 32 characters.' }
$bridgeSecureKey | Export-Clixml -LiteralPath (Join-Path $bridgeRuntime 'bridge-key.xml')
Write-Host 'Connection key saved using Windows user encryption. Do not share the runtime folder.'
