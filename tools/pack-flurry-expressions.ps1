param([string]$Generation = 'artifacts/flurry-expression-generation.json')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$sourceRoot = Join-Path $root 'public/assets/sources/ui/stickers/snowflake-expressions-v2'
$runtimeRoot = Join-Path $root 'public/assets/runtime/ui/stickers/snowflake-expressions-v2'
New-Item -ItemType Directory -Force $sourceRoot,$runtimeRoot | Out-Null
$generationData = Get-Content (Join-Path $root $Generation) -Raw | ConvertFrom-Json
$atlas = [System.Drawing.Bitmap]::new(1536,1920,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($atlas)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$review = [System.Drawing.Bitmap]::new(1024,1450)
$reviewGraphics = [System.Drawing.Graphics]::FromImage($review)
$reviewGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ice = [System.Drawing.Image]::FromFile((Join-Path $root 'public/assets/runtime/ui/stickers/snowflake-v1/ice.png'))
$font = [System.Drawing.Font]::new('Georgia',16)
$assets = @()
try {
 $i=0
 foreach($record in $generationData.records){
  if($record.id -notmatch '^[a-z-]+$'){throw 'Invalid expression name'}
  $destination=Join-Path $sourceRoot ($record.id+'.png')
  Copy-Item -LiteralPath $record.path -Destination $destination
  $image=[System.Drawing.Bitmap]::new($destination)
  try {
   if($image.GetPixel(0,0).A -gt 1){throw ('Expected original transparent alpha: '+$record.id)}
   $column=$i%4;$row=[int][Math]::Floor($i/4)
   $tile=[System.Drawing.Rectangle]::new($column*384,$row*384,384,384)
   # Mechanical atlas packing only: original generated source pixels are kept.
   $graphics.DrawImage($image,$tile,0,0,$image.Width,$image.Height,[System.Drawing.GraphicsUnit]::Pixel)
   $background=if($i%2){[System.Drawing.ColorTranslator]::FromHtml('#1a2d37')}else{[System.Drawing.ColorTranslator]::FromHtml('#f3ede3')}
   $brush=[System.Drawing.SolidBrush]::new($background)
   $reviewGraphics.FillRectangle($brush,$column*256,$row*290,256,290);$brush.Dispose()
   $subject=[System.Drawing.Rectangle]::new($column*256+16,$row*290+8,224,224)
   $reviewGraphics.DrawImage($ice,$subject)
   $reviewGraphics.DrawImage($image,$subject)
   $ink=if($i%2){[System.Drawing.Brushes]::White}else{[System.Drawing.Brushes]::Black}
   $reviewGraphics.DrawString($record.id,$font,$ink,$column*256+14,$row*290+245)
   $assets+=@{file=$record.id+'.png';frame=$i;width=$image.Width;height=$image.Height;sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLower();prompt=$record.prompt;references=$record.references}
  } finally {$image.Dispose()}
  $i++
 }
 $atlas.Save((Join-Path $runtimeRoot 'faces.png'),[System.Drawing.Imaging.ImageFormat]::Png)
 $review.Save((Join-Path $sourceRoot 'contact-sheet.png'),[System.Drawing.Imaging.ImageFormat]::Png)
 $manifest=@{version=2;generator=$generationData.generator;assets=$assets;runtime=@{file='public/assets/runtime/ui/stickers/snowflake-expressions-v2/faces.png';columns=4;rows=5;tile=384;frames=$generationData.records.id};registration='Original full square canvas retained. Atlas cells preserve normalized feature positions. No generated alpha replaced.'}
 $manifest | ConvertTo-Json -Depth 12 | Set-Content (Join-Path $sourceRoot 'manifest.json') -Encoding utf8
 Write-Output ('Packed '+$assets.Count+' original-alpha faces into 1536x1920 atlas.')
} finally {$font.Dispose();$ice.Dispose();$graphics.Dispose();$atlas.Dispose();$reviewGraphics.Dispose();$review.Dispose()}
