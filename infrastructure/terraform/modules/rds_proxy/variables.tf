variable "name" { type = string }
variable "vpc_subnet_ids" { type = list(string) }
variable "proxy_security_group_id" { type = string }
variable "db_instance_identifier" { type = string }
variable "database_secret_arn" { type = string }
variable "idle_client_timeout" {
  type    = number
  default = 1800
}
variable "tags" {
  type    = map(string)
  default = {}
}
