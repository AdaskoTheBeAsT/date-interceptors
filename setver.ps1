$rootPackageJsonPath = '.\package.json'
$rootPackageJson = Get-Content $rootPackageJsonPath -Raw | ConvertFrom-Json
$rootVersion = $rootPackageJson.version

Get-ChildItem -Path '.\libs' -Filter package.json -Recurse -Exclude 'node_modules' | ForEach-Object {
    $filePath = $_.FullName
    node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('$($filePath.Replace('\','/'))', 'utf8')); pkg.version = '$rootVersion'; fs.writeFileSync('$($filePath.Replace('\','/'))', JSON.stringify(pkg, null, 2) + '\n');"
}
