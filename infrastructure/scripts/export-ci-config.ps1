param([ValidateSet('dev','prod')][string]$Environment='dev',[switch]$Fresh,[string]$RuntimePermissionsBoundaryArn)
$ErrorActionPreference='Stop'
$root=Resolve-Path (Join-Path $PSScriptRoot '../..')
$directory=Join-Path $root "infrastructure/terraform/environments/$Environment"
$source=Get-Content -Raw (Join-Path $directory 'variables.tf')
$names=[regex]::Matches($source,'variable\s+"([^"]+)"') | ForEach-Object {$_.Groups[1].Value} | Where-Object {$_ -notmatch 'lambda_artifact_(key|hash)$'}
$expression='jsonencode({'+(($names | ForEach-Object {"$_ = var.$_"}) -join ',')+'})'
Push-Location $directory
try {
 if(-not(Test-Path -LiteralPath 'terraform.tfvars')){throw 'Provide reviewed terraform.tfvars for this deployment, not the example file.'}
 $encoded=$expression | terraform console -var-file=terraform.tfvars
 if($LASTEXITCODE -ne 0){throw 'Terraform console failed. Initialize the existing remote backend first.'}
 $config=$encoded | ConvertFrom-Json
 $value=$config | ConvertFrom-Json
 if($RuntimePermissionsBoundaryArn){
  if($RuntimePermissionsBoundaryArn -notmatch '^arn:aws:iam::\d{12}:policy/.+') {throw 'Provide the externally managed runtime permissions boundary ARN, not credentials.'}
  $value.runtime_permissions_boundary_arn=$RuntimePermissionsBoundaryArn
 }
 if($Environment -eq 'dev' -and -not $value.runtime_permissions_boundary_arn){
  $bootstrap=Join-Path $root 'infrastructure/terraform/bootstrap/github-dev'
  if(Test-Path -LiteralPath (Join-Path $bootstrap 'terraform.tfstate')){
   $boundary=& terraform "-chdir=$bootstrap" output -raw runtime_permissions_boundary_arn
   if($LASTEXITCODE -ne 0){throw 'Unable to read the independently managed runtime boundary.'}
   $value.runtime_permissions_boundary_arn=$boundary.Trim()
  }elseif($Fresh){throw 'Provide runtime_permissions_boundary_arn in reviewed tfvars or -RuntimePermissionsBoundaryArn from the independently provisioned bootstrap. This exporter never provisions deployment roles.'}
 }
 # Print only reviewed configuration. No passwords/credentials belong in these variables.
 $value | ConvertTo-Json -Depth 20 -Compress
} finally {Pop-Location}
