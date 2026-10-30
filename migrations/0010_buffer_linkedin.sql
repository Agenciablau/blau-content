CREATE TABLE buffer_bindings_new (client_id TEXT NOT NULL REFERENCES clients(id), service TEXT NOT NULL DEFAULT 'instagram', channel_id TEXT NOT NULL UNIQUE, organization_id TEXT NOT NULL, channel_name TEXT NOT NULL, PRIMARY KEY (client_id, service));
INSERT INTO buffer_bindings_new (client_id, service, channel_id, organization_id, channel_name) SELECT client_id, 'instagram', channel_id, organization_id, channel_name FROM buffer_bindings;
DROP TABLE buffer_bindings;
ALTER TABLE buffer_bindings_new RENAME TO buffer_bindings;
