$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$data=Get-Content artifacts/hero-world-exploration-generation-all.json -Raw | ConvertFrom-Json
foreach($r in $data.records){
 $b=[Drawing.Bitmap]::new($r.path)
 $cell=$b.Width/8
 $points=@(@(0,0),@(($b.Width-1),0),@(0,($b.Height-1)),@(($b.Width-1),($b.Height-1)),@([int]($cell*7.5),[int]($cell*5.5)))
 $alpha=@();foreach($p in $points){$alpha+=$b.GetPixel([int]$p[0],[int]$p[1]).A}
 Write-Output ($r.id+' '+$b.Width+'x'+$b.Height+' alpha='+($alpha -join ','))
 $b.Dispose()
}
