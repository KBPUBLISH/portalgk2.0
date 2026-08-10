import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Church as ChurchIcon, Users, ChevronDown, ChevronUp, Ban, CheckCircle, RefreshCw,
} from 'lucide-react';
import { API_BASE_URL } from '../../services/apiClient';

interface AdminChurch {
  id: string;
  name: string;
  contactName?: string;
  email: string;
  city?: string;
  state?: string;
  joinCode: string;
  subscriptionStatus: 'none' | 'active' | 'past_due' | 'cancelled';
  subscriptionPlan: string | null;
  memberCount: number;
  status: 'active' | 'suspended';
  createdAt: string;
}

interface AdminMember {
  id: string;
  name?: string;
  email?: string;
  app: string;
  status: string;
  joinedAt: string;
}

const SUB_BADGE: Record<string, string> = {
  none: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const adminHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('portal_admin_token')}` },
});

const Churches: React.FC = () => {
  const [churches, setChurches] = useState<AdminChurch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, AdminMember[]>>({});

  const fetchChurches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/church/admin/list`, adminHeaders());
      setChurches(res.data.churches || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load churches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChurches(); }, [fetchChurches]);

  const toggleMembers = async (churchId: string) => {
    if (expandedId === churchId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(churchId);
    if (!members[churchId]) {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/church/admin/${churchId}/members`, adminHeaders());
        setMembers((prev) => ({ ...prev, [churchId]: res.data.members || [] }));
      } catch {
        setMembers((prev) => ({ ...prev, [churchId]: [] }));
      }
    }
  };

  const updateChurch = async (churchId: string, payload: { status?: string; subscriptionStatus?: string }) => {
    try {
      await axios.patch(`${API_BASE_URL}/api/church/admin/${churchId}`, payload, adminHeaders());
      fetchChurches();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update church');
    }
  };

  const stats = {
    total: churches.length,
    active: churches.filter((c) => c.subscriptionStatus === 'active').length,
    members: churches.reduce((sum, c) => sum + (c.memberCount || 0), 0),
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChurchIcon className="w-7 h-7 text-amber-600" />
            Churches
          </h1>
          <p className="text-gray-500 text-sm mt-1">Church Partnership program accounts</p>
        </div>
        <button
          onClick={fetchChurches}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total churches', value: stats.total },
          { label: 'Active subscriptions', value: stats.active },
          { label: 'Sponsored members', value: stats.members },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading churches...</div>
      ) : churches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 text-center py-16 text-gray-400">
          <ChurchIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No churches registered yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Church</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {churches.map((c) => (
                <React.Fragment key={c.id}>
                  <tr className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {c.name}
                        {c.status === 'suspended' && (
                          <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">Suspended</span>
                        )}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {c.email}{c.city ? ` · ${c.city}${c.state ? `, ${c.state}` : ''}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{c.joinCode}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SUB_BADGE[c.subscriptionStatus]}`}>
                        {c.subscriptionStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.memberCount}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleMembers(c.id)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                          title="View members"
                        >
                          {expandedId === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {c.status === 'active' ? (
                          <button
                            onClick={() => {
                              if (window.confirm(`Suspend ${c.name}? Their code will stop working for new members.`)) {
                                updateChurch(c.id, { status: 'suspended' });
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                            title="Suspend church"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateChurch(c.id, { status: 'active' })}
                            className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                            title="Reactivate church"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> Members
                        </p>
                        {!members[c.id] ? (
                          <p className="text-gray-400 text-sm">Loading...</p>
                        ) : members[c.id].length === 0 ? (
                          <p className="text-gray-400 text-sm">No members yet.</p>
                        ) : (
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {members[c.id].map((m) => (
                              <div key={m.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                                <p className="text-gray-900 truncate">{m.name || m.email || '—'}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {m.email} · {m.app === 'godly-kids' ? 'Godly Kids' : 'Faith Defense'}
                                  {m.status !== 'active' && ' · removed'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Churches;
