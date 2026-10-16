/*
 Minimal ingestion + Socket.IO broadcaster with DB persistence to TimescaleDB
 Improved DB connection handling: retry loop on startup to wait for Postgres availability
 Run:
   node server.js
 Expects DATABASE_URL env var (e.g. postgres://user:pass@db:5432/telemetry)
*/
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const Ajv = require('ajv');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const ajv = new Ajv();
const telemetrySchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'number' },
    car_id: { type: 'string' },
    team: { type: 'string' },
    class: { type: 'string' },
    lap_number: { type: 'integer' },
    speed: { type: 'number' },
    rpm: { type: 'number' },
    fuel: { type: 'number' },
    position: { type: 'integer' },
    event_type: { type: 'string' }
  },
  required: ['timestamp', 'car_id']
};
const validate = ajv.compile(telemetrySchema);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://lemans:lemans@localhost:5432/telemetry'
});

// Simple sleep
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForDb({retries = 12, delay = 5000} = {}) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      attempt++;
      console.log(`Checking DB availability (attempt ${attempt}/${retries})...`);
      await pool.query('SELECT 1');
      console.log('DB is available');
      return true;
    } catch (err) {
      console.warn(`DB not ready: ${err.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error('Timed out waiting for DB');
}

async function ensureSchema() {
  const createTableSql = `
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
  `;
  try {
    await pool.query(createTableSql);
    // create hypertable if extension present
    await pool.query(`SELECT create_hypertable('telemetry', 'ts', if_not_exists => TRUE);`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_telemetry_car_ts ON telemetry (car_id, ts DESC);`).catch(() => {});
  } catch (err) {
    console.error('Error ensuring schema:', err.message);
    throw err;
  }
}

// In-memory store (fast broadcast)
const cars = {}; // car_id -> latest telemetry
const leaderboards = { overall: [] };

function updateAggregates(msg) {
  const c = msg.car_id;
  cars[c] = { ...(cars[c] || {}), ...msg };
  const snapshot = Object.values(cars)
    .filter(x => x.position != null)
    .sort((a, b) => a.position - b.position);
  leaderboards.overall = snapshot;
}

let dbReady = false;

async function persistTelemetry(msg) {
  if (!dbReady) {
    // If DB isn't ready, skip persisting to avoid flooding logs.
    // Optionally you could buffer these and flush later.
    console.warn('Skipping DB persist: DB not ready yet');
    return;
  }

  // Correct mapping: 11 target columns, 11 expressions in VALUES, but only 10 parameter placeholders
  // because we use to_timestamp($1) (which references $1) and then parameters $1..$10.
  const insertSql = `
    INSERT INTO telemetry (
      ts, raw_ts, car_id, team, class, lap_number,
      speed, rpm, fuel, position, payload
    ) VALUES (
      to_timestamp($1::double precision/1000), $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10
    )
    RETURNING id;
  `;

  // Values array maps to $1..$10
  const values = [
    msg.timestamp,
    msg.car_id,
    msg.team || null,
    msg.class || null,
    msg.lap_number != null ? msg.lap_number : null,
    msg.speed != null ? msg.speed : null,
    msg.rpm != null ? msg.rpm : null,
    msg.fuel != null ? msg.fuel : null,
    msg.position != null ? msg.position : null,
    msg
  ];

  // Debug logging to diagnose parameter mismatch issues
  try {
    const compactSql = insertSql.replace(/\s+/g, ' ').trim();
    const valueTypes = values.map(v => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v));
    console.log('DB INSERT SQL:', compactSql);
    console.log('DB INSERT values.length =', values.length, 'types =', JSON.stringify(valueTypes));
  } catch (e) {
    console.warn('Failed to log DB debug info:', e.message);
  }

  try {
    await pool.query(insertSql, values);
  } catch (err) {
    console.error('DB insert error:', err.message);
  }
}

app.post('/ingest', (req, res) => {
  const ok = validate(req.body);
  if (!ok) return res.status(400).json({ error: validate.errors });
  const msg = req.body;

  updateAggregates(msg);
  io.of('/race').emit('update', { type: 'car', payload: msg });
  io.of('/race').emit('update', { type: 'leaderboard', payload: leaderboards.overall.slice(0, 20) });

  // Persist to DB asynchronously
  persistTelemetry(msg);

  res.json({ status: 'accepted' });
});

app.get('/health', (req, res) => res.json({ status: 'ok', dbReady }));

io.of('/race').on('connection', (socket) => {
  console.log('client connected', socket.id);
  socket.emit('update', { type: 'leaderboard', payload: leaderboards.overall.slice(0, 20) });
  socket.on('disconnect', () => console.log('client disconnected', socket.id));
});

const PORT = process.env.PORT || 4000;

(async function start() {
  try {
    await waitForDb({ retries: 24, delay: 5000 }); // wait up to ~2 minutes
    dbReady = true;
    await ensureSchema();
  } catch (err) {
    console.warn('Proceeding without DB after timeout/error:', err.message);
    dbReady = false;
  }

  server.listen(PORT, () => console.log('server listening on', PORT));
})();
