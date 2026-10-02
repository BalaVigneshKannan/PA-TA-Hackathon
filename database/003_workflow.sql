ALTER TABLE applications ADD COLUMN requirement_acknowledged BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE applications ADD COLUMN profile_snapshot JSONB NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX one_interview_per_application ON interviews(application_id);
CREATE TABLE final_results (
 semester_id TEXT PRIMARY KEY REFERENCES semesters(id),
 approved_by UUID NOT NULL REFERENCES users(id),
 approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 rows JSONB NOT NULL, summary JSONB NOT NULL
);
CREATE INDEX applications_assignment ON applications(assignment_id,role,status);
CREATE INDEX audit_created ON audit_logs(created_at DESC);
