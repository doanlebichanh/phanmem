param(
  [Parameter(Mandatory=$false)]
  [string]$SourcePath,

  [Parameter(Mandatory=$true)]
  [string]$DestDir,

  [Parameter(Mandatory=$false)]
  [switch]$Zip
)

$ErrorActionPreference = 'Stop'

function Resolve-DefaultDbPath {
  $candidates = @()

  # Dev default: alongside source (if script is run from repo)
  $repoDb = Join-Path -Path (Get-Location) -ChildPath 'freight.db'
  $candidates += $repoDb

  # Common Electron userData folders (depends on app.name/productName)
  $appData = [Environment]::GetFolderPath('ApplicationData')
  $candidates += (Join-Path $appData 'FreightManager\freight.db')
  $candidates += (Join-Path $appData 'freight-management-system\freight.db')
  $candidates += (Join-Path $appData 'com.ngocanh.freight\freight.db')

  foreach ($p in $candidates) {
    if (Test-Path -LiteralPath $p) { return $p }
  }

  return $null
}

if (-not $SourcePath -or $SourcePath.Trim() -eq '') {
  $SourcePath = Resolve-DefaultDbPath
}

if (-not $SourcePath) {
  throw "Khong tim thay freight.db. Hay truyen -SourcePath de chi ro duong dan (VD: C:\Users\<you>\AppData\Roaming\FreightManager\freight.db)."
}

$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path
$sourceDir = Split-Path -Path $SourcePath -Parent
$dbName = Split-Path -Path $SourcePath -Leaf

if (-not (Test-Path -LiteralPath $DestDir)) {
  New-Item -ItemType Directory -Path $DestDir | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupDir = Join-Path $DestDir ("FreightManager_Backup_{0}" -f $timestamp)
New-Item -ItemType Directory -Path $backupDir | Out-Null

$filesToCopy = @(
  (Join-Path $sourceDir $dbName),
  (Join-Path $sourceDir ($dbName + '-wal')),
  (Join-Path $sourceDir ($dbName + '-shm'))
)

foreach ($f in $filesToCopy) {
  if (Test-Path -LiteralPath $f) {
    Copy-Item -LiteralPath $f -Destination $backupDir -Force
  }
}

if ($Zip) {
  $zipPath = Join-Path $DestDir ("FreightManager_Backup_{0}.zip" -f $timestamp)
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  Compress-Archive -Path (Join-Path $backupDir '*') -DestinationPath $zipPath
  Write-Host "OK: Da tao file backup: $zipPath"
} else {
  Write-Host "OK: Da backup vao thu muc: $backupDir"
}

Write-Host "Nguon DB: $SourcePath"