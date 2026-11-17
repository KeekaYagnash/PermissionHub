variable "name" { type = string }
variable "aliases" {
  type    = list(string)
  default = []
}
variable "acm_certificate_arn" {
  type     = string
  default  = null
  nullable = true
}
variable "price_class" {
  type    = string
  default = "PriceClass_100"
}
variable "tags" {
  type    = map(string)
  default = {}
}
