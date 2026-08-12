$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'public\system-images\debit-croise-humifog.png'
$assetPath = Join-Path $root 'public\system-images\debit-croise-humifog-en.png'
$tempPath = Join-Path $root 'public\system-images\debit-croise-humifog-en.fixed.png'
$bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function Fill-SkyGradient {
  param([int]$TargetX, [int]$TargetY, [int]$Width, [int]$Height, [int]$SampleX1, [int]$SampleY1, [int]$SampleX2, [int]$SampleY2)
  $color1 = $bitmap.GetPixel($SampleX1, $SampleY1)
  $color2 = $bitmap.GetPixel($SampleX2, $SampleY2)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new($TargetX, $TargetY, $Width, $Height),
    $color1,
    $color2,
    [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
  )
  $graphics.FillRectangle($brush, $TargetX, $TargetY, $Width, $Height)
  $brush.Dispose()
}

function Draw-Label {
  param([string]$Text, [float]$Size, [System.Drawing.Color]$Color, [int]$X, [int]$Y, [int]$W, [int]$H)
  $font = [System.Drawing.Font]::new('Arial', $Size, [System.Drawing.FontStyle]::Bold)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $graphics.DrawString($Text, $font, $brush, [System.Drawing.RectangleF]::new($X, $Y, $W, $H), $format)
  $brush.Dispose(); $format.Dispose(); $font.Dispose()
}

function Draw-OutlinedLabel {
  param([string]$Text, [float]$Size, [System.Drawing.Color]$Color, [int]$X, [int]$Y, [int]$W, [int]$H)
  $font = [System.Drawing.Font]::new('Arial', $Size, [System.Drawing.FontStyle]::Bold)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddString($Text, $font.FontFamily, [int]$font.Style, $Size, [System.Drawing.RectangleF]::new($X, $Y, $W, $H), $format)
  $outline = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 10)
  $outline.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $graphics.DrawPath($outline, $path)
  $graphics.FillPath($brush, $path)
  $brush.Dispose(); $outline.Dispose(); $path.Dispose(); $format.Dispose(); $font.Dispose()
}

$darkBlue = [System.Drawing.Color]::FromArgb(28, 61, 112)
$blue = [System.Drawing.Color]::FromArgb(18, 82, 180)
$red = [System.Drawing.Color]::FromArgb(235, 55, 40)
$orange = [System.Drawing.Color]::FromArgb(240, 105, 25)

$banner = [System.Drawing.SolidBrush]::new($darkBlue)
$graphics.FillRectangle($banner, 525, 20, 760, 65)
$banner.Dispose()

# The bottom legend is on a white panel in the source image.
$white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$graphics.FillRectangle($white, 0, 235, 180, 58)
$graphics.FillRectangle($white, 0, 430, 250, 58)
$graphics.FillRectangle($white, 1410, 315, 330, 60)
$graphics.FillRectangle($white, 1580, 545, 194, 65)
$graphics.FillRectangle($white, 250, 735, 1280, 145)
$white.Dispose()

Draw-Label 'AHU WITH CROSS-FLOW HEAT EXCHANGER' 22 ([System.Drawing.Color]::White) 525 20 760 65
Draw-Label 'EXHAUST AIR' 18 $red 0 235 180 58
Draw-Label 'OUTDOOR AIR' 18 $blue 0 430 250 58
Draw-Label 'RETURN AIR' 18 $orange 1410 315 330 60
Draw-Label 'SUPPLY AIR' 18 $blue 1580 545 194 65
Draw-Label 'FILTRATION' 14 $darkBlue 270 745 150 42
Draw-Label 'CROSS-FLOW' 13 $darkBlue 445 740 220 38
Draw-Label 'HEAT EXCHANGER' 13 $darkBlue 430 780 250 38
Draw-Label 'HEATING COIL' 13 $darkBlue 680 750 200 42
Draw-Label 'HUMIFOG' 13 $darkBlue 865 750 160 42
Draw-Label 'COOLING COIL' 13 $darkBlue 1010 750 220 42
Draw-Label 'SUPPLY FAN' 13 $darkBlue 1230 750 220 42

$graphics.Dispose()
$bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
Move-Item -Force $tempPath $assetPath
Write-Output "Updated $assetPath"
