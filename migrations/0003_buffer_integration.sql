CREATE TABLE drive_connection (id INTEGER PRIMARY KEY CHECK(id=1), refresh_token TEXT NOT NULL, connected_at TEXT NOT NULL);
CREATE TABLE integration_oauth_states (state TEXT PRIMARY KEY, owner_id TEXT NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE buffer_bindings (client_id TEXT PRIMARY KEY REFERENCES clients(id), channel_id TEXT NOT NULL UNIQUE, organization_id TEXT NOT NULL, channel_name TEXT NOT NULL);
CREATE TABLE buffer_jobs (post_id TEXT PRIMARY KEY REFERENCES posts(id), client_id TEXT NOT NULL REFERENCES clients(id), state TEXT NOT NULL, remote_id TEXT, mode TEXT NOT NULL, snapshot TEXT NOT NULL, assets TEXT NOT NULL DEFAULT '[]', error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT);
CREATE TABLE media_cleanup (id TEXT PRIMARY KEY, object_keys TEXT NOT NULL, created_at TEXT NOT NULL);
