CREATE TABLE faculty_application_notes (
 id UUID PRIMARY KEY, application_id UUID NOT NULL REFERENCES applications(id),
 author_id UUID NOT NULL REFERENCES users(id), note TEXT NOT NULL CHECK(length(note) BETWEEN 1 AND 2000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE assistantship_appointments ADD COLUMN submitted_at TIMESTAMPTZ;
ALTER TABLE assistantship_appointments ADD COLUMN submitted_by UUID REFERENCES users(id);
