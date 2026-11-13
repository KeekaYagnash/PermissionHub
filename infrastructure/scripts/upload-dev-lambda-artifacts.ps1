param(
 [string]$TerraformDirectory="infrastructure/terraform/environments/dev",
 [switch]$Upload
)
# Compatibility wrapper; CI uses the SAME build and deterministic packager.
$ErrorActionPreference='Stop'
$root=Resolve-Path (Join-Path $PSScriptRoot '../..')
Push-Location $root
try {
 npm run prisma:generate --workspace backend
 if($LASTEXITCODE -ne 0){throw 'Prisma generation failed'}
 npm run build:lambda --workspace backend
 if($LASTEXITCODE -ne 0){throw 'Lambda build failed'}
 npm run package:lambda --workspace backend
 if($LASTEXITCODE -ne 0){throw 'Lambda packaging failed'}
 $manifest=Get-Content -Raw artifacts/lambda-manifest.json | ConvertFrom-Json
 $refs=@{}
 $tfvars=Join-Path $root "$TerraformDirectory/terraform.tfvars"
 if(Test-Path -LiteralPath $tfvars){
  $match=Select-String -LiteralPath $tfvars -Pattern '^\s*lambda_artifact_bucket\s*=\s*"([^"]+)"' | Select-Object -First 1
  if($match){$refs.lambda_artifact_bucket=$match.Matches[0].Groups[1].Value}
 }
 foreach($property in $manifest.PSObject.Properties){
  $name=$property.Name;$artifact=$property.Value
  $refs["${name}_lambda_artifact_key"]=$artifact.key
  $refs["${name}_lambda_artifact_hash"]=$artifact.sourceHash
 }
 $refPath=Join-Path $root "$TerraformDirectory/lambda-artifacts.auto.tfvars.json"
 $refs | ConvertTo-Json | Set-Content -LiteralPath $refPath -Encoding utf8
 if($Upload){
  if(-not $refs.lambda_artifact_bucket){throw 'Artifact bucket missing from actual terraform.tfvars'}
  # The shared uploader enforces bucket versioning, create-only writes and integrity.
  node infrastructure/scripts/ci.mjs upload $refPath
  if($LASTEXITCODE -ne 0){throw 'Artifact upload failed'}
 }else{Write-Host 'Package-only: no AWS operations performed.'}
 Write-Host 'Routine deployments are performed by GitHub Actions and Terraform, not direct Lambda CLI updates.'
} finally {Pop-Location}
