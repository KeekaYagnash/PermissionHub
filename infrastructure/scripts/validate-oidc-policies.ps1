# IAM Access Analyzer validation is read-only; no resources are created/modified.
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'write-oidc-policies.ps1')
$root=Resolve-Path (Join-Path $PSScriptRoot '../..')
$errors=0
foreach($file in Get-ChildItem -LiteralPath (Join-Path $root 'artifacts/oidc/dev') -Filter '*.json'){
 $trust=$file.Name -like '*-trust.json'
 $arguments=@('accessanalyzer','validate-policy','--region','af-south-1','--policy-document',"file://$($file.FullName)",'--policy-type',$(if($trust){'RESOURCE_POLICY'}else{'IDENTITY_POLICY'}),'--output','json')
 if($trust){$arguments+=@('--validate-policy-resource-type','AWS::IAM::AssumeRolePolicyDocument')}
 $result=& aws @arguments | ConvertFrom-Json
 if($LASTEXITCODE -ne 0){throw "Access Analyzer could not validate $($file.Name)"}
 $count=@($result.findings | Where-Object findingType -eq 'ERROR').Count
 $errors+=$count
 Write-Host "$($file.Name): $count errors; $(@($result.findings).Count) total findings"
 $result.findings | Select-Object findingType,issueCode,findingDetails | Format-List
}
if($errors){throw "$errors IAM validation errors. Do not apply bootstrap."}
