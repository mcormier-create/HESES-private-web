$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'public\system-images\roue-thermique-humifog.png'
$destinationPath = Join-Path $root 'public\system-images\roue-thermique-humifog-en.png'
$bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function Copy-Patch {
  param([System.Drawing.Bitmap]$Bitmap, [System.Drawing.Graphics]$Graphics, [int]$SourceX, [int]$SourceY, [int]$TargetX, [int]$TargetY, [int]$Width, [int]$Height)
  $patch = $Bitmap.Clone([System.Drawing.Rectangle]::new($SourceX, $SourceY, $Width, $Height), $Bitmap.PixelFormat)
  $Graphics.DrawImage($patch, $TargetX, $TargetY, $Width, $Height)
  $patch.Dispose()
}

function Draw-OutlinedText {
  param([System.Drawing.Graphics]$Graphics, [string]$Text, [float]$Size, [System.Drawing.Color]$TextColor, [int]$X, [int]$Y, [int]$W, [int]$H)
  $font = [System.Drawing.Font]::new('Arial', $Size, [System.Drawing.FontStyle]::Bold)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddString($Text, $font.FontFamily, [int]$font.Style, $Size, [System.Drawing.RectangleF]::new($X, $Y, $W, $H), $format)
  $outline = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 6)
  $outline.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $fill = [System.Drawing.SolidBrush]::new($TextColor)
  $Graphics.DrawPath($outline, $path)
  $Graphics.FillPath($fill, $path)
  $fill.Dispose(); $outline.Dispose(); $path.Dispose(); $format.Dispose(); $font.Dispose()
}

function Draw-Title {
  param([System.Drawing.Graphics]$Graphics)
  $font = [System.Drawing.Font]::new('Arial', 24, [System.Drawing.FontStyle]::Bold)
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $Graphics.DrawString('AHU WITH ENTHALPY WHEEL', $font, $brush, [System.Drawing.RectangleF]::new(582, 20, 605, 70), $format)
  $format.Dispose(); $brush.Dispose(); $font.Dispose()
}

$darkBlue = [System.Drawing.Color]::FromArgb(28, 61, 112)
$blue = [System.Drawing.Color]::FromArgb(18, 82, 180)
$red = [System.Drawing.Color]::FromArgb(235, 55, 40)
$orange = [System.Drawing.Color]::FromArgb(240, 105, 25)

$bannerBrush = [System.Drawing.SolidBrush]::new($darkBlue)
$graphics.FillRectangle($bannerBrush, 582, 20, 605, 70)
$bannerBrush.Dispose()
Copy-Patch $bitmap $graphics 20 205 20 240 120 38
Copy-Patch $bitmap $graphics 20 395 20 432 150 40
Copy-Patch $bitmap $graphics 1450 220 1450 315 205 45
Copy-Patch $bitmap $graphics 1630 520 1630 555 140 45
Copy-Patch $bitmap $graphics 1500 755 260 755 250 100
Copy-Patch $bitmap $graphics 1500 755 510 755 250 100
Copy-Patch $bitmap $graphics 1500 755 760 755 250 100
Copy-Patch $bitmap $graphics 1500 755 1010 755 250 100
Copy-Patch $bitmap $graphics 1500 755 1260 755 240 100

Draw-Title $graphics
Draw-OutlinedText $graphics 'EXHAUST AIR' 20 $red 20 240 150 38
Draw-OutlinedText $graphics 'OUTDOOR AIR' 20 $blue 20 432 160 40
Draw-OutlinedText $graphics 'RETURN AIR' 20 $orange 1450 315 205 45
Draw-OutlinedText $graphics 'SUPPLY AIR' 20 $blue 1630 555 140 45
Draw-OutlinedText $graphics 'FILTRATION' 14 $darkBlue 270 755 130 35
Draw-OutlinedText $graphics 'THERMAL WHEEL' 14 $darkBlue 470 755 160 35
Draw-OutlinedText $graphics 'HEATING COIL' 14 $darkBlue 695 755 150 35
Draw-OutlinedText $graphics 'HUMIFOG' 14 $darkBlue 875 755 130 35
Draw-OutlinedText $graphics 'COOLING COIL' 14 $darkBlue 1025 755 180 35
Draw-OutlinedText $graphics 'SUPPLY FAN' 14 $darkBlue 1245 755 170 35

$graphics.Dispose()
$bitmap.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
Write-Output "Created $destinationPath"