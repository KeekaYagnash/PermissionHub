terraform {
  backend "s3" {
    bucket  = "permissionhub-dev-bucket"
    key     = "permissionhub/github_roles/terraform.tfstate"
    region  = "af-south-1"
    encrypt = true
  }
}
