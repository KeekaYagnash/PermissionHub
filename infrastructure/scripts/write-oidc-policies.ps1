param(
 [ValidateSet('dev')][string]$Environment='dev',
 [string]$Repository='KeekaYagnash/PermissionHub',
 [string]$StateBucket='permissionhub-dev-bucket',
 [string]$StateKey='permisionhub/dev/backend',
 [string]$LockTable='permissionhub-state-lock',
 [string]$ArtifactBucket='permissionhub-dev-lambda-artifacts',
 [string]$Region='af-south-1'
)
# Render the SAME policies used by bootstrap Terraform, without application outputs.
$ErrorActionPreference='Stop'
$root=Resolve-Path (Join-Path $PSScriptRoot '../..')
$directory=Join-Path $root 'infrastructure/terraform/bootstrap/github-dev'
Push-Location $directory
try {
 $expression='jsonencode({trust=local.trust_policy,policies=local.role_policies,boundary=local.runtime_boundary})'
 $arguments=@('console',"-var=github_repository=$Repository","-var=state_bucket=$StateBucket","-var=state_key=$StateKey","-var=lock_table=$LockTable","-var=artifact_bucket=$ArtifactBucket","-var=aws_region=$Region")
 $encoded=$expression | & terraform @arguments
 if($LASTEXITCODE -ne 0){throw 'Initialize the separate bootstrap Terraform root before rendering policies.'}
 $documents=($encoded | ConvertFrom-Json) | ConvertFrom-Json
} finally {Pop-Location}
$out=Join-Path $root 'artifacts/oidc/dev'
New-Item -ItemType Directory -Path $out -Force | Out-Null
foreach($name in @('terraform','backend','frontend')){$documents.trust | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $out "permissionhub-github-$name-dev-trust.json") -Encoding utf8}
foreach($property in $documents.policies.PSObject.Properties){$property.Value | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $out "$($property.Name)-policy.json") -Encoding utf8}
$documents.boundary | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $out 'runtime-boundary-policy.json') -Encoding utf8
Write-Host "Rendered policies to $out. No application state or live AWS writes required."
