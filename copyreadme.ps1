$sourceFile = '.\README.md'
$destinationDirectory = '.\libs'

Get-ChildItem -Path $destinationDirectory -Recurse -Directory | ForEach-Object {
    $destinationFile = Join-Path $_.FullName 'README.md'
    Copy-Item $sourceFile -Destination $destinationFile -Force
}

$sourceFile = '.\LICENSE'

Get-ChildItem -Path $destinationDirectory -Recurse -Directory | ForEach-Object {
    $destinationFile = Join-Path $_.FullName (Split-Path $sourceFile -Leaf)
    Copy-Item $sourceFile -Destination $destinationFile -Force
}
