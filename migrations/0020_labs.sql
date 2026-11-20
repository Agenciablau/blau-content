-- Labs: campañas de redes sociales con momentos, presupuesto y resultados; las ideas de publicación se vinculan a una campaña.
CREATE TABLE campaigns (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, name TEXT NOT NULL, concept TEXT NOT NULL DEFAULT '', objectives TEXT NOT NULL DEFAULT '[]', budget INTEGER NOT NULL DEFAULT 0, spent INTEGER NOT NULL DEFAULT 0, show_numbers INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX campaigns_client ON campaigns(client_id);
CREATE TABLE campaign_moments (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, budget INTEGER NOT NULL DEFAULT 0, metrics TEXT NOT NULL DEFAULT '[]');
CREATE INDEX campaign_moments_campaign ON campaign_moments(campaign_id);
-- Publicaciones: campaña y momento, idea enviada al cliente (shared) y opciones para elegir (selection, JSON).
ALTER TABLE posts ADD COLUMN campaign_id TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN moment_id TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN shared INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN selection TEXT NOT NULL DEFAULT '';
