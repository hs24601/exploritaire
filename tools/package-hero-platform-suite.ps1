$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$project = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $project 'artifacts/hero-platform-suite-v1.zip'
$stream = [IO.File]::Open($destination, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
$count = 0
function Add-PackFile([string]$source, [string]$entry) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $source, $entry.Replace('\','/'), [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    $script:count++
}
try {
    $runtime = Join-Path $project 'public/assets/runtime/characters/hero/platforming/suite-v1'
    foreach ($file in Get-ChildItem -LiteralPath $runtime -File -Recurse) {
        Add-PackFile $file.FullName ('assets/runtime/characters/hero/platforming/suite-v1/' + [IO.Path]::GetRelativePath($runtime, $file.FullName))
    }
    $sources = Join-Path $project 'public/assets/sources/characters/hero/platforming/suite-v1'
    foreach ($file in Get-ChildItem -LiteralPath $sources -File) {
        Add-PackFile $file.FullName ('sources/hero-platform-suite-v1/' + $file.Name)
    }
    foreach ($name in @('hero-platformer-sprites.html', 'hero-platform-player.mjs')) {
        Add-PackFile (Join-Path $PSScriptRoot $name) ('tools/' + $name)
    }
    Add-PackFile (Join-Path $project 'docs/art/hero-platform-suite-v1.md') 'README.md'
    foreach ($name in @('hero-platform-suite-v1-production.json', 'hero-platform-suite-v1-validation.json', 'hero-platform-idle-v1-correction.json')) {
        Add-PackFile (Join-Path $project ('docs/art/' + $name)) ('docs/' + $name)
    }
    foreach ($file in Get-ChildItem -LiteralPath (Join-Path $project 'artifacts/hero-platform-suite-v1') -File) {
        Add-PackFile $file.FullName ('previews/' + $file.Name)
    }
} finally {
    $archive.Dispose()
    $stream.Dispose()
}
$check = [IO.Compression.ZipFile]::OpenRead($destination)
try {
    if ($check.Entries.Count -ne $count) { throw 'Archive entry count mismatch' }
    $frames = @($check.Entries | Where-Object FullName -like 'assets/runtime/*/frames/*/*.png').Count
    if ($frames -ne 152) { throw "Expected 152 individual frames, found $frames" }
    [pscustomobject]@{Path=$destination;Files=$count;Frames=$frames;Megabytes=[Math]::Round((Get-Item -LiteralPath $destination).Length / 1MB,2)} | ConvertTo-Json
} finally { $check.Dispose() }
