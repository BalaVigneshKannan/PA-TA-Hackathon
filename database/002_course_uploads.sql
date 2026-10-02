CREATE TABLE course_upload_previews (
 id UUID PRIMARY KEY,
 semester_id TEXT NOT NULL REFERENCES semesters(id),
 created_by UUID NOT NULL REFERENCES users(id),
 filename TEXT NOT NULL,
 result JSONB NOT NULL,
 master_fingerprint TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour',
 confirmed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX course_upload_semester ON course_upload_previews(semester_id);
