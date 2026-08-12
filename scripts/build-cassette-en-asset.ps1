$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'public\system-images\cassette-humifog.png'
$assetPath = Join-Path $root 'public\system-images\cassette-humifog-en.png'
$tempPath = Join-Path $root 'public\system-images\cassette-humifog-en.fixed.png'
$bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function Fill-SkyBand {
  param([int]$X, [int]$Y, [int]$Width, [int]$Height, [int]$LeftSample, [int]$RightSample)
  for ($row = $Y; $row -lt ($Y + $Height); $row++) {
    $left = $bitmap.GetPixel($LeftSample, $row)
    $right = $bitmap.GetPixel($RightSample, $row)
    $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      [System.Drawing.Rectangle]::new($X, $row, $Width, 1),
      $left,
      $right,
      [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
    )
    $graphics.FillRectangle($brush, $X, $row, $Width, 1)
    $brush.Dispose()
  }
}

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

# Repaint the original title banner, preserving its shape and position.
$banner = [System.Drawing.SolidBrush]::new($darkBlue)
$graphics.FillRectangle($banner, 490, 14, 800, 66)
$banner.Dispose()

# Reconstruct only the sky behind the four baked airflow words.
Fill-SkyBand 0 225 180 70 0 190
Fill-SkyBand 0 430 170 70 0 200
Fill-SkyBand 1480 305 250 80 1450 1740
Fill-SkyBand 1600 555 174 85 1570 1773

# The lower legend is on a white background; clear its text rows only.
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$graphics.FillRectangle($white, 270, 795, 1260, 85)
$white.Dispose()

Draw-Text 'AHU WITH CASSETTE HEAT EXCHANGER' 28 ([System.Drawing.Color]::White) 490 14 800 66
Draw-Text 'EXHAUST AIR' 16 $red 0 235 180 50
Draw-Text 'OUTDOOR AIR' 16 $blue 0 440 170 50
Draw-Text 'RETURN AIR' 16 $orange 1480 320 250 52
Draw-Text 'SUPPLY AIR' 16 $blue 1600 575 174 52
Draw-Text 'FILTRATION' 15 $darkBlue 270 795 150 40
Draw-Text 'CASSETTE HEAT EXCHANGER' 13 $darkBlue 455 795 240 70
Draw-Text 'HEATING COIL' 15 $darkBlue 690 795 180 40
Draw-Text 'HUMIFOG' 15 $darkBlue 865 795 150 40
Draw-Text 'COOLING COIL' 15 $darkBlue 1015 795 210 40
Draw-Text 'SUPPLY FAN' 15 $darkBlue 1235 795 220 40

$graphics.Dispose()
$bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
Move-Item -Force $tempPath $assetPath
Write-Output "Created $assetPath"
