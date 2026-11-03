import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Users } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface PageTime {
  path: string;
  label: string;
  seconds: number;
  visits: number;
}

interface RecentVisit {
  path: string;
  label: string;
  seconds: number;
  startedAt?: string;
}

interface FamilyUsage {
  sessions: number;
  timeSpentSeconds: number;
  pageTimeSeconds: number;
  lastActiveAt?: string | null;
  booksRead: number;
  pagesRead: number;
  songsPlayed: number;
  gamesPlayed: number;
  lessonsCompleted: number;
  farthestPage: string;
  pages: PageTime[];
  recent: RecentVisit[];
}

interface FeedbackResponse {
  hiccups?: string;
  favorites?: string;
  dislikes?: string;
  library?: string;
  island?: string;
  submittedAt?: string;
}

interface FamilySignup {
  _id: string;
  email: string;
  parentName: string;
  createdAt: string;
  emailSentAt?: string;
  grantedAt?: string;
  revenueCatGranted?: boolean;
  usage?: FamilyUsage | null;
  feedbackResponses?: FeedbackResponse[];
}

const FamilyTest: React.FC = () => {
  const [families, setFamilies] = useState<FamilySignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchFamilies = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('portal_admin_token');
      const response = await axios.get(`${API_URL}/api/beta-families`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFamilies(response.data.families || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load the family list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('portal_admin_token');
      const response = await axios.get(`${API_URL}/api/beta-families/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `godlykids-family-test-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Family test export error:', err);
      alert('Failed to download the CSV');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds?: number) => {
    const total = Math.max(0, Math.round(seconds || 0));
    if (total < 60) return total === 0 ? '—' : `${total}s`;
    const minutes = Math.floor(total / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const activeCount = families.filter((family) => (family.usage?.sessions || 0) > 0 || family.usage?.lastActiveAt).length;
  const totalSessions = families.reduce((sum, family) => sum + (family.usage?.sessions || 0), 0);
  const totalSeconds = families.reduce((sum, family) => sum + (family.usage?.timeSpentSeconds || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Family test
          </h1>
          <p className="text-gray-500 mt-1">
            Parents who asked for the private Godly Kids test. Open a row to see sessions, time, and pages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchFamilies}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || families.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Downloading…' : 'Download CSV'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          ['Signed up', String(families.length)],
          ['Opened the app', String(activeCount)],
          ['Sessions', String(totalSessions)],
          ['Time in app', formatDuration(totalSeconds)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {error && <p className="mb-4 text-red-700 font-medium">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-sm text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Sessions</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Last active</th>
              <th className="px-4 py-3 font-medium">Free until</th>
              <th className="px-4 py-3 font-medium">Survey</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-8 text-gray-500" colSpan={7}>Loading…</td></tr>
            ) : families.length === 0 ? (
              <tr><td className="px-4 py-8 text-gray-500" colSpan={7}>No families yet.</td></tr>
            ) : families.map((family) => {
              const usage = family.usage;
              const open = openId === family._id;
              const longest = usage?.pages?.[0]?.seconds || 1;
              const feedback = family.feedbackResponses?.length
                ? family.feedbackResponses[family.feedbackResponses.length - 1]
                : null;
              const answers = feedback ? [
                ['Signup hiccups', feedback.hiccups],
                ['Favorite things', feedback.favorites],
                ['Do not care for', feedback.dislikes],
                ['Library', feedback.library],
                ['Island builder', feedback.island],
              ] : [];
              return (
                <React.Fragment key={family._id}>
                  <tr
                    className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                    onClick={() => setOpenId(open ? null : family._id)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{family.parentName}</td>
                    <td className="px-4 py-3 text-gray-700">{family.email}</td>
                    <td className="px-4 py-3 text-gray-700">{usage?.sessions || 0}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDuration(usage?.timeSpentSeconds)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(usage?.lastActiveAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{family.grantedAt ? formatDate(new Date(new Date(family.grantedAt).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()) : 'Not yet'}</td>
                    <td className="px-4 py-3 text-gray-700">{feedback ? formatDate(feedback.submittedAt) : '—'}</td>
                  </tr>
                  {open && (
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td className="px-4 py-4" colSpan={7}>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900 mb-2">What they did</p>
                            <ul className="text-sm text-gray-700 space-y-1">
                              <li>{usage?.booksRead || 0} books</li>
                              <li>{usage?.pagesRead || 0} book pages</li>
                              <li>{usage?.songsPlayed || 0} songs</li>
                              <li>{usage?.gamesPlayed || 0} games</li>
                              <li>{usage?.lessonsCompleted || 0} lessons</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 mb-2">Time on pages</p>
                            {usage?.pages?.length ? usage.pages.map((page) => (
                              <div key={page.path} className="mb-2">
                                <div className="flex justify-between text-sm text-gray-700">
                                  <span>{page.label}</span>
                                  <span>{formatDuration(page.seconds)} · {page.visits}</span>
                                </div>
                                <div className="h-1.5 rounded bg-gray-200 mt-1">
                                  <div
                                    className="h-1.5 rounded bg-indigo-500"
                                    style={{ width: `${Math.max(8, Math.round((page.seconds / longest) * 100))}%` }}
                                  />
                                </div>
                              </div>
                            )) : (
                              <p className="text-sm text-gray-500">No page times yet. They appear after the family uses the updated app.</p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 mb-2">Recent</p>
                            {usage?.recent?.length ? (
                              <ul className="text-sm text-gray-700 space-y-1">
                                {usage.recent.map((visit, index) => (
                                  <li key={`${visit.path}-${visit.startedAt}-${index}`}>
                                    {visit.label} · {formatDuration(visit.seconds)} · {formatDate(visit.startedAt)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">Nothing recorded yet.</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-5">
                          <p className="text-sm font-medium text-gray-900 mb-2">Survey answers</p>
                          {feedback ? (
                            <div className="space-y-3">
                              {answers.map(([label, value]) => (
                                <div key={label}>
                                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || '—'}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No survey yet.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FamilyTest;
