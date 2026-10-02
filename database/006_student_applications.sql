ALTER TABLE applications ADD COLUMN statement TEXT NOT NULL DEFAULT '' CHECK(length(statement)<=2000);
ALTER TABLE applications ADD COLUMN updated_at TIMESTAMPTZ;
