variable "name" { type = string }
variable "stage_name" {
  type    = string
  default = "$default"
}
variable "lambda_invoke_arn" { type = string }
variable "lambda_function_name" { type = string }
variable "cognito_issuer_url" { type = string }
variable "cognito_app_client_id" { type = string }
variable "allowed_origins" { type = list(string) }
variable "allowed_methods" { type = list(string) }
variable "allowed_headers" { type = list(string) }
variable "log_retention_days" { type = number }
variable "tags" {
  type    = map(string)
  default = {}
}
