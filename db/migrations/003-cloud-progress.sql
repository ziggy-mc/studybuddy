ALTER TABLE study_sets ADD COLUMN progress_json TEXT NOT NULL DEFAULT '{"known":[],"review":[],"attempts":0,"correct":0}';
ALTER TABLE study_sets ADD COLUMN last_studied_at TEXT;
