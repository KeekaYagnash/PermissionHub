variable "name" { type = string }
variable "environment" { type = string }
variable "google_oauth_secret_arn" {
  type        = string
  default     = null
  description = "Optional existing Secrets Manager JSON secret with client_id and client_secret."
}
variable "microsoft_oidc_providers" {
  type = map(object({
    tenant_id         = string
    client_id         = string
    client_secret_arn = string
    label             = string
  }))
  default = {}
  validation {
    condition     = alltrue([for name, provider in var.microsoft_oidc_providers : can(regex("^[A-Za-z][A-Za-z0-9_-]{0,31}$", name)) && name != "Google" && name != "COGNITO" && can(regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", provider.tenant_id))])
    error_message = "Use unique provider names and explicit Microsoft tenant GUIDs, never common/organizations issuers."
  }
}
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
