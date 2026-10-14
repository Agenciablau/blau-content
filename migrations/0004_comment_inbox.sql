ALTER TABLE comments ADD COLUMN role TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE comments ADD COLUMN resolved INTEGER NOT NULL DEFAULT 1;
CREATE INDEX comments_inbox ON comments(post_id, resolved, created_at);
