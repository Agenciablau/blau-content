-- Permisos del colaborador (lista JSON). Vacío = Redactor, lo que podía hacer antes.
ALTER TABLE members ADD COLUMN permissions TEXT NOT NULL DEFAULT '';
