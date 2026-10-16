import React from 'react';

export default function Leaderboard({ leaderboard }) {
  return (
    <div>
      <h2>Leaderboard</h2>
      <table style={{ borderCollapse: 'collapse', width: 600 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Pos</th>
            <th style={{ textAlign: 'left' }}>Car</th>
            <th style={{ textAlign: 'left' }}>Team</th>
            <th style={{ textAlign: 'left' }}>Class</th>
            <th style={{ textAlign: 'left' }}>Lap</th>
            <th style={{ textAlign: 'left' }}>Speed</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((c) => (
            <tr key={c.car_id}>
              <td>{c.position}</td>
              <td>{c.car_id}</td>
              <td>{c.team}</td>
              <td>{c.class}</td>
              <td>{c.lap_number}</td>
              <td>{c.speed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
