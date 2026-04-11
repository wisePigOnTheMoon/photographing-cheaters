import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { initGoogleAuth, renderGoogleButton } from "../auth/GoogleAuth";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      navigate("/upload", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await initGoogleAuth((credential) => {
          login(credential);
          navigate("/upload", { replace: true });
        });
        if (!cancelled && buttonRef.current) {
          await renderGoogleButton(buttonRef.current);
        }
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl shadow-md text-center">
        <h1 className="text-4xl font-bold mb-8">Sign In</h1>
        <div ref={buttonRef} className="flex justify-center" />
      </div>
    </div>
  );
}
