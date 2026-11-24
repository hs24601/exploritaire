$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=Split-Path $PSScriptRoot -Parent
$sheet=[Drawing.Bitmap]::new(1536,730)
$g=[Drawing.Graphics]::FromImage($sheet);$g.Clear([Drawing.ColorTranslator]::FromHtml('#20353a'))
$font=[Drawing.Font]::new('Arial',14);$brush=[Drawing.Brushes]::White
$row=0
foreach($id in @('combatReady','combatStalk','combatBow','combatLeap','yawn')){
 $family=if($id -eq 'yawn'){'world-exploration/v2'}else{'world-combat/v3'}
 $image=[Drawing.Bitmap]::new((Join-Path $root ('public/assets/runtime/characters/hero/'+$family+'/'+$id+'.png')))
 $g.DrawString($id,$font,$brush,4,$row*146)
 for($view=0;$view -lt 3;$view++){for($frame=0;$frame -lt 4;$frame++){
  $index=$view*4+$frame;$source=[Drawing.Rectangle]::new(($index%8)*256,[int][Math]::Floor($index/8)*256,256,256)
  $g.DrawImage($image,[Drawing.Rectangle]::new(($view*4+$frame)*128,$row*146+18,128,128),$source,[Drawing.GraphicsUnit]::Pixel)
 }}
 $image.Dispose();$row++
}
$sheet.Save((Join-Path $root 'artifacts/hero-world-refresh-review.png'),[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$sheet.Dispose();$font.Dispose()
