CREATE TABLE project_notes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', secret TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX project_notes_project ON project_notes(project_id);
