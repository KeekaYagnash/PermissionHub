provider "aws" {
  allowed_account_ids = ["143671530412"]
  region              = var.aws_region

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  alias               = "cloudfront_certificate"
  allowed_account_ids = ["143671530412"]
  region              = "us-east-1"
  default_tags { tags = local.tags }
}

# Credentials come only from CLOUDFLARE_API_TOKEN in the runner environment.
# Never read the credentials secret using a Terraform data source.
provider "cloudflare" {}
