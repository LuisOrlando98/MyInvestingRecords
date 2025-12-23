import React, { useState } from "react";
import axios from "axios";

export default function RollModal({ position, onClose, onSuccess }) {
  const [rollOutCost, setRollOutCost] = useState("");
  const [rollInCredit, setRollInCredit] = useState("");
  const [loading, setLoading] = useState(false);

  if (!position) return null;

  const submitRoll = async () => {
    const out = parseFloat(rollOutCost);
    const inp = parseFloat(rollInCredit);

    if (isNaN(out) || isNaN(inp)) {
      alert("Enter valid numeric values");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`/api/positions/${position._id}/roll`, {
        rollOutCost: out,
        rollInCredit: inp,
        newPosition: {
          ...position,
          _id: undefined,
          status: "Open",
        },
      });

      onSuccess();
    } catch (err) {
      alert("Error rolling position");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg w-[420px] p-5 shadow-xl">
        <h2 className="text-lg font-semibold mb-3">
          Roll Position — {position.symbol}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600">
              Cost to close old position
            </label>
            <input
              type="number"
              value={rollOutCost}
              onChange={(e) => setRollOutCost(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="e.g. 125"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600">
              Credit / Debit for new position
            </label>
            <input
              type="number"
              value={rollInCredit}
              onChange={(e) => setRollInCredit(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="e.g. 180"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>

          <button
            onClick={submitRoll}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            {loading ? "Rolling..." : "Confirm Roll"}
          </button>
        </div>
      </div>
    </div>
  );
}
