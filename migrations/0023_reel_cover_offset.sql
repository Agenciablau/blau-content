-- Reels de Instagram: fotograma de portada en milisegundos dentro del vídeo (0 = el que elija Buffer/Instagram).
ALTER TABLE posts ADD COLUMN cover_offset INTEGER NOT NULL DEFAULT 0;
