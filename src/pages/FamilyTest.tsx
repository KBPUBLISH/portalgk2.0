import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Users } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

interface FamilySignup {
  _id: string;
  email: string;
  parentName: string;
  createdAt: string;
  emailSentAt?: string;
  grantedAt?: string;
  revenueCatGranted?: boolean;
}

const FamilyTest: React.FC = () => {
  const [families, setFamilies] = useState<FamilySignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Family test
          </h1>
          <p className="text-gray-500 mt-1">
            Parents who asked for the private Godly Kids test. {families.length} signed up.
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

      {error && <p className="mb-4 text-red-700 font-medium">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-sm text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Signed up</th>
              <th className="px-4 py-3 font-medium">Email sent</th>
              <th className="px-4 py-3 font-medium">Lifetime access</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-8 text-gray-500" colSpan={5}>Loading…</td></tr>
            ) : families.length === 0 ? (
              <tr><td className="px-4 py-8 text-gray-500" colSpan={5}>No families yet.</td></tr>
            ) : families.map((family) => (
              <tr key={family._id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-900">{family.parentName}</td>
                <td className="px-4 py-3 text-gray-700">{family.email}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(family.createdAt)}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(family.emailSentAt)}</td>
                <td className="px-4 py-3 text-gray-600">{family.grantedAt ? formatDate(family.grantedAt) : 'Not yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FamilyTest;
