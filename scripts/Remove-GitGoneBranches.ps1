git fetch --prune
git branch -vv |
Where-Object { $_ -match '\[.*: gone\]' } |
ForEach-Object {
    $branch = ($_ -split '\s+')[1]
    Write-Host "Deleting branch $branch"
    git branch -D $branch
}