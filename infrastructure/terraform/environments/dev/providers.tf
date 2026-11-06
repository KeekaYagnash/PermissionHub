provider "aws" {
  allowed_account_ids = ["143671530412"]
  region              = var.aws_region

  default_tags {
    tags = local.tags
  }
}
