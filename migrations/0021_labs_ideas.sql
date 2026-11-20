-- Labs: explicación de cada momento. Las ideas de una campaña en marcha ya no necesitan enviarse al cliente.
ALTER TABLE campaign_moments ADD COLUMN description TEXT NOT NULL DEFAULT '';
