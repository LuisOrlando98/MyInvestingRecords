import React from "react";
import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { QuoteProvider } from "./store/QuoteStore";

export default function App() {
  return (
    <AuthProvider>
      <QuoteProvider>
        <AppRoutes />
      </QuoteProvider>
    </AuthProvider>
  );
}
