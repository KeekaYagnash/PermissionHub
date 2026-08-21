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
$artifactDir = Join-Path $repoRoot "artifacts\lambda"

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

$bucket = Get-TfvarsString "lambda_artifact_bucket"
$artifacts = @(
  @{ Name = "api"; Key = Get-TfvarsString "api_lambda_artifact_key"; Handler = "dist/lambda/api.handler" }
  @{ Name = "provisioning"; Key = Get-TfvarsString "provisioning_lambda_artifact_key"; Handler = "dist/lambda/provisioning.handler" }
  @{ Name = "expiry"; Key = Get-TfvarsString "expiry_lambda_artifact_key"; Handler = "dist/lambda/expiry.handler" }
  @{ Name = "migration"; Key = Get-TfvarsString "migration_lambda_artifact_key"; Handler = "dist/lambda/migration.handler" }
)

Push-Location $repoRoot
try {
  npm run prisma:generate --workspace backend
  npm run build:lambda --workspace backend

  if (Test-Path -LiteralPath $artifactDir) {
    Remove-Item -LiteralPath $artifactDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $artifactDir | Out-Null

  $results = @()
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

    $results += [pscustomobject]@{
      Function = $artifact.Name
      Key = $artifact.Key
      ZipSize = Format-Bytes $zipBytes
      UncompressedSize = Format-Bytes $uncompressedBytes
      Handler = $artifact.Handler
      Path = $zipPath
    }

    if ($Upload) {
      aws s3 cp $zipPath "s3://$bucket/$($artifact.Key)"
    }
  }

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
