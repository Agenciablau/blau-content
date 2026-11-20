-- Producción: de dónde sale el material de cada publicación (have, create, brand) y, si hay que crearlo, la fecha de creación.
ALTER TABLE posts ADD COLUMN material TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN create_date TEXT NOT NULL DEFAULT '';
