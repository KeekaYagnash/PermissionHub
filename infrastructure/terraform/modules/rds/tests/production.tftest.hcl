mock_provider "aws" {}
mock_provider "random" {}

variables {
  name                      = "permissionhub-prod"
  subnet_ids                = ["subnet-00000000000000001", "subnet-00000000000000002"]
  security_group_id         = "sg-00000000000000001"
  instance_class            = "db.t3.medium"
  allocated_storage         = 20
  postgres_engine_version   = "16.15"
  multi_az                  = true
  backup_retention_period   = 14
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "permissionhub-prod-final-test"
  delete_automated_backups  = false
}

run "small_production_retains_safeguards" {
  command = plan
  assert {
    condition     = aws_db_instance.this.instance_class == "db.t3.medium" && aws_db_instance.this.allocated_storage == 20
    error_message = "Initial production sizing must remain conservative."
  }
  assert {
    condition     = aws_db_instance.this.multi_az && aws_db_instance.this.storage_encrypted && !aws_db_instance.this.publicly_accessible && aws_db_instance.this.deletion_protection
    error_message = "Production cost reduction must not remove database safeguards."
  }
  assert {
    condition     = !aws_db_instance.this.skip_final_snapshot && aws_db_instance.this.final_snapshot_identifier != null && !aws_db_instance.this.delete_automated_backups && aws_db_instance.this.backup_retention_period == 14
    error_message = "Production requires retained snapshots and backups."
  }
}
