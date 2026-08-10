import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Church as ChurchIcon, Users, QrCode, Copy, Check, CreditCard, LogOut,
  Download, Trash2, AlertTriangle, PartyPopper, Sparkles, ExternalLink,
} from 'lucide-react';
import {
  churchAuth, fetchChurch, fetchChurchMembers, removeChurchMember,
  startChurchCheckout, openBillingPortal,
  type Church, type ChurchMember,
} from '../../services/churchApi';

const APP_LABELS: Record<string, string> = {
  'godly-kids': 'Godly Kids',
  'faith-defense': 'Faith Defense',
};

const STATUS_BADGES: Record<Church['subscriptionStatus'], { label: string; className: string }> = {
  none: { label: 'Not subscribed', className: 'bg-gray-100 text-gray-600' },
  active: { label: 'Active', className: 'bg-green-100 text-green-700' },
  past_due: { label: 'Payment past due', className: 'bg-yellow-100 text-yellow-700' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
};

const ChurchDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [church, setChurch] = useState<Church | null>(churchAuth.getCachedChurch());
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(searchParams.get('checkout') === 'success');

  const loadData = useCallback(async () => {
    try {
      const [churchData, memberData] = await Promise.all([fetchChurch(), fetchChurchMembers()]);
      setChurch(churchData);
      setMembers(memberData);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        churchAuth.clearSession();
        navigate('/church/login');
        return;
      }
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!churchAuth.isAuthenticated()) {
      navigate('/church/login');
      return;
    }
    loadData();
  }, [loadData, navigate]);

  // Stripe webhooks can lag a few seconds behind the redirect — refetch briefly after checkout
  useEffect(() => {
    if (searchParams.get('checkout') !== 'success') return;
    setSearchParams({}, { replace: true });
    const interval = setInterval(loadData, 3000);
    const timeout = setTimeout(() => clearInterval(interval), 30000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [searchParams, setSearchParams, loadData]);

  useEffect(() => {
    if (!church?.joinUrl) return;
    QRCode.toDataURL(church.joinUrl, { width: 512, margin: 2, color: { dark: '#1f2937' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [church?.joinUrl]);

  const copy = (value: string, which: 'code' | 'link') => {
    navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCheckout = async (plan: 'church_monthly' | 'church_annual') => {
    setCheckoutLoading(plan);
    setError('');
    try {
      const url = await startChurchCheckout(plan);
      window.location.href = url;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start checkout');
      setCheckoutLoading(null);
    }
  };

  const handleBilling = async () => {
    try {
      const url = await openBillingPortal();
      window.location.href = url;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to open billing portal');
    }
  };

  const handleRemoveMember = async (member: ChurchMember) => {
    if (!window.confirm(`Remove ${member.name || member.email}? Their sponsored premium access will end.`)) return;
    try {
      await removeChurchMember(member.id);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleLogout = () => {
    churchAuth.clearSession();
    navigate('/church/login');
  };

  if (loading && !church) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        Loading your dashboard...
      </div>
    );
  }

  if (!church) return null;

  const badge = STATUS_BADGES[church.subscriptionStatus];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <ChurchIcon className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{church.name}</h1>
              <p className="text-xs text-gray-500">Church Partnership Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {showCheckoutSuccess && (
          <div className="p-4 bg-green-50 text-green-800 rounded-xl text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <PartyPopper className="w-4 h-4 flex-shrink-0" />
              Thank you! Your subscription is being activated — this page will update automatically.
            </span>
            <button onClick={() => setShowCheckoutSuccess(false)} className="text-green-600 font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* Subscribe CTA when not active */}
        {!church.entitled && (
          <section className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Activate your church subscription
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              One subscription unlocks free premium access to <strong>Godly Kids</strong> and{' '}
              <strong>Faith Defense</strong> for everyone in your congregation.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-5 flex flex-col">
                <h3 className="font-semibold text-gray-900">Monthly</h3>
                <p className="text-sm text-gray-500 mb-4 flex-1">Flexible month-to-month billing. Cancel anytime.</p>
                <button
                  onClick={() => handleCheckout('church_monthly')}
                  disabled={!!checkoutLoading}
                  className="w-full py-2.5 bg-white border-2 border-amber-600 text-amber-700 rounded-lg font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  {checkoutLoading === 'church_monthly' ? 'Redirecting...' : 'Choose Monthly'}
                </button>
              </div>
              <div className="border-2 border-amber-500 rounded-xl p-5 flex flex-col relative">
                <span className="absolute -top-3 left-4 px-2 py-0.5 bg-amber-500 text-white text-xs font-semibold rounded-full">
                  Best value
                </span>
                <h3 className="font-semibold text-gray-900">Annual</h3>
                <p className="text-sm text-gray-500 mb-4 flex-1">One payment covers your congregation all year.</p>
                <button
                  onClick={() => handleCheckout('church_annual')}
                  disabled={!!checkoutLoading}
                  className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {checkoutLoading === 'church_annual' ? 'Redirecting...' : 'Choose Annual'}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Final pricing is shown at secure Stripe checkout.
            </p>
          </section>
        )}

        {/* Join code + QR */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-600" />
              Your church code
            </h2>
            {church.subscriptionStatus !== 'none' && (
              <button
                onClick={handleBilling}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
              >
                <CreditCard className="w-4 h-4" /> Manage billing
              </button>
            )}
          </div>

          {!church.entitled && (
            <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
              Your code becomes redeemable once your subscription is active.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Share this code</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 tracking-wider">
                    {church.joinCode}
                  </span>
                  <button
                    onClick={() => copy(church.joinCode, 'code')}
                    className="p-2.5 border border-gray-200 rounded-lg text-gray-500 hover:text-amber-600 hover:border-amber-300 transition-colors"
                    title="Copy code"
                  >
                    {copied === 'code' ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Or share the link</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 truncate">
                    {church.joinUrl}
                  </span>
                  <button
                    onClick={() => copy(church.joinUrl, 'link')}
                    className="p-2.5 border border-gray-200 rounded-lg text-gray-500 hover:text-amber-600 hover:border-amber-300 transition-colors"
                    title="Copy link"
                  >
                    {copied === 'link' ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Put the QR code in your bulletin, on slides, or on a lobby poster. Families scan it,
                create an account, and instantly get premium access to Godly Kids and Faith Defense —
                sponsored by your church.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center">
              {qrDataUrl ? (
                <>
                  <img src={qrDataUrl} alt="Church join QR code" className="w-44 h-44 border border-gray-200 rounded-xl" />
                  <a
                    href={qrDataUrl}
                    download={`${church.joinCode}-qr.png`}
                    className="mt-3 text-sm text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Download QR code
                  </a>
                </>
              ) : (
                <div className="w-44 h-44 border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-300">
                  <QrCode className="w-10 h-10" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Members */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-amber-600" />
            Members ({members.length})
          </h2>

          {members.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No members yet. Share your code or QR to get families signed up.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">App</th>
                    <th className="py-2 pr-4">Joined</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 pr-4 text-gray-900">{m.name || '—'}</td>
                      <td className="py-3 pr-4 text-gray-600">{m.email || '—'}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.app === 'godly-kids' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'
                        }`}>
                          {APP_LABELS[m.app] || m.app}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleRemoveMember(m)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-gray-400 pb-6 flex items-center justify-center gap-1">
          Need help? Contact support
          <ExternalLink className="w-3 h-3" />
        </p>
      </main>
    </div>
  );
};

export default ChurchDashboard;
