param(
  [string]$TerraformDirectory = "infrastructure/terraform/environments/dev",
  [switch]$Upload
)

$ErrorActionPreference = "Stop"

$lambdaUnzippedLimitBytes = 262144000
$warningThresholdBytes = 150MB
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$tfDir = Resolve-Path (Join-Path $repoRoot $TerraformDirectory)
$tfvarsPath = Join-Path $tfDir "terraform.tfvars"
$packageRoot = Join-Path $repoRoot "backend\lambda-dist\packages"
$artifactDir = Join-Path $repoRoot "artifacts"

if (-not (Test-Path -LiteralPath $tfvarsPath)) {
  throw "terraform.tfvars not found at $tfvarsPath"
}

function Get-TfvarsString {
  param([string]$Name)

  $match = Select-String -LiteralPath $tfvarsPath -Pattern "^\s*$Name\s*=\s*`"([^`"]+)`"" | Select-Object -First 1
  if (-not $match) {
    throw "Missing required Terraform variable '$Name' in $tfvarsPath"
  }

  return $match.Matches[0].Groups[1].Value
}

function Get-DirectorySize {
  param([string]$Path)

  $files = Get-ChildItem -LiteralPath $Path -Recurse -File
  $sum = ($files | Measure-Object -Property Length -Sum).Sum
  if ($null -eq $sum) { return 0 }
  return [int64]$sum
}

function Format-Bytes {
  param([int64]$Bytes)

  if ($Bytes -ge 1GB) { return "{0:n2} GB" -f ($Bytes / 1GB) }
  if ($Bytes -ge 1MB) { return "{0:n2} MB" -f ($Bytes / 1MB) }
  if ($Bytes -ge 1KB) { return "{0:n2} KB" -f ($Bytes / 1KB) }
  return "$Bytes B"
}

function Convert-ToBase64Sha256 {
  param([string]$Path)

  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
      return [Convert]::ToBase64String($sha256.ComputeHash($stream))
    }
    finally {
      $stream.Dispose()
    }
  }
  finally {
    $sha256.Dispose()
  }
}

$bucket = Get-TfvarsString "lambda_artifact_bucket"
$artifacts = @(
  @{ Name = "api"; Key = Get-TfvarsString "api_lambda_artifact_key"; Handler = "dist/lambda/api.handler" }
  @{ Name = "provisioning"; Key = Get-TfvarsString "provisioning_lambda_artifact_key"; Handler = "dist/lambda/provisioning.handler" }
  @{ Name = "expiry"; Key = Get-TfvarsString "expiry_lambda_artifact_key"; Handler = "dist/lambda/expiry.handler" }
  @{ Name = "migration"; Key = Get-TfvarsString "migration_lambda_artifact_key"; Handler = "dist/lambda/migration.handler" }
)

$expectedBucket = "permissionhub-dev-lambda-artifacts"
$expectedKeys = @{
  api = "permissionhub-api-demo.zip"
  provisioning = "permissionhub-provisioning-demo.zip"
  expiry = "permissionhub-expiry-demo.zip"
  migration = "permissionhub-db-migration-demo.zip"
}

if ($bucket -ne $expectedBucket) {
  throw "terraform.tfvars lambda_artifact_bucket must be '$expectedBucket'. Current value: '$bucket'."
}
foreach ($artifact in $artifacts) {
  if ($artifact.Key -ne $expectedKeys[$artifact.Name]) {
    throw "terraform.tfvars key for $($artifact.Name) must be '$($expectedKeys[$artifact.Name])'. Current value: '$($artifact.Key)'."
  }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

Push-Location $repoRoot
try {
  npm run prisma:generate --workspace backend
  npm run build:lambda --workspace backend

  if (Test-Path -LiteralPath $artifactDir) {
    Remove-Item -LiteralPath $artifactDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $artifactDir | Out-Null

  $results = @()
  $artifactHashes = @{}
  foreach ($artifact in $artifacts) {
    $sourceDir = Join-Path $packageRoot $artifact.Name
    if (-not (Test-Path -LiteralPath $sourceDir)) {
      throw "Missing Lambda package directory: $sourceDir"
    }

    $handlerFile = Join-Path $sourceDir (($artifact.Handler -replace "\.handler$", ".js") -replace "/", "\")
    if (-not (Test-Path -LiteralPath $handlerFile)) {
      throw "Handler file for $($artifact.Name) was not found at $handlerFile"
    }

    $uncompressedBytes = Get-DirectorySize $sourceDir
    if ($uncompressedBytes -ge $lambdaUnzippedLimitBytes) {
      throw "$($artifact.Name) package is too large uncompressed: $(Format-Bytes $uncompressedBytes). Lambda limit is $(Format-Bytes $lambdaUnzippedLimitBytes)."
    }
    if ($uncompressedBytes -ge $warningThresholdBytes) {
      Write-Warning "$($artifact.Name) package is close to the Lambda unzipped limit: $(Format-Bytes $uncompressedBytes)."
    }

    $zipPath = Join-Path $artifactDir $artifact.Key
    if (Test-Path -LiteralPath $zipPath) {
      Remove-Item -LiteralPath $zipPath -Force
    }

    Compress-Archive -Path (Join-Path $sourceDir "*") -DestinationPath $zipPath -Force
    $zipBytes = (Get-Item -LiteralPath $zipPath).Length
    $artifactHashes["$($artifact.Name)_lambda_artifact_hash"] = Convert-ToBase64Sha256 $zipPath
    $handlerZipPath = ($artifact.Handler -replace "\.handler$", ".js") -replace "\\", "/"

    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
      $zipUncompressedBytes = ($zip.Entries | Measure-Object -Property Length -Sum).Sum
      $zipHandler = $zip.Entries | Where-Object { $_.FullName -eq $handlerZipPath } | Select-Object -First 1
      if (-not $zipHandler) {
        throw "Packaged ZIP for $($artifact.Name) does not contain expected handler file '$handlerZipPath'."
      }
      $otherHandlers = $zip.Entries | Where-Object {
        $_.FullName -like "dist/lambda/*.js" -and $_.FullName -ne $handlerZipPath
      }
      if ($otherHandlers) {
        throw "Packaged ZIP for $($artifact.Name) contains unrelated Lambda handlers: $(($otherHandlers | ForEach-Object FullName) -join ', ')"
      }
      if ($zipUncompressedBytes -ge $lambdaUnzippedLimitBytes) {
        throw "$($artifact.Name) ZIP is too large uncompressed: $(Format-Bytes $zipUncompressedBytes). Lambda limit is $(Format-Bytes $lambdaUnzippedLimitBytes)."
      }
    }
    finally {
      $zip.Dispose()
    }

    $results += [pscustomobject]@{
      Function = $artifact.Name
      Key = $artifact.Key
      ZipSize = Format-Bytes $zipBytes
      UncompressedSize = Format-Bytes $zipUncompressedBytes
      Handler = $artifact.Handler
      Path = $zipPath
    }

    if ($Upload) {
      aws s3 cp $zipPath "s3://$bucket/$($artifact.Key)"
      Write-Host "Verified upload target: s3://$bucket/$($artifact.Key)"
      aws s3api head-object --bucket $bucket --key $artifact.Key --query "{Size: ContentLength, LastModified: LastModified}" --output json
    }
  }

  $hashTfvarsPath = Join-Path $tfDir "lambda-artifacts.auto.tfvars.json"
  $artifactHashes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $hashTfvarsPath -Encoding UTF8
  Write-Host "Wrote Lambda artifact hashes to $hashTfvarsPath"

  $results | Format-Table -AutoSize

  if ($Upload) {
    Write-Host "Uploaded Lambda artifacts to s3://$bucket"
  } else {
    Write-Host "Package-only mode. No S3 upload was performed."
    Write-Host "To upload after review, rerun with: .\infrastructure\scripts\upload-dev-lambda-artifacts.ps1 -Upload"
  }
}
finally {
  Pop-Location
}
