import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Church as ChurchIcon, Mail, Lock, User, MapPin, ArrowRight, Sparkles, Check } from 'lucide-react';
import { registerChurch } from '../../services/churchApi';

const ChurchSignup: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    contactName: '',
    email: '',
    password: '',
    city: '',
    state: '',
    estimatedFamilies: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerChurch({
        name: form.name,
        contactName: form.contactName || undefined,
        email: form.email,
        password: form.password,
        city: form.city || undefined,
        state: form.state || undefined,
        estimatedFamilies: form.estimatedFamilies ? Number(form.estimatedFamilies) : undefined,
      });
      navigate('/church');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
        {/* Value proposition */}
        <div className="hidden md:block">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-6">
            <ChurchIcon className="w-8 h-8 text-amber-700" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Church Partnership Program
          </h1>
          <p className="text-gray-600 mb-6">
            One church subscription gives every family in your congregation free
            premium access to faith-building apps.
          </p>
          <ul className="space-y-3">
            {[
              'Free premium Godly Kids for every family',
              'Free premium Faith Defense included',
              'Unique church code + QR code to share',
              'Simple dashboard to see who joined',
              'Cancel anytime',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-gray-700">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-700" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="md:hidden text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 rounded-2xl mb-3">
              <ChurchIcon className="w-7 h-7 text-amber-700" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Church Partnership</h1>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Create your church account
          </h2>
          <p className="text-sm text-gray-500 mb-6">Set up in under two minutes.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Church name *</label>
              <div className="relative">
                <ChurchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={form.name}
                  onChange={update('name')}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Grace Community Church"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={form.contactName}
                  onChange={update('contactName')}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Pastor John Smith"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={form.city}
                    onChange={update('city')}
                    className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Dallas"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={update('state')}
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="TX"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="office@yourchurch.org"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Creating account...' : (
                <>
                  Create Church Account <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Already registered?{' '}
              <Link to="/church/login" className="text-amber-700 hover:text-amber-800 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChurchSignup;
