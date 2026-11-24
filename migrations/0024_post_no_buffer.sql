-- Publicaciones que no se envían nunca a Buffer, aunque su red y formato lo admitan.
ALTER TABLE posts ADD COLUMN no_buffer INTEGER NOT NULL DEFAULT 0;
