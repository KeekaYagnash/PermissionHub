param(
 [ValidateSet('development','production')][string]$Environment='development',
 [switch]$Rotate
)
# Operator-run GitHub configuration only. No AWS calls; never prints the key.
$ErrorActionPreference='Stop'
$repository='KeekaYagnash/PermissionHub'
if(-not (Get-Command gh -ErrorAction SilentlyContinue)){throw 'Install GitHub CLI and run gh auth login first.'}
$listed=& gh secret list --repo $repository --env $Environment --json name
if($LASTEXITCODE -ne 0){throw 'Cannot inspect GitHub Environment secrets. Check gh authentication and repository/environment administration access.'}
$exists=@(($listed | ConvertFrom-Json) | Where-Object {$_.name -eq 'TF_PLAN_ENCRYPTION_KEY'}).Count -gt 0
if($exists -and -not $Rotate){throw 'TF_PLAN_ENCRYPTION_KEY already exists. If invalid, ensure no deployment/destroy runs are active, then rerun with -Rotate. Existing encrypted plans will require the old key.'}
if($Rotate){Write-Warning 'Rotation invalidates saved plans encrypted with the old key. Stop active/queued deployments and start a new workflow run after this operation.'}
$keyBytes=New-Object byte[] 32
$generator=[Security.Cryptography.RandomNumberGenerator]::Create()
try {
 $generator.GetBytes($keyBytes)
 $encoded=[Convert]::ToBase64String($keyBytes)
 $encoded | & gh secret set TF_PLAN_ENCRYPTION_KEY --repo $repository --env $Environment
 if($LASTEXITCODE -ne 0){throw 'Failed to store TF_PLAN_ENCRYPTION_KEY in GitHub.'}
 Write-Host "Stored TF_PLAN_ENCRYPTION_KEY in $repository / $Environment. Value was not printed or written to disk."
} finally {
 [Array]::Clear($keyBytes,0,$keyBytes.Length)
 $encoded=$null
 $generator.Dispose()
}
