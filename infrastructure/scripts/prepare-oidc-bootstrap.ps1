param([string]$Repository='KeekaYagnash/PermissionHub')
# Discovery and local files only. Never applies Terraform or changes AWS.
$ErrorActionPreference='Stop'
$root=Resolve-Path (Join-Path $PSScriptRoot '../..')
$directory=Join-Path $root 'infrastructure/terraform/bootstrap/github-dev'
function Read-Aws([string[]]$Arguments,[string]$MissingPattern){
 $result=& aws @Arguments 2>&1
 if($LASTEXITCODE -eq 0){if($result){return ($result -join "`n" | ConvertFrom-Json)};return $true}
 $message=$result -join "`n"
 if($MissingPattern -and $message -match $MissingPattern){return $null}
 throw "Read-only discovery failed; refusing to treat an authorization/network error as a missing resource: $message"
}
$identity=Read-Aws @('sts','get-caller-identity','--region','af-south-1','--output','json') ''
if($identity.Account -ne '143671530412'){throw 'Expected account 143671530412. No bootstrap configuration was generated.'}
if($Repository -cne 'KeekaYagnash/PermissionHub'){throw 'This bootstrap is scoped to KeekaYagnash/PermissionHub.'}
$statePath=Join-Path $directory 'terraform.tfstate'
$state=if(Test-Path -LiteralPath $statePath){Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json}else{$null}
function Is-Managed($Type,$Name,$Key=$null){
 foreach($resource in $state.resources){if($resource.type -eq $Type -and $resource.name -eq $Name){foreach($instance in $resource.instances){if($null -eq $Key -or $instance.index_key -eq $Key){return $true}}}}
 return $false
}
$provider=Read-Aws @('iam','get-open-id-connect-provider','--open-id-connect-provider-arn','arn:aws:iam::143671530412:oidc-provider/token.actions.githubusercontent.com','--output','json') 'NoSuchEntity'
if($provider -and 'sts.amazonaws.com' -notin $provider.ClientIDList){throw 'Existing OIDC provider lacks sts.amazonaws.com audience. Review it explicitly; it will not be replaced.'}
$config=@{create_oidc_provider=((-not $provider) -or (Is-Managed 'aws_iam_openid_connect_provider' 'github'));github_repository=$Repository}
foreach($item in @(@{Name='permissionhub-dev-bucket';Variable='create_state_bucket';Address='state'},@{Name='permissionhub-dev-lambda-artifacts';Variable='create_artifact_bucket';Address='artifacts'})){
 $exists=Read-Aws @('s3api','head-bucket','--bucket',$item.Name,'--expected-bucket-owner','143671530412','--region','af-south-1','--output','json') '404|Not Found|NoSuchBucket'
 $config[$item.Variable]=((-not $exists) -or (Is-Managed 'aws_s3_bucket' $item.Address))
}
$lock=Read-Aws @('dynamodb','describe-table','--table-name','permissionhub-state-lock','--region','af-south-1','--output','json') 'ResourceNotFoundException'
if($lock -and (@($lock.Table.KeySchema).Count -ne 1 -or $lock.Table.KeySchema[0].AttributeName -ne 'LockID' -or $lock.Table.KeySchema[0].KeyType -ne 'HASH' -or -not @($lock.Table.AttributeDefinitions | Where-Object {$_.AttributeName -eq 'LockID' -and $_.AttributeType -eq 'S'}).Count)){throw 'Existing lock table must have a single string HASH key named LockID.'}
$config.create_lock_table=((-not $lock) -or (Is-Managed 'aws_dynamodb_table' 'locks'))
$imports=[Collections.Generic.List[string]]::new()
foreach($kind in @('terraform','backend','frontend')){
 $name="permissionhub-github-$kind-dev"
 $role=Read-Aws @('iam','get-role','--role-name',$name,'--output','json') 'NoSuchEntity'
 if($role){
  if($role.Role.PermissionsBoundary){throw "Existing $name has a permissions boundary. Preserve/review it explicitly before adopting the role."}
  $attached=Read-Aws @('iam','list-attached-role-policies','--role-name',$name,'--output','json') ''
  $inline=Read-Aws @('iam','list-role-policies','--role-name',$name,'--output','json') ''
  $expected=if($kind -eq 'terraform'){@('state','network','identity','platform','discovery') | ForEach-Object {"arn:aws:iam::143671530412:policy/permissionhub-github-terraform-$_-dev"}}else{@("arn:aws:iam::143671530412:policy/permissionhub-github-$kind-dev")}
  if(@($inline.PolicyNames | Where-Object {$_ -ne 'permissionhub-github-storage-full-access-dev'}).Count -or @($attached.AttachedPolicies | Where-Object {$_.PolicyArn -notin $expected}).Count){throw "Existing $name has unreviewed additional policies. Do not assume least privilege or silently detach them; review before adoption."}
  if('permissionhub-github-storage-full-access-dev' -in $inline.PolicyNames -and -not (Is-Managed 'aws_iam_role_policy' 'storage_full_access' $kind)){
   $imports.Add("import {`n  to = aws_iam_role_policy.storage_full_access[`"$kind`"]`n  id = `"${name}:permissionhub-github-storage-full-access-dev`"`n}")
  }
 }
 if($role -and -not (Is-Managed 'aws_iam_role' 'deploy' $kind)){$imports.Add("import {`n  to = aws_iam_role.deploy[`"$kind`"]`n  id = `"$name`"`n}")}
}
foreach($kind in @('terraform-state','terraform-network','terraform-identity','terraform-platform','terraform-discovery','backend','frontend','runtime-boundary')){
 $arn="arn:aws:iam::143671530412:policy/permissionhub-github-$kind-dev"
 $policy=Read-Aws @('iam','get-policy','--policy-arn',$arn,'--output','json') 'NoSuchEntity'
 $resource=if($kind -eq 'runtime-boundary'){'runtime_boundary'}else{'deploy'}
 $key=if($kind -eq 'runtime-boundary'){$null}else{$kind}
 if($policy -and -not (Is-Managed 'aws_iam_policy' $resource $key)){
  $address=if($null -eq $key){'aws_iam_policy.runtime_boundary'}else{"aws_iam_policy.deploy[`"$key`"]"}
  $imports.Add("import {`n  to = $address`n  id = `"$arn`"`n}")
 }
}
$config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $directory 'bootstrap.auto.tfvars.json') -Encoding utf8
($imports -join "`n`n") | Set-Content -LiteralPath (Join-Path $directory 'imports.generated.tf') -Encoding utf8
Write-Host 'Read-only discovery complete. Creation flags reflect absence OR existing bootstrap ownership.'
$config | Format-Table -AutoSize
Write-Host 'Review bootstrap.auto.tfvars.json and imports.generated.tf, then run Terraform plan. Nothing was applied.'
