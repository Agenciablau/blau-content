-- Marcas adicionales de un colaborador (la principal sigue en members.client_id).
CREATE TABLE member_clients (
  email TEXT NOT NULL,
  client_id TEXT NOT NULL,
  PRIMARY KEY (email, client_id)
);
CREATE INDEX member_clients_client ON member_clients(client_id);
