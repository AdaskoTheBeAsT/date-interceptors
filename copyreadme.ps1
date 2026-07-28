# Fans LICENSE out to every library and makes sure each library has a README.
# Package-specific READMEs (libs/<lib>/README.md) are authored per package and
# are never overwritten; the root README is only used as a fallback for a
# library that has none yet.
# Usage: .\copyreadme.ps1

$sourceReadme = '.\README.md'
$sourceLicense = '.\LICENSE'
$destinationDirectory = '.\libs'

Write-Host 'Syncing LICENSE (and missing READMEs) to all libraries...' -ForegroundColor Cyan

$licenseCount = 0
$readmeFallbackCount = 0
$readmeOwnCount = 0

# Get only direct subdirectories of libs (the library folders)
Get-ChildItem -Path $destinationDirectory -Directory | ForEach-Object {
    $libDir = $_.FullName
    $libName = $_.Name

    # Check if it's a valid library directory (has src folder or package.json)
    if ((Test-Path (Join-Path $libDir 'src')) -or (Test-Path (Join-Path $libDir 'package.json'))) {
        # Copy LICENSE
        $destLicense = Join-Path $libDir 'LICENSE'
        Copy-Item $sourceLicense -Destination $destLicense -Force
        Write-Host "  Copied LICENSE to $libName" -ForegroundColor Green
        $script:licenseCount++

        # Keep the package-specific README; only fall back to the root one
        $destReadme = Join-Path $libDir 'README.md'
        if (Test-Path $destReadme) {
            Write-Host "  Kept package README in $libName" -ForegroundColor DarkGray
            $script:readmeOwnCount++
        }
        else {
            Copy-Item $sourceReadme -Destination $destReadme -Force
            Write-Host "  No package README in $libName - copied root README" -ForegroundColor Yellow
            $script:readmeFallbackCount++
        }
    }
}

Write-Host "`nLICENSE copied to $licenseCount libraries" -ForegroundColor Cyan
Write-Host "READMEs: $readmeOwnCount package-specific, $readmeFallbackCount from root fallback" -ForegroundColor Cyan
