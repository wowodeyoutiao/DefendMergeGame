param(
    [string]$Name = ('DefendMerge-Playtest-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip'),
    [switch]$SkipApk
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
if ([IO.Path]::GetFileName($Name) -ne $Name -or !($Name.EndsWith('.zip'))) {
    throw 'Name must be a ZIP filename without a directory.'
}
$destination = Join-Path $project $Name
$files = @('index.html', 'app.js', 'safe-area.js', 'styles.css', 'theme.css', 'README.md', 'assets-review.html', 'forge-preview.html') |
    Where-Object { Test-Path -LiteralPath (Join-Path $project $_) } |
    ForEach-Object { Get-Item -LiteralPath (Join-Path $project $_) }
foreach ($directory in @('public', 'docs', 'tools', 'android', 'asset-contact-sheets', 'outputs')) {
    $files += Get-ChildItem -LiteralPath (Join-Path $project $directory) -Recurse -File -Force |
        Where-Object { $_.FullName -notmatch '[\\/]\.local[\\/]|[\\/]__pycache__[\\/]' }
}
$apk = Join-Path $project 'output\android\DefendMerge-1.0.0-playtest.apk'
if (!$SkipApk -and (Test-Path -LiteralPath $apk)) { $files += Get-Item -LiteralPath $apk }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [IO.File]::Open($destination, [IO.FileMode]::CreateNew)
$archive = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($project.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $archive.Dispose()
    $stream.Dispose()
}

$archive = [IO.Compression.ZipFile]::OpenRead($destination)
try {
    if ($archive.Entries.Count -ne $files.Count) { throw 'Archive entry count mismatch.' }
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($project.Length + 1).Replace('\', '/')
        $entry = $archive.GetEntry($relative)
        if (!$entry -or $entry.Length -ne $file.Length) { throw "Invalid ZIP entry: $relative" }
        $entryStream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try {
            $actual = [BitConverter]::ToString($sha.ComputeHash($entryStream)).Replace('-', '')
            $expected = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
            if ($actual -ne $expected) { throw "Archive hash mismatch: $relative" }
        } finally {
            $entryStream.Dispose()
            $sha.Dispose()
        }
    }
    Write-Output "Verified $($archive.Entries.Count) archived files."
} finally {
    $archive.Dispose()
}
Get-Item -LiteralPath $destination | Select-Object FullName, Length
Get-FileHash -LiteralPath $destination -Algorithm SHA256
