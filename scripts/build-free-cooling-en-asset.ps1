$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $root 'public\system-images\free-cooling-humifog.png'
$dstPath = Join-Path $root 'public\system-images\free-cooling-humifog-en.png'

$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function Fill-Rect {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$X,
    [int]$Y,
    [int]$W,
    [int]$H,
    [System.Drawing.Color]$Color
  )
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $Graphics.FillRectangle($brush, $X, $Y, $W, $H)
  $brush.Dispose()
}

function Draw-TextCenter {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [System.Drawing.Brush]$Brush,
    [int]$X,
    [int]$Y,
    [int]$W,
    [int]$H
  )
  $sf = [System.Drawing.StringFormat]::new()
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $sf.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
  $sf.FormatFlags = [System.Drawing.StringFormatFlags]::NoClip
  $rect = [System.Drawing.RectangleF]::new($X, $Y, $W, $H)
  $Graphics.DrawString($Text, $Font, $Brush, $rect, $sf)
  $sf.Dispose()
}

function Draw-MultilineCenter {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [System.Drawing.Brush]$Brush,
    [int]$X,
    [int]$Y,
    [int]$W,
    [int]$H
  )
  $sf = [System.Drawing.StringFormat]::new()
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Near
  $sf.Trimming = [System.Drawing.StringTrimming]::Word
  $rect = [System.Drawing.RectangleF]::new($X, $Y, $W, $H)
  $Graphics.DrawString($Text, $Font, $Brush, $rect, $sf)
  $sf.Dispose()
}

function Draw-OutlinedText {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [string]$FontFamily,
    [float]$Size,
    [System.Drawing.FontStyle]$Style,
    [System.Drawing.Color]$TextColor,
    [System.Drawing.Color]$OutlineColor,
    [float]$OutlineWidth,
    [int]$X,
    [int]$Y,
    [int]$W,
    [int]$H,
    [bool]$Center = $true
  )
  $fmt = [System.Drawing.StringFormat]::new()
  $fmt.Alignment = if ($Center) { [System.Drawing.StringAlignment]::Center } else { [System.Drawing.StringAlignment]::Near }
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $fmt.Trimming = [System.Drawing.StringTrimming]::None
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $family = New-Object System.Drawing.FontFamily($FontFamily)
  $rect = [System.Drawing.RectangleF]::new($X, $Y, $W, $H)
  $path.AddString($Text, $family, [int]$Style, $Size, $rect, $fmt)
  $outlinePen = [System.Drawing.Pen]::new($OutlineColor, $OutlineWidth)
  $outlinePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $fillBrush = [System.Drawing.SolidBrush]::new($TextColor)
  $Graphics.DrawPath($outlinePen, $path)
  $Graphics.FillPath($fillBrush, $path)
  $fillBrush.Dispose()
  $outlinePen.Dispose()
  $path.Dispose()
  $family.Dispose()
  $fmt.Dispose()
}

$white = [System.Drawing.Color]::FromArgb(248, 250, 254)
$blueText = [System.Drawing.Color]::FromArgb(18, 54, 156)
$redText = [System.Drawing.Color]::FromArgb(245, 39, 28)
$orangeText = [System.Drawing.Color]::FromArgb(255, 120, 26)
$darkBlueBanner = [System.Drawing.Color]::FromArgb(14, 47, 117)

# Top title banner replacement
$bannerX = 498
$bannerY = 18
$bannerW = 776
$bannerH = 84
$radius = 18
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($bannerX, $bannerY, $radius, $radius, 180, 90)
$path.AddArc($bannerX + $bannerW - $radius, $bannerY, $radius, $radius, 270, 90)
$path.AddArc($bannerX + $bannerW - $radius, $bannerY + $bannerH - $radius, $radius, $radius, 0, 90)
$path.AddArc($bannerX, $bannerY + $bannerH - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()
$bannerBrush = [System.Drawing.SolidBrush]::new($darkBlueBanner)
$g.FillPath($bannerBrush, $path)
$bannerBrush.Dispose()
$path.Dispose()
$titleFont = [System.Drawing.Font]::new('Arial', 66/3, [System.Drawing.FontStyle]::Bold)
$titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
Draw-TextCenter -Graphics $g -Text 'AHU WITH FREE COOLING' -Font $titleFont -Brush $titleBrush -X $bannerX -Y $bannerY -W $bannerW -H $bannerH
$titleFont.Dispose()
$titleBrush.Dispose()

# Side airflow labels
Draw-OutlinedText -Graphics $g -Text 'EXHAUST AIR' -FontFamily 'Arial' -Size 18 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $redText -OutlineColor $white -OutlineWidth 8 -X 8 -Y 174 -W 190 -H 52
Draw-OutlinedText -Graphics $g -Text 'OUTDOOR AIR' -FontFamily 'Arial' -Size 18 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 8 -X 8 -Y 400 -W 200 -H 52
Draw-OutlinedText -Graphics $g -Text 'RETURN AIR' -FontFamily 'Arial' -Size 18 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $orangeText -OutlineColor $white -OutlineWidth 8 -X 1568 -Y 214 -W 196 -H 54
Draw-OutlinedText -Graphics $g -Text 'SUPPLY AIR' -FontFamily 'Arial' -Size 18 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 8 -X 1568 -Y 516 -W 196 -H 54

# Mixed air callout box label
Fill-Rect -Graphics $g -X 476 -Y 389 -W 166 -H 52 -Color ([System.Drawing.Color]::FromArgb(220, 229, 243))
$mixPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(95, 116, 168), 1)
$g.DrawRectangle($mixPen, 476, 389, 166, 52)
$mixPen.Dispose()
$mixFont = [System.Drawing.Font]::new('Arial', 16, [System.Drawing.FontStyle]::Bold)
$mixBrush = [System.Drawing.SolidBrush]::new($blueText)
Draw-TextCenter -Graphics $g -Text 'AIR MIXING' -Font $mixFont -Brush $mixBrush -X 480 -Y 394 -W 158 -H 42
$mixFont.Dispose(); $mixBrush.Dispose()

# Bottom component labels replacement without mask bars
Draw-OutlinedText -Graphics $g -Text 'AIR MIXING' -FontFamily 'Arial' -Size 14 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 8 -X 384 -Y 767 -W 132 -H 28
Draw-OutlinedText -Graphics $g -Text '(OUTDOOR AIR +' -FontFamily 'Arial' -Size 12 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 7 -X 370 -Y 794 -W 160 -H 24
Draw-OutlinedText -Graphics $g -Text 'RETURN AIR)' -FontFamily 'Arial' -Size 12 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 7 -X 380 -Y 819 -W 140 -H 24

Draw-OutlinedText -Graphics $g -Text 'SUPPLY FAN' -FontFamily 'Arial' -Size 14 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 8 -X 552 -Y 786 -W 146 -H 30
Draw-OutlinedText -Graphics $g -Text 'FREE COOLING' -FontFamily 'Arial' -Size 14 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 8 -X 732 -Y 786 -W 160 -H 30
Draw-OutlinedText -Graphics $g -Text '(OUTDOOR AIR)' -FontFamily 'Arial' -Size 12 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 7 -X 738 -Y 814 -W 148 -H 24
Draw-OutlinedText -Graphics $g -Text 'HEATING COIL' -FontFamily 'Arial' -Size 14 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 8 -X 914 -Y 786 -W 152 -H 30
Draw-OutlinedText -Graphics $g -Text 'COOLING COIL' -FontFamily 'Arial' -Size 14 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 8 -X 1218 -Y 786 -W 162 -H 30
Draw-OutlinedText -Graphics $g -Text 'SUPPLY SECTION' -FontFamily 'Arial' -Size 14 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 8 -X 1394 -Y 786 -W 220 -H 30
Draw-OutlinedText -Graphics $g -Text '(AFTER FAN)' -FontFamily 'Arial' -Size 12 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 7 -X 1422 -Y 814 -W 164 -H 24

# Bottom legend text replacement
Draw-OutlinedText -Graphics $g -Text 'OUTDOOR AIR' -FontFamily 'Arial' -Size 12 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 6 -X 70 -Y 844 -W 146 -H 30
Draw-OutlinedText -Graphics $g -Text 'RETURN AIR' -FontFamily 'Arial' -Size 12 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 6 -X 246 -Y 844 -W 142 -H 30
Draw-OutlinedText -Graphics $g -Text 'MIXED AIR' -FontFamily 'Arial' -Size 12 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 6 -X 422 -Y 844 -W 138 -H 30
Draw-OutlinedText -Graphics $g -Text 'SUPPLY AIR' -FontFamily 'Arial' -Size 12 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 6 -X 586 -Y 844 -W 146 -H 30
Draw-OutlinedText -Graphics $g -Text 'EXHAUST AIR' -FontFamily 'Arial' -Size 12 -Style ([System.Drawing.FontStyle]::Bold) -TextColor $blueText -OutlineColor $white -OutlineWidth 6 -X 756 -Y 844 -W 146 -H 30

$g.Dispose()
$bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Created $dstPath"
