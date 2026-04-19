import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth/AuthContext";
import { apiUrl } from "../api";

interface Submission {
  _id: string;
  userEmail: string;
  userName: string;
  participantName: string;
  participantId: string | null;
  reason: string;
  photoId: string;
  createdAt: string;
}

type SortColumn =
  | "participantName"
  | "participantId"
  | "reason"
  | "userName"
  | "createdAt";

export default function Submissions() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPhotoUrl, setModalPhotoUrl] = useState<string | null>(null);
  const [modalPhotoName, setModalPhotoName] = useState<string>("");

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    fetch(apiUrl("/api/submissions"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load submissions");
        return res.json();
      })
      .then((data: Submission[]) => {
        if (!cancelled) setSubmissions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(false);
    }
  };

  const handleViewPhoto = async (photoId: string, participantName: string) => {
    if (!token) return;

    try {
      const res = await fetch(apiUrl(`/api/photos/${photoId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load photo");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setModalPhotoUrl(url);
      setModalPhotoName(participantName);
      setModalOpen(true);
    } catch (err: any) {
      alert("Failed to load photo: " + (err.message || "Unknown error"));
    }
  };

  const closeModal = () => {
    if (modalPhotoUrl) {
      URL.revokeObjectURL(modalPhotoUrl);
    }
    setModalOpen(false);
    setModalPhotoUrl(null);
    setModalPhotoName("");
  };

  const sortedSubmissions = submissions
    ? [...submissions].sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";

        switch (sortColumn) {
          case "participantName":
            aVal = a.participantName || "";
            bVal = b.participantName || "";
            break;
          case "participantId":
            aVal = a.participantId || "";
            bVal = b.participantId || "";
            break;
          case "reason":
            aVal = a.reason;
            bVal = b.reason;
            break;
          case "userName":
            aVal = a.userName;
            bVal = b.userName;
            break;
          case "createdAt":
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
            break;
        }

        if (aVal < bVal) return sortAsc ? 1 : -1;
        if (aVal > bVal) return sortAsc ? -1 : 1;
        return 0;
      })
    : null;

  const SortHeader = ({
    column,
    label,
  }: {
    column: SortColumn;
    label: string;
  }) => (
    <th
      onClick={() => handleSort(column)}
      className="text-left text-sm font-semibold text-gray-700 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
    >
      <div className="flex items-center gap-2">
        {label}
        {sortColumn === column && (
          <span className="text-xs">{sortAsc ? "↑" : "↓"}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto pt-16 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">All Submissions</h1>
        {error ? (
          <div className="bg-red-50 text-red-800 border border-red-200 rounded-2xl px-6 py-4 text-center">
            {error}
          </div>
        ) : submissions === null ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No submissions yet
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <SortHeader
                      column="participantName"
                      label="Participant Name"
                    />
                    <SortHeader column="participantId" label="Participant ID" />
                    <SortHeader column="reason" label="Reason" />
                    <SortHeader column="userName" label="Proctor" />
                    <SortHeader column="createdAt" label="Date" />
                    <th className="text-left text-sm font-semibold text-gray-700 px-4 py-3">
                      Photo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSubmissions &&
                    sortedSubmissions.map((sub) => (
                      <tr
                        key={sub._id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {sub.participantName}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {sub.participantId || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                          {sub.reason}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {sub.userName}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              handleViewPhoto(sub.photoId, sub.participantName)
                            }
                            className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {modalPhotoName}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 flex justify-center">
              {modalPhotoUrl && (
                <img
                  src={modalPhotoUrl}
                  alt={modalPhotoName}
                  className="max-w-full max-h-[calc(90vh-150px)] object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
