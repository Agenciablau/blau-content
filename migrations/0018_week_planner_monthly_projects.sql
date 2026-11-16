-- Proyectos mensuales: '' (con inicio y final) o 'monthly' (cada mes es una fase).
ALTER TABLE projects ADD COLUMN cadence TEXT NOT NULL DEFAULT '';
-- Mi semana (solo administrador): cada tarjeta es un puntero a una tarea o publicación, o una tarjeta libre.
CREATE TABLE week_plan (id TEXT PRIMARY KEY, week TEXT NOT NULL, day INTEGER NOT NULL, position INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL, ref_id TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', priority INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX week_plan_week ON week_plan(week);
CREATE UNIQUE INDEX week_plan_ref ON week_plan(week,kind,ref_id) WHERE kind<>'free';
CREATE TABLE week_notes (week TEXT PRIMARY KEY, focus TEXT NOT NULL DEFAULT '[]', note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
