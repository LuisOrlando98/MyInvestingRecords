import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DailyChangeChart = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    axios.get('/api/positions/summary-by-month')
      .then(res => setData(res.data))
      .catch(err => console.error('❌ Error fetching monthly summary:', err));
  }, []);

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="#ccc" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="realizedPnL" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DailyChangeChart;
