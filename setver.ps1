$rootPackageJsonPath = '.\package.json'
$rootPackageJson = Get-Content $rootPackageJsonPath | ConvertFrom-Json
$rootVersion = $rootPackageJson.version

Get-ChildItem -Path '.\libs' -Filter package.json -Recurse -Exclude 'node_modules' | ForEach-Object {
    $subPackageJson = Get-Content $_.FullName | ConvertFrom-Json
    $subPackageJson.version = $rootVersion
    $subPackageJson | ConvertTo-Json -Depth 100 | Set-Content -Path $_.FullName
}
