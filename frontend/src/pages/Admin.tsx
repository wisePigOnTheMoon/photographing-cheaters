import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth/AuthContext";
import { apiUrl } from "../api";
import { Navigate } from "react-router-dom";

interface LeaderboardEntry {
  name: string;
  email: string;
  picture?: string;
  score: number;
}

interface AdminUser {
  _id?: string;
  email: string;
  addedAt?: string;
}

export default function Admin() {
  const { token } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [admins, setAdmins] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState<number>(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  // Load leaderboard and admins
  useEffect(() => {
    if (!token) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }

    let cancelled = false;

    // Load leaderboard
    fetch(apiUrl("/api/leaderboard"))
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load leaderboard");
        return res.json();
      })
      .then((data: LeaderboardEntry[]) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    // Check admin status and load admins
    fetch(apiUrl("/api/admin/admins"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!cancelled && res.status === 403) {
          setIsAdmin(false);
          setAdminChecked(true);
          throw new Error("Not an admin");
        }
        if (!res.ok) {
          setIsAdmin(false);
          setAdminChecked(true);
          throw new Error("Failed to load admins");
        }
        return res.json();
      })
      .then((data: AdminUser[]) => {
        if (!cancelled) {
          setIsAdmin(true);
          setAdmins(data);
          setAdminChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
          setAdminChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Check if user is admin
  if (adminChecked && !isAdmin) {
    return <Navigate to="/leaderboard" replace />;
  }

  const handleEditScore = async (email: string) => {
    if (!token) return;
    setMessage(null);

    try {
      const res = await fetch(
        apiUrl(`/api/admin/users/${encodeURIComponent(email)}`),
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ score: editingScore }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to update score");
      }

      // Refresh the leaderboard
      const leaderboardRes = await fetch(apiUrl("/api/leaderboard"));
      if (!leaderboardRes.ok) throw new Error("Failed to refresh leaderboard");
      const data = await leaderboardRes.json();
      setEntries(data);

      setMessage({ kind: "success", text: "Score updated successfully" });
      setEditingEmail(null);
      setEditingScore(0);
    } catch (err: any) {
      setMessage({
        kind: "error",
        text: err.message || "Failed to update score",
      });
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!token) return;
    setMessage(null);

    try {
      setDeleting(email);
      const res = await fetch(
        apiUrl(`/api/admin/users/${encodeURIComponent(email)}`),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        throw new Error("Failed to delete user");
      }

      // Refresh the leaderboard
      const leaderboardRes = await fetch(apiUrl("/api/leaderboard"));
      if (!leaderboardRes.ok) throw new Error("Failed to refresh leaderboard");
      const data = await leaderboardRes.json();
      setEntries(data);

      setMessage({ kind: "success", text: "User deleted successfully" });
    } catch (err: any) {
      setMessage({
        kind: "error",
        text: err.message || "Failed to delete user",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleClearLeaderboard = async () => {
    if (!token) return;
    if (
      !window.confirm(
        "Are you sure you want to clear the entire leaderboard? This cannot be undone.",
      )
    ) {
      return;
    }
    setMessage(null);

    try {
      const res = await fetch(apiUrl("/api/admin/leaderboard"), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to clear leaderboard");
      }

      setEntries([]);
      setMessage({ kind: "success", text: "Leaderboard cleared successfully" });
    } catch (err: any) {
      setMessage({
        kind: "error",
        text: err.message || "Failed to clear leaderboard",
      });
    }
  };

  const handleAddAdmin = async (email: string) => {
    if (!token) return;
    setMessage(null);

    try {
      const res = await fetch(apiUrl("/api/admin/admins"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add admin");
      }

      // Refresh admins list
      const adminsRes = await fetch(apiUrl("/api/admin/admins"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!adminsRes.ok) throw new Error("Failed to refresh admins");
      const data = await adminsRes.json();
      setAdmins(data);

      setMessage({ kind: "success", text: "Admin added successfully" });
    } catch (err: any) {
      setMessage({ kind: "error", text: err.message || "Failed to add admin" });
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!token) return;
    setMessage(null);

    try {
      const res = await fetch(
        apiUrl(`/api/admin/admins/${encodeURIComponent(email)}`),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to remove admin");
      }

      // Refresh admins list
      const adminsRes = await fetch(apiUrl("/api/admin/admins"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!adminsRes.ok) throw new Error("Failed to refresh admins");
      const data = await adminsRes.json();
      setAdmins(data);

      setMessage({ kind: "success", text: "Admin removed successfully" });
    } catch (err: any) {
      setMessage({
        kind: "error",
        text: err.message || "Failed to remove admin",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto pt-16 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">Admin Panel</h1>

        {message && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium mb-6 ${
              message.kind === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            Leaderboard Controls
          </h2>
          <button
            onClick={handleClearLeaderboard}
            className="px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
          >
            Clear Entire Leaderboard
          </button>
        </div>

        {/* Admin Management Section */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            Manage Admin Access
          </h2>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Admin by Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                id="newAdminEmail"
                placeholder="user@example.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <button
                onClick={() => {
                  const input = document.getElementById(
                    "newAdminEmail",
                  ) as HTMLInputElement;
                  if (input && input.value.trim()) {
                    handleAddAdmin(input.value.trim());
                    input.value = "";
                  }
                }}
                className="px-6 py-2 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                Add Admin
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Current Admins
            </h3>
            {admins === null ? (
              <p className="text-gray-400">Loading...</p>
            ) : admins.length === 0 ? (
              <p className="text-gray-400">No admins found</p>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div
                    key={admin.email}
                    className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{admin.email}</p>
                      {admin.addedAt && (
                        <p className="text-xs text-gray-500">
                          Added {new Date(admin.addedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {admin.email !== "sophyli@stanford.edu" && (
                      <button
                        onClick={() => handleRemoveAdmin(admin.email)}
                        className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                    {admin.email === "sophyli@stanford.edu" && (
                      <span className="text-xs text-gray-500 italic">
                        Base Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 text-red-800 border border-red-200 rounded-2xl px-6 py-4 text-center">
            {error}
          </div>
        ) : entries === null ? (
          <div className="text-center text-gray-400 py-12">
            Loading leaderboard...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            Leaderboard is empty
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              Edit Rankings
            </h2>
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left text-lg font-semibold text-gray-700 px-6 py-4 w-12">
                        #
                      </th>
                      <th className="text-left text-lg font-semibold text-gray-700 px-6 py-4">
                        Name
                      </th>
                      <th className="text-left text-lg font-semibold text-gray-700 px-6 py-4">
                        Email
                      </th>
                      <th className="text-right text-lg font-semibold text-gray-700 px-6 py-4">
                        DQ Count
                      </th>
                      <th className="text-center text-lg font-semibold text-gray-700 px-6 py-4">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr
                        key={e.email}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 text-gray-500 font-semibold">
                          {i + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {e.picture && (
                              <img
                                src={e.picture}
                                alt={e.name}
                                className="w-8 h-8 rounded-full"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <span className="font-medium text-gray-900">
                              {e.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {e.email}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {editingEmail === e.email ? (
                            <div className="flex items-center gap-2 justify-end">
                              <input
                                type="number"
                                value={editingScore}
                                onChange={(e) =>
                                  setEditingScore(
                                    Math.max(0, parseInt(e.target.value) || 0),
                                  )
                                }
                                className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-center"
                              />
                              <button
                                onClick={() => handleEditScore(e.email)}
                                className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingEmail(null)}
                                className="px-3 py-1 bg-gray-400 text-white text-xs font-medium rounded-lg hover:bg-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingEmail(e.email);
                                setEditingScore(e.score);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {e.score}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleDeleteUser(e.email)}
                            disabled={deleting === e.email}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deleting === e.email ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
