variable "aws_region" {
  type        = string
  description = "AWS region for the Terraform state bucket and lock table."
}

variable "state_bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for Terraform state."
}

variable "lock_table_name" {
  type        = string
  description = "DynamoDB table name for Terraform state locking."
  default     = "permissionhub-terraform-locks"
}

variable "tags" {
  type        = map(string)
  description = "Common bootstrap tags."
  default     = {}
}
