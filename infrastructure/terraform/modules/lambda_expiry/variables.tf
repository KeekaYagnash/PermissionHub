variable "name" { type = string }
variable "runtime" { type = string }
variable "handler" { type = string }
variable "artifact_s3_bucket" { type = string }
variable "artifact_s3_key" { type = string }
variable "memory_size" { type = number }
variable "timeout" { type = number }
variable "reserved_concurrency" { type = number }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "environment_variables" { type = map(string) }
variable "app_secret_arn" { type = string }
variable "database_secret_arn" { type = string }
variable "assumable_role_arns" {
  type    = list(string)
  default = []
}
variable "schedule_expression" {
  type    = string
  default = "rate(15 minutes)"
}
variable "enable_schedule" {
  type    = bool
  default = false
}
variable "log_retention_days" { type = number }
variable "tags" {
  type    = map(string)
  default = {}
}
