import React, { useEffect, useState } from 'react';
import axios from 'axios';

const OpenPositionsTable = () => {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    axios.get('/api/positions/open-summary')
      .then(res => setPositions(res.data))
      .catch(err => console.error('❌ Error fetching open positions:', err));
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Strategy</th>
          <th>Count</th>
          <th>Net Premium</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos, index) => (
          <tr key={index}>
            <td>{pos.symbol}</td>
            <td>{pos.strategy}</td>
            <td>{pos.count}</td>
            <td>{pos.netPremium}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default OpenPositionsTable;
