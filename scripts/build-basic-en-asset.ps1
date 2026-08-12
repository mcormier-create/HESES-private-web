$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'public\system-images\100-air-exterieur-humifog.png'
$assetPath = Join-Path $root 'public\system-images\100-air-exterieur-humifog-en.png'
$tempPath = Join-Path $root 'public\system-images\100-air-exterieur-humifog-en.fixed.png'
$bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function Draw-Text {
  param([string]$Text, [float]$Size, [System.Drawing.Color]$Color, [int]$X, [int]$Y, [int]$W, [int]$H)
  $font = [System.Drawing.Font]::new('Arial', $Size, [System.Drawing.FontStyle]::Bold)
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString($Text, $font, $brush, [System.Drawing.RectangleF]::new($X, $Y, $W, $H), $format)
  $format.Dispose(); $brush.Dispose(); $font.Dispose()
}

$darkBlue = [System.Drawing.Color]::FromArgb(28, 61, 112)
$blue = [System.Drawing.Color]::FromArgb(18, 82, 180)
$red = [System.Drawing.Color]::FromArgb(235, 55, 40)
$orange = [System.Drawing.Color]::FromArgb(240, 105, 25)

# Keep the same banner shape and equipment; replace only the baked title.
$banner = [System.Drawing.SolidBrush]::new($darkBlue)
$graphics.FillRectangle($banner, 548, 22, 638, 64)
$banner.Dispose()

# Remove only the old text bands. The machine and airflow arrows remain untouched.
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$graphics.FillRectangle($white, 0, 235, 180, 58)
$graphics.FillRectangle($white, 0, 430, 190, 58)
$graphics.FillRectangle($white, 1435, 315, 300, 60)
$graphics.FillRectangle($white, 1590, 555, 184, 65)
$graphics.FillRectangle($white, 270, 735, 1260, 150)
$white.Dispose()

Draw-Text 'AHU WITHOUT HEAT EXCHANGER' 26 ([System.Drawing.Color]::White) 548 22 638 64
Draw-Text 'EXHAUST AIR' 18 $red 0 235 180 58
Draw-Text 'OUTDOOR AIR' 18 $blue 0 430 190 58
Draw-Text 'RETURN AIR' 18 $orange 1435 315 300 60
Draw-Text 'SUPPLY AIR' 18 $blue 1590 555 184 65
Draw-Text 'FILTRATION' 14 $darkBlue 270 750 150 42
Draw-Text 'NEW OUTDOOR AIR FAN' 12 $darkBlue 450 745 210 48
Draw-Text 'HEATING COIL' 14 $darkBlue 690 750 190 42
Draw-Text 'HUMIFOG' 14 $darkBlue 865 750 150 42
Draw-Text 'COOLING COIL' 14 $darkBlue 1015 750 210 42
Draw-Text 'SUPPLY FAN' 14 $darkBlue 1235 750 220 42

$graphics.Dispose()
$bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
Move-Item -Force $tempPath $assetPath
Write-Output "Created $assetPath"
