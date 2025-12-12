// src/pages/EditPosition.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import PositionEditor from "../components/PositionEditor";

export default function EditPosition() {
  const { id } = useParams();          // ✅ ID real de la URL
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
    await axios.put(`/api/positions/${id}`, payload);
    window.location.href = "/positions";
  };

  if (loading) return <p>Loading...</p>;

  return (
    <PositionEditor
      mode="edit"
      initialData={position}
      onSave={saveChanges}
    />
  );
}
