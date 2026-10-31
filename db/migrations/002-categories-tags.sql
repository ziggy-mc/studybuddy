ALTER TABLE study_sets ADD COLUMN category TEXT NOT NULL DEFAULT 'Uncategorized';
ALTER TABLE study_sets ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
