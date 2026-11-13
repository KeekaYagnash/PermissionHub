variable "name" { type = string }
variable "vpc_id" { type = string }
variable "enable_rds_proxy" {
  type    = bool
  default = true
}
variable "tags" {
  type    = map(string)
  default = {}
}
