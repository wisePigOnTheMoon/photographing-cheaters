import React, { createContext, useContext, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";

interface User {
  name: string;
  email: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credential: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function useAuth() {
  return useContext(AuthContext);
}

function decodeJwt(token: string): any {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(jsonPayload);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem("token")
  );

  const login = useCallback((credential: string) => {
    const payload = decodeJwt(credential);
    const userData: User = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };
    sessionStorage.setItem("user", JSON.stringify(userData));
    sessionStorage.setItem("token", credential);
    setUser(userData);
    setToken(credential);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
