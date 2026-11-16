-- Mi semana: tareas y publicaciones que el administrador no quiere ver en «Por colocar».
CREATE TABLE week_hidden (kind TEXT NOT NULL, ref_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (kind, ref_id));
