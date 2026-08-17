ALTER TABLE builds
ADD COLUMN environment TEXT NOT NULL DEFAULT 'default'
CHECK (length(environment) BETWEEN 1 AND 80);

CREATE INDEX builds_project_environment_created
ON builds(project_id, environment, created_at DESC);
