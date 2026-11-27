$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=Split-Path $PSScriptRoot -Parent
$family=Join-Path $root 'public/assets/sources/kin/hero/sprites/world/combat'
$out=[Drawing.Bitmap]::new(1000,1120);$g=[Drawing.Graphics]::FromImage($out);$g.Clear([Drawing.ColorTranslator]::FromHtml('#20353a'))
$g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font=[Drawing.Font]::new('Georgia',15)
try{
 $g.DrawString('Earlier v1 body         Softer v2 body          Earlier eyes              Natural attentive eyes',$font,[Drawing.Brushes]::White,12,10)
 $row=0
 foreach($id in @('combatReady','combatStalk','combatBow','combatLeap')){
  $y=40+$row*268;$g.DrawString($id,$font,[Drawing.Brushes]::White,12,$y)
  foreach($v in @(1,2)){
   $image=[Drawing.Bitmap]::new((Join-Path $family ('v'+$v+'/'+$id+'-review.png')))
   try{
    $g.DrawImage($image,[Drawing.Rectangle]::new(($v-1)*250,($y+24),240,240),0,0,192,192,[Drawing.GraphicsUnit]::Pixel)
    $g.DrawImage($image,[Drawing.Rectangle]::new((500+($v-1)*250),($y+24),240,240),42,50,110,110,[Drawing.GraphicsUnit]::Pixel)
   }finally{$image.Dispose()}
  };$row++
 }
 $out.Save((Join-Path $family 'v2/focus-comparison.png'),[Drawing.Imaging.ImageFormat]::Png)
}finally{$font.Dispose();$g.Dispose();$out.Dispose()}
