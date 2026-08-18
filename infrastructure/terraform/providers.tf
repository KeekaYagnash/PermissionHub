provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge({
      Application = "PermissionHub"
      Project     = "PermissionHub"
      ManagedBy   = "Terraform"
    }, var.additional_tags)
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region used by the root provider when this directory is used directly."
  default     = "af-south-1"
}

variable "additional_tags" {
  type        = map(string)
  description = "Additional tags applied by the root provider."
  default     = {}
}
