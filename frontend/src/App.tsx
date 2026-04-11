import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth/AuthContext";
import Login from "./pages/Login";
import Upload from "./pages/Upload";
import Leaderboard from "./pages/Leaderboard";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/upload"
            element={
              <RequireAuth>
                <Upload />
              </RequireAuth>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <RequireAuth>
                <Leaderboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
