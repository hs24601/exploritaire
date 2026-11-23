param([string]$Generation='artifacts/hero-world-refresh-generation.json',[string]$Family='world-combat/v3',[string]$Clip='')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=Split-Path $PSScriptRoot -Parent
if($Family -notmatch '^[a-z-]+/v[0-9]+$'){throw 'Invalid family'}
$sourceRoot=Join-Path $root ('public/assets/sources/characters/hero/'+$Family)
$runtimeRoot=Join-Path $root ('public/assets/runtime/characters/hero/'+$Family)
New-Item -ItemType Directory -Force $sourceRoot,$runtimeRoot | Out-Null
$data=Get-Content (Join-Path $root $Generation) -Raw | ConvertFrom-Json
$views=@('low-0','low-1','low-2','low-3','low-4','high-0','high-1','high-2','high-3','high-4','top-0')
$manifest=@{version=[int]($Family -replace '^.*/v','');generator=$data.tool;references=$data.references;columns=8;rows=6;cell=256;framesPerView=4;views=$views;clips=@()}
if($Clip -and (Test-Path (Join-Path $sourceRoot 'manifest.json'))){$previous=Get-Content (Join-Path $sourceRoot 'manifest.json') -Raw | ConvertFrom-Json;$manifest.clips=@($previous.clips | Where-Object {$_.id -ne $Clip})}
foreach($record in $data.records){
 if($record.family -ne $Family){continue}
 if($Clip -and $record.id -ne $Clip){continue}
 $images=@();$sources=@()
 foreach($phase in $record.phases){
  $name=$record.id+'-phase-'+$images.Count+'.png';$dest=Join-Path $sourceRoot $name
  Copy-Item -LiteralPath $phase.path -Destination $dest -Force
  $image=[Drawing.Bitmap]::new($dest)
  if($image.Width%4 -ne 0 -or $image.Height -ne $image.Width/4*3){throw ('Non-square 4x3 grid: '+$name)}
  if($image.GetPixel(0,0).A -gt 2){throw ('ImageGen alpha correction needed: '+$name)}
  $images+=,$image;$sources+=@{file=$name;sha256=(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLower();dimensions=@($image.Width,$image.Height);prompt=$phase.prompt;references=$phase.references}
 }
 $atlas=[Drawing.Bitmap]::new(2048,1536,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $g=[Drawing.Graphics]::FromImage($atlas);$g.Clear([Drawing.Color]::Transparent)
 $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
 $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $registrations=@()
 try{
  for($view=0;$view -lt 11;$view++){
   $bounds=@();$left=99999;$top=99999;$right=0;$bottom=0
   for($frame=0;$frame -lt 4;$frame++){
    $image=$images[[Math]::Min($frame,$images.Count-1)];$cell=[int]($image.Width/4);$sx=($view%4)*$cell;$sy=[int][Math]::Floor($view/4)*$cell
    $l=$cell;$t=$cell;$r=0;$b=0;$pixels=0
    for($y=0;$y -lt $cell;$y++){for($x=0;$x -lt $cell;$x++){
     if($image.GetPixel($sx+$x,$sy+$y).A -gt 46){$l=[Math]::Min($l,$x);$t=[Math]::Min($t,$y);$r=[Math]::Max($r,$x);$b=[Math]::Max($b,$y);$pixels++}
    }}
    if($pixels -lt 1500){throw ('Missing pose '+$record.id+' '+$view+' '+$frame)}
    $bounds+=@{x=$l;y=$t;width=$r-$l+1;height=$b-$t+1;opaquePixels=$pixels;sourceRect=@($sx,$sy,$cell,$cell)}
    $left=[Math]::Min($left,$l);$right=[Math]::Max($right,$r);$top=[Math]::Min($top,$t);$bottom=[Math]::Max($bottom,$b)
   }
   # One scale for every exposure: no independent pose fitting or artificial growth.
   $scale=[Math]::Min(1.0,[Math]::Min(244.0/($right-$left+1),244.0/($bottom-$top+1)))
   if(($right-$left+1)*$scale -gt 244.001 -or ($bottom-$top+1)*$scale -gt 244.001){throw 'Packing scale would crop the generated anatomy'}
   $tx=128-($left+$right+1)*.5*$scale;$ty=252-($bottom+1)*$scale
   for($frame=0;$frame -lt 4;$frame++){
    $image=$images[[Math]::Min($frame,$images.Count-1)];$rect=$bounds[$frame].sourceRect
    $tile=$image.Clone([Drawing.Rectangle]::new($rect[0],$rect[1],$rect[2],$rect[3]),[Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $index=$view*4+$frame;$dx=($index%8)*256;$dy=[int][Math]::Floor($index/8)*256
    $g.SetClip([Drawing.Rectangle]::new($dx,$dy,256,256))
    $g.DrawImage($tile,[Drawing.RectangleF]::new([single]($dx+$tx),[single]($dy+$ty),[single]($rect[2]*$scale),[single]($rect[3]*$scale)))
    $g.ResetClip();$tile.Dispose()
   }
   $registrations+=@{view=$views[$view];sourceBounds=$bounds;scale=$scale;translate=@($tx,$ty);groundPixel=252;calibrationPose='standing exposure zero'}
  }
  $atlas.Save((Join-Path $runtimeRoot ($record.id+'.png')),[Drawing.Imaging.ImageFormat]::Png)
  $review=[Drawing.Bitmap]::new(2048,1536);$rg=[Drawing.Graphics]::FromImage($review);$rg.Clear([Drawing.ColorTranslator]::FromHtml('#20353a'));$rg.DrawImageUnscaled($atlas,0,0)
  $review.Save((Join-Path $sourceRoot ($record.id+'-review.png')),[Drawing.Imaging.ImageFormat]::Png);$rg.Dispose();$review.Dispose()
  $manifest.clips+=@{id=$record.id;frames=44;sources=$sources;readyHold=($images.Count -eq 1);runtime=($record.id+'.png');registration=$registrations}
  Write-Output ('Packed '+$record.id+' 44 frames, 256px cells.')
 }finally{$g.Dispose();$atlas.Dispose();$images | ForEach-Object {$_.Dispose()}}
}
$manifest | ConvertTo-Json -Depth 25 | Set-Content (Join-Path $sourceRoot 'manifest.json') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $sourceRoot 'manifest.json') -Destination (Join-Path $root ('docs/art/hero-'+($Family -replace '/','-')+'-packing.json')) -Force
