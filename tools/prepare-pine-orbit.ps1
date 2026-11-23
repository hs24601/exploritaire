Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Bitmap]::new((Join-Path (Get-Location) 'public/assets/sources/environment/pine-orbit-v1/pine-orbit-atlas-v1.png'))
$frameWidth = [int]($source.Width / 4)
$frameHeight = [int]($source.Height / 2)
$frames = @()
for ($index = 0; $index -lt 8; $index++) {
  $rect = [System.Drawing.Rectangle]::new(($index % 4) * $frameWidth, [int][Math]::Floor($index / 4) * $frameHeight, $frameWidth, $frameHeight)
  $frame = $source.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $left = $frameWidth; $right = 0; $top = $frameHeight; $bottom = 0
  for ($y = 0; $y -lt $frameHeight; $y+=2) { for ($x=0; $x -lt $frameWidth; $x+=2) {
    if ($frame.GetPixel($x,$y).A -ge 96) { $left=[Math]::Min($left,$x); $right=[Math]::Max($right,$x+2); $top=[Math]::Min($top,$y); $bottom=[Math]::Max($bottom,$y+2) }
  } }
  $anchorX = ($left + $right) / 2
  # Root registration uses the bottom trunk, rather than asymmetric foliage.
  $rootLeft=$frameWidth; $rootRight=0
  for ($y=[Math]::Max($top,$bottom-12); $y -lt $bottom; $y++) { for ($x=$left; $x -lt $right; $x++) {
    if ($frame.GetPixel($x,$y).A -ge 96) { $rootLeft=[Math]::Min($rootLeft,$x); $rootRight=[Math]::Max($rootRight,$x) }
  } }
  if ($rootRight -gt $rootLeft) { $anchorX=($rootLeft+$rootRight)/2 }
  $h=$bottom-$top; $sy=$h/($frameHeight*.89); $sx=$h*.65/($frameWidth*.89)
  $frames += @{ yaw=$index*45; uv=@($sx,$sy,($anchorX/$frameWidth-.5*$sx),(1-$bottom/$frameHeight-.059*$sy)); anchor=@(($anchorX/$frameWidth),(1-($bottom-6)/$frameHeight)); bounds=@($left,$top,$right,$bottom) }
  $frame.Save((Join-Path (Get-Location) "public/assets/runtime/labs/pine-orbit-v1/pine-$index.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  $frame.Dispose()
}
$source.Dispose()
@{width=$frameWidth;height=$frameHeight;frames=$frames} | ConvertTo-Json -Depth 5 | Set-Content src/tooling/pineOrbitFrames.json
