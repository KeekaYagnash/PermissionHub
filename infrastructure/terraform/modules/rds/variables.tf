variable "name" { type = string }
variable "database_secret_name_prefix" {
  type        = string
  default     = null
  description = "Optional unique naming for disposable environments; null preserves existing names."
}
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "database_name" {
  type    = string
  default = "permissionhub"
}
variable "database_username" {
  type    = string
  default = "permissionhub"
}
variable "postgres_engine_version" {
  type    = string
  default = "16.4"
}
variable "instance_class" { type = string }
variable "allocated_storage" { type = number }
variable "multi_az" { type = bool }
variable "backup_retention_period" { type = number }
variable "deletion_protection" { type = bool }
variable "skip_final_snapshot" { type = bool }
variable "final_snapshot_identifier" {
  type    = string
  default = null
}
variable "delete_automated_backups" {
  type    = bool
  default = true
}
variable "tags" {
  type    = map(string)
  default = {}
}
