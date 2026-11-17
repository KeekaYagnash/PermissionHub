locals {
  frontend_domain        = "dev.iamops.disraptor.co.za"
  canonical_frontend_url = "https://${local.frontend_domain}"
  # Keep the AWS hostname registered for authentication as well as the canonical URL.
  frontend_origins = [local.canonical_frontend_url, module.frontend_hosting.frontend_url]
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Existing disraptor.co.za zone ID; not the secret Cloudflare ACCOUNT_ID. Verified by the deployment credential helper."
  default     = "3d7a2a6ec21accc47092e5a986a5e022"
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.cloudflare_zone_id))
    error_message = "Supply the existing disraptor.co.za zone ID."
  }
}

resource "aws_acm_certificate" "frontend" {
  provider          = aws.cloudfront_certificate
  domain_name       = local.frontend_domain
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "cloudflare_dns_record" "frontend_validation" {
  # One non-wildcard hostname: keep the key known even in a fresh plan.
  for_each = { (local.frontend_domain) = one(aws_acm_certificate.frontend.domain_validation_options) }
  zone_id  = var.cloudflare_zone_id
  name     = trimsuffix(each.value.resource_record_name, ".")
  type     = each.value.resource_record_type
  content  = trimsuffix(each.value.resource_record_value, ".")
  ttl      = 300
  proxied  = false
  comment  = "PermissionHub dev ACM validation; keep for certificate renewal"
}

resource "aws_acm_certificate_validation" "frontend" {
  provider                = aws.cloudfront_certificate
  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [for record in cloudflare_dns_record.frontend_validation : record.name]
  timeouts { create = "45m" }
}

resource "cloudflare_dns_record" "frontend" {
  zone_id    = var.cloudflare_zone_id
  name       = local.frontend_domain
  type       = "CNAME"
  content    = module.frontend_hosting.cloudfront_domain_name
  ttl        = 300
  proxied    = false
  comment    = "PermissionHub dev frontend; TLS terminates at CloudFront"
  depends_on = [aws_acm_certificate_validation.frontend]
}
