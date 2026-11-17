# Account approval and provisioning

The standard request path is Account Approver → Approve & provision → provisioning worker. Security Reviewer is a view/audit role, not an approval stage. Existing non-security approval stages (for example, a configured Organisation Admin stage) remain enforced.

The API supplies the current action, availability and blocking reason. Final live approval requires the existing live-change confirmation and provisioning prerequisites. The browser does not need a general `PROVISION_EXECUTE` permission to submit this final approval. Manual provisioning, retries of failed AWS executions and revocation retain their separate scoped permissions.

The request transition, Approval record and queued ProvisioningJob are committed in one database transaction. Queue delivery happens after commit. A failed delivery returns `PROVISIONING_ENQUEUE_FAILED`; the UI retains the operation key and offers Retry queue delivery. The worker validates the persisted final Approval, current active membership, account scope and completed stages before executing. Duplicate messages cannot claim an already running or completed job. An uncertain running attempt still requires reconciliation rather than blind replay.

Legacy pending requests that are waiting for Security Reviewer are presented to an eligible Account Approver for fresh confirmation. Viewing the request never approves or queues it. On confirmation, the canonical stages are saved; original Approval records and timeline history are preserved. Already approved historical requests are not reopened.

No schema migration or infrastructure change is needed for this fix. Release the API, provisioning-worker Lambda and frontend together through the existing deployment pipeline. The environment must already have its provisioning queue, worker event mapping, enabled live mode and usable account credentials configured. Connection checks, STS account verification, policy/target validation, expiry safeguards and tenant isolation remain enforced. Disabled and dry-run modes remain non-mutating.

Local validation uses mocked AWS services and queue delivery. No live AWS provisioning has been verified by this change.
