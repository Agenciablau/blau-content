CREATE TABLE project_note_views (id TEXT PRIMARY KEY, note_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE INDEX project_note_views_note ON project_note_views(note_id, created_at);
