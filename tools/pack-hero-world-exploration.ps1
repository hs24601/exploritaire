param([string]$Generation='artifacts/hero-world-exploration-generation-all.json',[string]$Family='world-exploration/v1')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=Split-Path $PSScriptRoot -Parent
if($Family -notmatch '^[a-z-]+/v[0-9]+$'){throw 'Invalid asset family'}
$sourceRoot=Join-Path $root ('public/assets/sources/characters/hero/'+$Family)
$runtimeRoot=Join-Path $root ('public/assets/runtime/characters/hero/'+$Family)
New-Item -ItemType Directory -Force $sourceRoot,$runtimeRoot | Out-Null
$data=Get-Content (Join-Path $root $Generation) -Raw | ConvertFrom-Json
$manifest=@{version=[int]($Family -replace '^.*/v','');generator=$data.tool;references=$data.references;columns=8;rows=6;cell=192;framesPerView=4;views=@('low-0','low-1','low-2','low-3','low-4','high-0','high-1','high-2','high-3','high-4','top-0');clips=@()}
# Mechanical packing only. Original alpha is copied, never keyed or segmented.
# Every view's four frames share one registration transform (no per-frame zoom).
foreach($record in $data.records){
 if($record.id -notmatch '^[a-zA-Z0-9]+$'){throw 'Invalid action ID'}
 $destination=Join-Path $sourceRoot ($record.id+'-source.png')
 Copy-Item -LiteralPath $record.path -Destination $destination -Force
 if($record.correction -and $record.initialPath){New-Item -ItemType Directory -Force (Join-Path $sourceRoot 'rejected') | Out-Null;Copy-Item -LiteralPath $record.initialPath -Destination (Join-Path $sourceRoot ('rejected/'+$record.id+'-paper-backing.png')) -Force}
 $image=[Drawing.Bitmap]::new($destination)
 $atlas=[Drawing.Bitmap]::new(1536,1152,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
 $g=[Drawing.Graphics]::FromImage($atlas);$g.Clear([Drawing.Color]::Transparent)
 $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
 $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
 $cell=[int]($image.Width/8);$registrations=@();$cuts=@{};$xCuts=@{}
 try {
  if($image.Height -ne $cell*6){throw ('Non-square source cells: '+$record.id)}
  if($image.GetPixel(0,0).A -gt 2){throw ('Backing alpha requires ImageGen correction: '+$record.id)}
  # Locate empty horizontal gutters near nominal grid boundaries. Generated
  # paws can extend a few pixels across the nominal line; crop at the actual
  # gutter so the complete paw stays in its frame and no neighbour leaks in.
  for($column=0;$column -lt 8;$column++){
   $lines=@(0)
   for($row=1;$row -lt 6;$row++){
    $nominal=$row*$cell;$best=$nominal;$bestCount=[int]::MaxValue
    foreach($offset in (0..24 | ForEach-Object {if($_ -eq 0){0}else{$_; -$_}})){
     $y=$nominal+$offset;$count=0
     for($x=$column*$cell;$x -lt ($column+1)*$cell;$x++){if($image.GetPixel($x,$y).A -gt 32){$count++}}
     if($count -lt $bestCount){$best=$y;$bestCount=$count};if($count -eq 0){break}
    };$lines+=$best
   };$lines+=$image.Height;$cuts[$column]=$lines
  }
  for($row=0;$row -lt 6;$row++){
   $lines=@(0)
   for($column=1;$column -lt 8;$column++){
    $nominal=$column*$cell;$best=$nominal;$bestCount=[int]::MaxValue
    foreach($offset in (0..18 | ForEach-Object {if($_ -eq 0){0}else{$_; -$_}})){
     $x=$nominal+$offset;$count=0
     for($y=$row*$cell;$y -lt ($row+1)*$cell;$y++){if($image.GetPixel($x,$y).A -gt 32){$count++}}
     if($count -lt $bestCount){$best=$x;$bestCount=$count};if($count -eq 0){break}
    };$lines+=$best
   };$lines+=$image.Width;$xCuts[$row]=$lines
  }
  for($view=0;$view -lt 11;$view++){
   $left=$cell;$right=0;$top=$cell;$bottom=0;$bounds=@()
   for($frame=0;$frame -lt 4;$frame++){
    $index=$view*4+$frame;$column=$index%8;$row=[int][Math]::Floor($index/8);$sx=$column*$cell;$sy=$row*$cell
    $y0=$cuts[$column][$row]-$sy;$y1=$cuts[$column][$row+1]-$sy
    $x0=$xCuts[$row][$column]-$sx;$x1=$xCuts[$row][$column+1]-$sx
    $l=$cell;$r=0;$t=$cell;$b=0;$count=0
    for($y=$y0;$y -lt $y1;$y++){for($x=$x0;$x -lt $x1;$x++){
     if($image.GetPixel($sx+$x,$sy+$y).A -gt 32){$l=[Math]::Min($l,$x);$r=[Math]::Max($r,$x);$t=[Math]::Min($t,$y);$b=[Math]::Max($b,$y);$count++}
    }}
    if($count -lt 500){throw ('Missing pose '+$record.id+' '+$index)}
    $bounds+=@{x=$l;y=$t;width=$r-$l+1;height=$b-$t+1;opaquePixels=$count;sourceRect=@(($sx+$x0),($sy+$y0),($x1-$x0),($y1-$y0))}
    $left=[Math]::Min($left,$l);$right=[Math]::Max($right,$r);$top=[Math]::Min($top,$t);$bottom=[Math]::Max($bottom,$b)
   }
   # Leave full transparent gutters, register the lowest planted frame at y=189.
   $scale=[Math]::Min(1.0,184.0/($right-$left+1));$scale=[Math]::Min($scale,184.0/($bottom-$top+1))
   if(($right-$left+1)*$scale -gt 184.001 -or ($bottom-$top+1)*$scale -gt 184.001){throw 'Packing scale would crop the generated anatomy'}
   $tx=96-($left+$right+1)*.5*$scale;$ty=190-($bottom+1)*$scale
   for($frame=0;$frame -lt 4;$frame++){
    $index=$view*4+$frame;$sx=($index%8)*$cell;$sy=[int][Math]::Floor($index/8)*$cell
    $rect=$bounds[$frame].sourceRect;$shift=$rect[1]-$sy;$shiftX=$rect[0]-$sx
    $tile=$image.Clone([Drawing.Rectangle]::new($rect[0],$rect[1],$rect[2],$rect[3]),[Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $dx=($index%8)*192;$dy=[int][Math]::Floor($index/8)*192
    $g.SetClip([Drawing.Rectangle]::new($dx,$dy,192,192))
    $g.DrawImage($tile,[Drawing.RectangleF]::new([single]($dx+$tx+$shiftX*$scale),[single]($dy+$ty+$shift*$scale),[single]($rect[2]*$scale),[single]($rect[3]*$scale)))
    $g.ResetClip();$tile.Dispose()
   }
   $registrations+=@{view=$manifest.views[$view];sourceBounds=$bounds;scale=$scale;translate=@($tx,$ty);groundPixel=190}
  }
  $atlas.Save((Join-Path $runtimeRoot ($record.id+'.png')),[Drawing.Imaging.ImageFormat]::Png)
  $review=[Drawing.Bitmap]::new(1536,1152);$rg=[Drawing.Graphics]::FromImage($review)
  $rg.Clear([Drawing.ColorTranslator]::FromHtml('#20353a'));$rg.DrawImageUnscaled($atlas,0,0)
  $review.Save((Join-Path $sourceRoot ($record.id+'-review.png')),[Drawing.Imaging.ImageFormat]::Png);$rg.Dispose();$review.Dispose()
  $manifest.clips+=@{id=$record.id;frames=44;source=($record.id+'-source.png');sourceSha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLower();sourceDimensions=@($image.Width,$image.Height);runtime=($record.id+'.png');prompt=$record.prompt;correction=$record.correction;registration=$registrations}
  Write-Output ('Packed '+$record.id+' (44 frames).')
 } finally {$g.Dispose();$atlas.Dispose();$image.Dispose()}
}
$manifest | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $sourceRoot 'manifest.json') -Encoding utf8
Copy-Item -LiteralPath (Join-Path $sourceRoot 'manifest.json') -Destination (Join-Path $root ('docs/art/hero-'+($Family -replace '/','-')+'-packing.json')) -Force
