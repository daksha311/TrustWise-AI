import React from 'react';

export default function History() {
  // Demonstration mapping structure representing internal tracking data parameters
  const demoHistory = [
    { id: "0", type: "Settlement Protocol", status: "SUCCESS", marker: "0.005 ETH" },
  ];

  return (
    <div style={{ border: '1px solid #222222', padding: '24px', borderRadius: '8px' }}>
      <h3 style={{ color: '#00ff00', fontSize: '1.1rem', marginTop: 0, marginBottom: '20px' }}>[03] HISTORICAL TRANSACTIONS</h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #222222', color: '#666666' }}>
              <th style={{ padding: '12px 8px' }}>VECTOR ID</th>
              <th style={{ padding: '12px 8px' }}>OPERATION TYPE</th>
              <th style={{ padding: '12px 8px' }}>ALLOCATION VALUE</th>
              <th style={{ padding: '12px 8px' }}>STATUS REGISTER</th>
            </tr>
          </thead>
          <tbody>
            {demoHistory.map((row, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #111111', color: '#ffffff' }}>
                <td style={{ padding: '12px 8px', color: '#00ff00' }}>#{row.id}</td>
                <td style={{ padding: '12px 8px' }}>{row.type}</td>
                <td style={{ padding: '12px 8px' }}>{row.marker}</td>
                <td style={{ padding: '12px 8px', color: '#34d399' }}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}