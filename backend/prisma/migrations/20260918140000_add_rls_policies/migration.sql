-- Enable Row Level Security on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::int);

-- Create RLS policies for projects table
CREATE POLICY projects_tenant_isolation ON projects
  USING (tenant_id = current_setting('app.tenant_id')::int);

-- Create RLS policies for project_members table
CREATE POLICY project_members_tenant_isolation ON project_members
  USING (tenant_id = current_setting('app.tenant_id')::int);

-- Create RLS policies for tasks table
CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.tenant_id')::int);

-- Allow postgres superuser to bypass RLS
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE project_members FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
