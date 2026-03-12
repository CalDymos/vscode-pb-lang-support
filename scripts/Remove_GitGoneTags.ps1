git fetch origin --tags

$remoteTags = git ls-remote --tags --refs origin |
ForEach-Object {
    ($_ -split '\s+')[1] -replace '^refs/tags/', ''
}

git tag |
Where-Object { $_ -notin $remoteTags } |
ForEach-Object {
    Write-Host "Deleting tag $_"
    git tag -d $_
}