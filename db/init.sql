CREATE TABLE IF NOT EXISTS telemetry (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  raw_ts BIGINT NOT NULL,
  car_id TEXT,
  team TEXT,
  class TEXT,
  lap_number INTEGER,
  lap_time_ms INTEGER,
  sector INTEGER,
  sector_time_ms INTEGER,
  speed DOUBLE PRECISION,
  throttle DOUBLE PRECISION,
  brake DOUBLE PRECISION,
  rpm INTEGER,
  gear INTEGER,
  fuel DOUBLE PRECISION,
  tire_temp_fl DOUBLE PRECISION,
  tire_temp_fr DOUBLE PRECISION,
  tire_temp_rl DOUBLE PRECISION,
  tire_temp_rr DOUBLE PRECISION,
  position INTEGER,
  x DOUBLE PRECISION,
  y DOUBLE PRECISION,
  pit_status TEXT,
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

SELECT create_hypertable('telemetry', 'ts', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_telemetry_car_ts ON telemetry (car_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry (ts DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS avg_speed_10s
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('10 seconds', ts) AS bucket,
  car_id,
  avg(speed) AS avg_speed,
  max(speed) AS max_speed
FROM telemetry
WHERE speed IS NOT NULL
GROUP BY bucket, car_id
WITH NO DATA;

CREATE OR REPLACE VIEW latest_telemetry AS
SELECT DISTINCT ON (car_id)
  id, ts, raw_ts, car_id, team, class, lap_number, speed, rpm, fuel, position, payload, created_at
FROM telemetry
ORDER BY car_id, ts DESC;
