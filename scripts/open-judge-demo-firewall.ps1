# Run in PowerShell AS ADMINISTRATOR (right-click → Run as administrator)
# Opens TCP 3001 (QuickSend API), 8081 & 19006 (Expo) for judges on your Wi-Fi.

$rules = @(
  @{ Name = 'QuickSend API 3001'; Port = 3001 },
  @{ Name = 'Expo Metro 8081'; Port = 8081 },
  @{ Name = 'Expo 19006'; Port = 19006 }
)
foreach ($r in $rules) {
  if (-not (Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -LocalPort $r.Port -Protocol TCP -Action Allow
    Write-Host "Added: $($r.Name)"
  } else {
    Write-Host "Already exists: $($r.Name)"
  }
}
Write-Host "Done. Judges can reach your PC on ports 3001 (API) and 8081 (Expo web)."
