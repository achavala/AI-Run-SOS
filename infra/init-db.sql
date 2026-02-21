-- Row-Level Security setup for multi-tenancy
-- Applied after Prisma migrations via a post-migration script

-- Enable RLS on all tenant-scoped tables
-- This script is idempotent and should be run after each migration

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'User', 'Vendor', 'Consultant', 'Job', 'Submission',
    'ConsentRecord', 'Interview', 'Placement', 'Timesheet',
    'Invoice', 'Payment', 'ImmigrationCase', 'ComplianceDocument',
    'AgentAuditLog', 'TrustEvent', 'Notification'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop existing policy if it exists (idempotent)
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON %I', tbl
    );

    -- Create RLS policy: users can only see rows matching their tenant
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL USING ("tenantId" = current_setting(''app.current_tenant_id'', true))',
      tbl
    );
  END LOOP;
END $$;
