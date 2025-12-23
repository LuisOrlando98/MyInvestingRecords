// src/pages/EditPosition.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import PositionEditor from "../components/PositionEditor";
import { useLocation } from "react-router-dom";

export default function EditPosition() {
  const { id } = useParams();          // ✅ ID real de la URL
  const location = useLocation();
  const isRoll = new URLSearchParams(location.search).get("roll") === "true";
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`/api/positions/${id}`);
        setPosition(res.data.data);
      } catch (err) {
        console.error("Error loading position", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const saveChanges = async (payload) => {
    if (isRoll) {
      await axios.post(`/api/positions/${id}/roll`, payload);
    } else {
      await axios.put(`/api/positions/${id}`, payload);
    }

    window.location.href = "/positions";
  };

  if (loading) return <p>Loading...</p>;

  return (
    <PositionEditor
      mode="edit"
      initialData={position}
      onSave={saveChanges}
      isRoll={isRoll}
    />
  );
}
