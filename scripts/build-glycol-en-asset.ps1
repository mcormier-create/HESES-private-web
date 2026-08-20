$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'public\system-images\boucle-glycolee-humifog.png'
$assetPath = Join-Path $root 'public\system-images\boucle-glycolee-humifog-en.png'
$tempPath = Join-Path $root 'public\system-images\boucle-glycolee-humifog-en.fixed.png'
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

function Fill-SkyBand {
  param([int]$X, [int]$Y, [int]$Width, [int]$Height, [int]$SampleX)
  for ($row = $Y; $row -lt ($Y + $Height); $row++) {
    $color = $bitmap.GetPixel($SampleX, $row)
    $brush = [System.Drawing.SolidBrush]::new($color)
    $graphics.FillRectangle($brush, $X, $row, $Width, 1)
    $brush.Dispose()
  }
}

$darkBlue = [System.Drawing.Color]::FromArgb(28, 61, 112)
$blue = [System.Drawing.Color]::FromArgb(18, 82, 180)
$red = [System.Drawing.Color]::FromArgb(235, 55, 40)
$orange = [System.Drawing.Color]::FromArgb(240, 105, 25)

$banner = [System.Drawing.SolidBrush]::new($darkBlue)
$graphics.FillRectangle($banner, 548, 16, 680, 66)
$banner.Dispose()

# Clear only the narrow original text rows; equipment and arrows stay untouched.
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$graphics.FillRectangle($white, 25, 205, 145, 35)
$graphics.FillRectangle($white, 20, 420, 175, 35)
$graphics.FillRectangle($white, 1510, 300, 190, 35)
$graphics.FillRectangle($white, 1630, 555, 145, 35)

# The lower legend sits on a white panel in the source.
$graphics.FillRectangle($white, 260, 690, 1280, 195)
$white.Dispose()

Draw-Text 'AHU WITH RUN-AROUND GLYCOL LOOP' 18 ([System.Drawing.Color]::White) 548 16 680 66
Draw-Text 'EXHAUST AIR' 18 $red 0 205 190 50
Draw-Text 'OUTDOOR AIR' 18 $blue 0 420 220 50
Draw-Text 'RETURN AIR' 18 $orange 1470 290 300 55
Draw-Text 'SUPPLY AIR' 18 $blue 1580 535 194 55
Draw-Text 'FILTRATION' 15 $darkBlue 270 735 160 42
Draw-Text 'RUN-AROUND' 13 $darkBlue 455 720 250 36
Draw-Text 'GLYCOL LOOP' 13 $darkBlue 455 760 250 36
Draw-Text 'HEATING COIL' 15 $darkBlue 690 735 190 42
Draw-Text 'HUMIFOG' 15 $darkBlue 865 735 150 42
Draw-Text 'COOLING COIL' 15 $darkBlue 1015 735 210 42
Draw-Text 'SUPPLY FAN' 15 $darkBlue 1235 735 220 42

$graphics.Dispose()
$bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
Move-Item -Force $tempPath $assetPath
Write-Output "Created $assetPath"
