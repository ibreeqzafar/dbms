$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeRuntime = Join-Path $bridgeRoot 'runtime'
New-Item -ItemType Directory -Path $bridgeRuntime -Force | Out-Null
$bridgeKeyFile = Join-Path $bridgeRuntime 'bridge-key.xml'
if (Test-Path -LiteralPath $bridgeKeyFile) {
 $bridgeSecureKey = Import-Clixml -LiteralPath $bridgeKeyFile
 $bridgePlainKey = ([PSCredential]::new('bridge', $bridgeSecureKey)).GetNetworkCredential().Password
 Write-Host 'Your existing ESSYRA connection key has been copied. It was not replaced.'
} else {
 $bridgeBytes = New-Object byte[] 32
 $bridgeRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
 try { $bridgeRandom.GetBytes($bridgeBytes) } finally { $bridgeRandom.Dispose() }
 $bridgePlainKey = [Convert]::ToBase64String($bridgeBytes)
 $bridgeSecureKey = ConvertTo-SecureString -String $bridgePlainKey -AsPlainText -Force
 $bridgeSecureKey | Export-Clixml -LiteralPath $bridgeKeyFile
 Write-Host 'A random ESSYRA connection key was created and saved with Windows user encryption.'
}
Set-Clipboard -Value $bridgePlainKey
$bridgePlainKey = $null
Write-Host 'Paste it yourself into the Supabase secret named N8N_SUPPORT_WORKER_KEY, then save.'
Write-Host 'This is NOT your Groq key or an account password. Do not paste it into chat.'
Write-Host 'The key remains on your clipboard until you copy something else.'
