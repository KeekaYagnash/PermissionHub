variable "name" { type = string }
variable "environment" { type = string }
variable "callback_urls" { type = list(string) }
variable "logout_urls" { type = list(string) }
variable "enable_cognito_domain" {
  type    = bool
  default = false
}
variable "cognito_domain_prefix" {
  type    = string
  default = ""
}
variable "mfa_configuration" {
  type    = string
  default = "OPTIONAL"
}
variable "create_default_groups" {
  type    = bool
  default = true
}
variable "deletion_protection" {
  type    = string
  default = "INACTIVE"
}
variable "tags" {
  type    = map(string)
  default = {}
}
