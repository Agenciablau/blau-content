ALTER TABLE comments ADD COLUMN internal INTEGER NOT NULL DEFAULT 0;
CREATE TABLE key_dates (id TEXT PRIMARY KEY, client_id TEXT, date TEXT NOT NULL, title TEXT NOT NULL, yearly INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX key_dates_client ON key_dates(client_id, date);
