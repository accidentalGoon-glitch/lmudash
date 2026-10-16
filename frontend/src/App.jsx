import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Leaderboard from './components/Leaderboard';

const SOCKET_URL = import.meta.env.VITE_BACKEND || 'http://localhost:4000';
const socket = io(`${SOCKET_URL}/race`);

export default function App() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [cars, setCars] = useState({});

  useEffect(() => {
    socket.on('connect', () => console.log('socket connected', socket.id));
    socket.on('update', (msg) => {
      if (msg.type === 'leaderboard') setLeaderboard(msg.payload);
      if (msg.type === 'car') {
        setCars(prev => ({ ...prev, [msg.payload.car_id]: msg.payload }));
      }
    });
    return () => {
      socket.off('update');
      socket.disconnect();
    };
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 12 }}>
      <h1>LeMans Telemetry Dashboard (demo)</h1>
      <Leaderboard leaderboard={leaderboard} />
      <h2>Live car updates (latest per-car)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.values(cars).map(c => (
          <div key={c.car_id} style={{ border: '1px solid #ddd', padding: 8, width: 240 }}>
            <strong>Car {c.car_id}</strong> — {c.team} ({c.class})<br />
            Position: {c.position || '-'}<br />
            Speed: {c.speed ? `${c.speed} kph` : '-'}<br />
            Lap: {c.lap_number || '-'}<br />
            Fuel: {c.fuel || '-'}<br />
            RPM: {c.rpm || '-'}
          </div>
        ))}
      </div>
    </div>
  );
}
