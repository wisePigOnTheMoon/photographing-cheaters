import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { apiUrl } from "../api";

interface LeaderboardEntry {
  name: string;
  email: string;
  picture?: string;
  score: number;
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-xl mx-auto pt-16 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">Leaderboard</h1>
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-lg font-semibold text-gray-700 px-6 py-4 w-12">
                  #
                </th>
                <th className="text-left text-lg font-semibold text-gray-700 px-6 py-4">
                  Proctor Name
                </th>
                <th className="text-right text-lg font-semibold text-gray-700 px-6 py-4">
                  DQ Count
                </th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-red-500 py-12 text-base"
                  >
                    {error}
                  </td>
                </tr>
              )}
              {!error && entries === null && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-gray-400 py-12 text-base"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!error && entries && entries.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-gray-400 py-12 text-base"
                  >
                    No data yet
                  </td>
                </tr>
              )}
              {!error &&
                entries &&
                entries.map((e, i) => (
                  <tr
                    key={e.email}
                    className="border-b border-gray-100 last:border-0"
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
                        <span className="font-medium text-gray-800">
                          {e.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-800 font-semibold">
                      {e.score}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
