# Run from any directory. Copies references without modifying their source files.
$ErrorActionPreference = 'Stop'
$handoffRoot = $PSScriptRoot
$projectRoot = (Resolve-Path (Join-Path $handoffRoot '../..')).Path
$assetPaths = @(
    'actors/battle/hero-directions-low-v1.png',
    'actors/battle/hero-directions-high-v1.png',
    'actors/battle/hero-sitting-low-v1.png',
    'actors/battle/hero-sitting-high-v1.png',
    'actors/battle/mochi-directions-low-v1.png',
    'actors/battle/mochi-directions-high-v1.png',
    'actors/battle/dark-slime-directions-v1.png',
    'actors/hero.png',
    'actors/hero-sitting.png',
    'actors/hero-sitting-topdown.png',
    'actors/hero-standing-topdown.png',
    'actors/hero-sleeping.png',
    'actors/hero-sleeping-topdown.png',
    'actors/sources/hero-sleeping-atlas-v1.png',
    'actors/sources/hero-sitting-low-source-v1.png',
    'actors/sources/hero-sitting-high-source-v1.png',
    'biomes/sources/hero-den-atlas-v1.png',
    'biomes/sources/hero-den-atlas-v2.png',
    'biomes/hero-den-topdown-v2.png',
    'biomes/hero-den-standee-v2.png'
)
$notes = @(
    'actors/battle/README.md',
    'actors/battle/mochi-generation.md',
    'actors/battle/hero-sitting-generation.json',
    'actors/battle/hero-sitting-layout.json',
    'biomes/sources/hero-den-generation.json',
    'biomes/sources/hero-den-v2-generation.json'
)
$manifest = @()
foreach ($relative in ($assetPaths + $notes)) {
    $sourcePath = Join-Path $projectRoot "public/assets/$relative"
    $destinationPath = Join-Path $handoffRoot "reference-assets/$relative"
    New-Item -ItemType Directory -Path (Split-Path $destinationPath) -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    $item = [ordered]@{
        path = "reference-assets/$relative"
        source = "public/assets/$relative"
        bytes = (Get-Item -LiteralPath $sourcePath).Length
        sha256 = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    if ($relative.EndsWith('.png')) {
        $pngBytes = [System.IO.File]::ReadAllBytes($sourcePath)
        if ([BitConverter]::ToString($pngBytes[0..7]) -ne '89-50-4E-47-0D-0A-1A-0A') { throw "Invalid PNG: $relative" }
        $widthBytes = [byte[]]$pngBytes[16..19]; [Array]::Reverse($widthBytes)
        $heightBytes = [byte[]]$pngBytes[20..23]; [Array]::Reverse($heightBytes)
        $item.width = [BitConverter]::ToUInt32($widthBytes, 0)
        $item.height = [BitConverter]::ToUInt32($heightBytes, 0)
        $item.pngColorType = [int]$pngBytes[25]
    }
    $manifest += $item
}
$codePaths = @(
    'src/proto/directionalSprites.ts', 'src/proto/quadrupedSprite.ts',
    'src/proto/mochiSprite.ts', 'src/proto/directionalSpriteRig.ts',
    'src/proto/heroSittingSprite.ts', 'src/proto/heroSittingSprite.test.ts',
    'src/proto/art/heroSittingLayout.json',
    'src/proto/actorSpriteLibrary.ts', 'src/proto/battleSpriteAssets.ts',
    'src/proto/actorOrientation.ts', 'src/proto/components/TableActorSprite.tsx',
    'src/proto/directionalSprites.test.ts', 'src/proto/quadrupedSprite.test.ts',
    'tools/prepare-den-sprites.cjs', 'tools/prepare-hero-sitting.cjs', 'tools/hero-sitting-playwright.cjs', 'tools/hero-proportions-playwright.cjs',
    'tools/mochi-atlas-playwright.cjs', 'tools/actor-rig-playwright.cjs',
    'tools/directional-sprite-benchmark.cjs'
)
foreach ($relative in $codePaths) {
    # Reference test snapshots must not be collected as live Vitest project tests.
    $snapshotName = if ($relative.EndsWith('.test.ts')) { "$relative.txt" } else { $relative }
    $destinationPath = Join-Path $handoffRoot "reference-code/$snapshotName"
    New-Item -ItemType Directory -Path (Split-Path $destinationPath) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot $relative) -Destination $destinationPath -Force
}
$manifestDocument = [ordered]@{
    snapshotUtc = [DateTime]::UtcNow.ToString('o')
    notes = 'PNG dimensions and SHA256 measured from existing files. Alpha cleanliness and anatomical QA are not inferred from PNG headers. Code snapshots are reference material, not a runnable project.'
    files = $manifest
}
$manifestDocument | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $handoffRoot 'asset-manifest.json') -Encoding utf8
$zipPath = Join-Path $projectRoot 'artifacts/gemini-sprite-handoff.zip'
New-Item -ItemType Directory -Path (Split-Path $zipPath) -Force | Out-Null
Compress-Archive -Path (Join-Path $handoffRoot '*') -DestinationPath $zipPath -Force
Write-Output "Created $zipPath with $($assetPaths.Count) PNG references, $($notes.Count) generation notes and $($codePaths.Count) code references."
