$sourceFile = '.\README.md'
$destinationDirectory = '.\packages'

Get-ChildItem -Path $destinationDirectory -Recurse -Directory | ForEach-Object {
    $destinationFile = Join-Path $_.FullName 'README.md'
    Copy-Item $sourceFile -Destination $destinationFile -Force
}
