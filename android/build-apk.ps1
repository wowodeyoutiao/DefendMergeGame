param(
    [string]$AndroidRoot = 'C:\Program Files\Unity\Hub\Editor\2022.3.30f1c1\Editor\Data\PlaybackEngines\AndroidPlayer'
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$javaHome = Join-Path $AndroidRoot 'OpenJDK'
$sdk = Join-Path $AndroidRoot 'SDK'
$buildTools = Join-Path $sdk 'build-tools\32.0.0'
$platformJar = Join-Path $sdk 'platforms\android-34\android.jar'
$java = Join-Path $javaHome 'bin\java.exe'
$javac = Join-Path $javaHome 'bin\javac.exe'
$aapt = Join-Path $buildTools 'aapt.exe'
$zipalign = Join-Path $buildTools 'zipalign.exe'
$d8 = Join-Path $buildTools 'lib\d8.jar'
$apksigner = Join-Path $buildTools 'lib\apksigner.jar'
foreach ($tool in @($java, $javac, $aapt, $zipalign, $d8, $apksigner, $platformJar)) {
    if (!(Test-Path -LiteralPath $tool)) { throw "Required Android tool not found: $tool" }
}

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File failed with exit code $LASTEXITCODE" }
}

$build = Join-Path $project ('tmp\android-build-' + [guid]::NewGuid().ToString('N'))
$assets = Join-Path $build 'assets'
$resources = Join-Path $build 'res'
$classes = Join-Path $build 'classes'
$dex = Join-Path $build 'dex'
$output = Join-Path $project 'output\android'
$signing = Join-Path $PSScriptRoot '.local'
foreach ($folder in @($assets, $resources, $classes, $dex, $output, $signing)) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
}

foreach ($entry in @('index.html', 'app.js', 'safe-area.js', 'styles.css', 'theme.css')) {
    Copy-Item -LiteralPath (Join-Path $project $entry) -Destination $assets
}
$public = Join-Path $project 'public'
$extensions = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.mp3', '.ogg', '.wav')
Get-ChildItem -LiteralPath $public -Recurse -File | Where-Object { $_.Extension -in $extensions } | ForEach-Object {
    $relative = $_.FullName.Substring($project.Length + 1)
    $destination = Join-Path $assets $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $destination
}
Copy-Item -Path (Join-Path $PSScriptRoot 'res\*') -Destination $resources -Recurse
New-Item -ItemType Directory -Path (Join-Path $resources 'drawable') | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'public\assets\hero.png') -Destination (Join-Path $resources 'drawable\app_icon.png')

$unsigned = Join-Path $build 'unsigned.apk'
Invoke-Checked $aapt @('package', '-f', '-M', (Join-Path $PSScriptRoot 'AndroidManifest.xml'), '-S', $resources, '-A', $assets, '-I', $platformJar, '-F', $unsigned)
$sources = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
Invoke-Checked $javac (@('-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', $platformJar, '-d', $classes) + $sources)
$compiled = @(Get-ChildItem -LiteralPath $classes -Recurse -Filter '*.class' | ForEach-Object { $_.FullName })
Invoke-Checked $java (@('-cp', $d8, 'com.android.tools.r8.D8', '--lib', $platformJar, '--min-api', '26', '--output', $dex) + $compiled)
Push-Location $dex
try {
    Invoke-Checked $aapt @('add', $unsigned, 'classes.dex')
} finally {
    Pop-Location
}
$aligned = Join-Path $build 'aligned.apk'
Invoke-Checked $zipalign @('-f', '4', $unsigned, $aligned)
$keystore = Join-Path $signing 'playtest.keystore'
if (!(Test-Path -LiteralPath $keystore)) {
    Invoke-Checked (Join-Path $javaHome 'bin\keytool.exe') @('-genkeypair', '-noprompt', '-keystore', $keystore, '-storepass', 'android', '-keypass', 'android', '-alias', 'playtest', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '3650', '-dname', 'CN=Defend Merge Local Playtest,OU=Playtest,O=Local Development,C=CN')
}
$apk = Join-Path $output 'DefendMerge-1.0.0-playtest.apk'
Invoke-Checked $java @('-jar', $apksigner, 'sign', '--ks', $keystore, '--ks-key-alias', 'playtest', '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', $apk, $aligned)
Invoke-Checked $java @('-jar', $apksigner, 'verify', '--verbose', $apk)
Invoke-Checked $zipalign @('-c', '4', $apk)
Invoke-Checked $aapt @('dump', 'badging', $apk)
Get-Item -LiteralPath $apk | Select-Object FullName, Length
Get-FileHash -LiteralPath $apk -Algorithm SHA256
