// src/components/StockDetail.js
import React, { useEffect, useState } from "react";
import axios from "axios";

const StockDetail = ({ ticker, onClose }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (ticker) {
      axios.get(`http://localhost:4000/api/finviz/${ticker}`)
        .then(res => setData(res.data))
        .catch(err => console.error("Error al cargar datos Finviz:", err));
    }
  }, [ticker]);

  if (!ticker) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[90%] max-w-3xl relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-black"
        >
          ✖
        </button>
        <h2 className="text-xl font-bold mb-4">Details for {ticker}</h2>
        {data ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b py-1">
                <span className="font-medium">{key}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>Loading data from Finviz...</p>
        )}
      </div>
    </div>
  );
};

export default StockDetail;
