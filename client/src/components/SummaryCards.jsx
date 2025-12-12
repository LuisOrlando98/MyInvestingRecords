import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SummaryCards = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get('/api/positions/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error('❌ Error fetching stats:', err));
  }, []);

  if (!stats) return <p>Loading...</p>;

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div>
        <h3>Total Net Premium</h3>
        <p>${stats.totalNetPremium.toFixed(2)}</p>
      </div>
      <div>
        <h3>Total Realized PnL</h3>
        <p>${stats.totalRealizedPnL.toFixed(2)}</p>
      </div>
      <div>
        <h3>Number of Positions</h3>
        <p>{stats.positionCount}</p>
      </div>
    </div>
  );
};

export default SummaryCards;
