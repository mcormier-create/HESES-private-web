$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'public\system-images\free-cooling-humifog.png'
$dst = Join-Path $root 'public\system-images\free-cooling-humifog-en.png'

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Coordinates tuned for 1774x887 source image.
$oldCenterX = 408
$newCenterX = 510
$deltaX = $newCenterX - $oldCenterX

$lineY1 = 596
$lineY2 = 706
$iconY = 706
$textY = 760

$lineW = 6
$iconW = 56
$iconH = 56
$textW = 128
$textH = 72

# Sample nearby clean background and paint over old position.
$bgBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245,245,245))
$g.FillRectangle($bgBrush, $oldCenterX - 70, $lineY1 - 4, 140, ($textY + $textH) - ($lineY1 - 4))
$bgBrush.Dispose()

# Rebuild subtle connector line at old position cleanup area boundaries.
$erasePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(245,245,245), 8)
$g.DrawLine($erasePen, $oldCenterX, $lineY1, $oldCenterX, $lineY2)
$erasePen.Dispose()

# Copy line+icon+text from source columns and paste at new X.
$lineRect = [System.Drawing.Rectangle]::new($oldCenterX - [int]($lineW/2), $lineY1, $lineW, $lineY2 - $lineY1)
$iconRect = [System.Drawing.Rectangle]::new($oldCenterX - [int]($iconW/2), $iconY, $iconW, $iconH)
$textRect = [System.Drawing.Rectangle]::new($oldCenterX - [int]($textW/2), $textY, $textW, $textH)

$lineClone = $bmp.Clone($lineRect, $bmp.PixelFormat)
$iconClone = $bmp.Clone($iconRect, $bmp.PixelFormat)
$textClone = $bmp.Clone($textRect, $bmp.PixelFormat)

$g.DrawImage($lineClone, $lineRect.X + $deltaX, $lineRect.Y)
$g.DrawImage($iconClone, $iconRect.X + $deltaX, $iconRect.Y)
$g.DrawImage($textClone, $textRect.X + $deltaX, $textRect.Y)

$lineClone.Dispose()
$iconClone.Dispose()
$textClone.Dispose()

$g.Dispose()
$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Created: $dst"
