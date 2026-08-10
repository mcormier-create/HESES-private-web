param(
  [string]$Root = "."
)

Set-Location $Root
npm install

Write-Output "Dependencies installed for workspace root and npm workspaces."
