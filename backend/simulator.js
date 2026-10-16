/*
 Simple simulator that posts telemetry to backend /ingest
 Run:
   node simulator.js
*/
const axios = require('axios');

const BACKEND = process.env.BACKEND || 'http://localhost:4000';
const CARS = [
  { car_id: '1', team: 'Team A', class: 'LMP' },
  { car_id: '2', team: 'Team B', class: 'LMP' },
  { car_id: '3', team: 'Team C', class: 'GTE' },
  { car_id: '4', team: 'Team D', class: 'GTE' }
];

function sendTelemetry(car) {
  const now = Date.now();
  const payload = {
    timestamp: now,
    car_id: car.car_id,
    team: car.team,
    class: car.class,
    lap_number: Math.floor(Math.random() * 200),
    speed: Math.round(100 + Math.random() * 200),
    rpm: Math.round(3000 + Math.random() * 9000),
    fuel: Math.round(20 + Math.random() * 80),
    position: Math.floor(Math.random() * 60) + 1
  };
  return axios.post(`${BACKEND}/ingest`, payload).catch(e => console.error('post failed', e.message));
}

setInterval(() => {
  for (const c of CARS) sendTelemetry(c);
}, 600);
