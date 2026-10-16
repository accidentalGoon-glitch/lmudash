# LeMans Ultimate Telemetry Dashboard

A lightweight telemetry dashboard demo for LeMans Ultimate style data. This project includes:

- A Node.js + Express backend that ingests telemetry payloads
- Socket.IO real-time updates to the dashboard
- A Vite + React frontend dashboard with a live leaderboard
- A simulator that emits telemetry data to the API
- Docker + TimescaleDB support for persistence

## Quick start with Docker

```bash
docker-compose up --build
```

Then open:

- Frontend: http://localhost:8080
- Backend: http://localhost:4000
- TimescaleDB: localhost:5432

## Local development

### Backend

```bash
cd backend
npm install
node server.js
```

### Simulator

```bash
cd backend
node simulator.js
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Database

The project includes a TimescaleDB setup with a `telemetry` hypertable and a sample continuous aggregate.

## Notes

This is an MVP/demo implementation intended for local development and experimentation. It keeps a fast in-memory leaderboard for real-time UI updates while persisting telemetry rows to TimescaleDB.
