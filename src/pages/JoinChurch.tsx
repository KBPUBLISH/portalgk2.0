import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Gift, Mail, Lock, User, ArrowRight, Check, PartyPopper,
  Smartphone, Shield, BookOpen, KeyRound,
} from 'lucide-react';
import { validateJoinCode, joinChurch } from '../services/churchApi';

// App store links (override per environment)
const GODLY_KIDS_APP_URL =
  import.meta.env.VITE_GODLY_KIDS_APP_URL || 'https://app.godlykids.com';
const FAITH_DEFENSE_APP_URL =
  import.meta.env.VITE_FAITH_DEFENSE_APP_URL || 'https://faithdefense.app';

type Step = 'code' | 'signup' | 'success';

const JoinChurch: React.FC = () => {
  const { code: codeFromUrl } = useParams<{ code?: string }>();

  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState(codeFromUrl?.toUpperCase() || '');
  const [churchName, setChurchName] = useState('');
  const [validating, setValidating] = useState(!!codeFromUrl);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  const validate = async (candidate: string) => {
    setError('');
    setValidating(true);
    try {
      const result = await validateJoinCode(candidate.trim());
      setChurchName(result.church.name);
      setCode(candidate.trim().toUpperCase());
      setStep('signup');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid church code. Please double-check and try again.');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (codeFromUrl) validate(codeFromUrl);
  }, [codeFromUrl]);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) validate(code);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await joinChurch({ code, email, password, name: name || undefined });
      setAccountCreated(result.accountCreated);
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Hero */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-8 py-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/25 rounded-2xl mb-2">
            {step === 'success'
              ? <PartyPopper className="w-7 h-7 text-white" />
              : <Gift className="w-7 h-7 text-white" />}
          </div>
          <h1 className="text-xl font-bold text-white">
            {step === 'success' ? "You're all set!" : 'Free Premium Access'}
          </h1>
          <p className="text-white/90 text-sm mt-1">
            {churchName
              ? `A gift from ${churchName}`
              : 'Sponsored by your church'}
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Step 1: enter/validate code */}
          {step === 'code' && (
            validating ? (
              <div className="text-center py-8 text-gray-500 text-sm">Checking your church code...</div>
            ) : (
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <p className="text-sm text-gray-600">
                  Enter the code from your church bulletin, screen, or QR poster.
                </p>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-mono tracking-wider uppercase focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="GRACE-XXXXXX"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={validating}
                  className="w-full py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )
          )}

          {/* Step 2: create account */}
          {step === 'signup' && (
            <>
              <div className="mb-5 space-y-2">
                {[
                  { icon: BookOpen, text: 'Godly Kids premium — stories, lessons & games' },
                  { icon: Shield, text: 'Faith Defense premium included' },
                  { icon: Gift, text: '100% free — your church covers it' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="w-7 h-7 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 text-green-600" />
                    </span>
                    {text}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Your name"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="you@email.com"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Create a password (8+ characters)"
                    minLength={8}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Unlocking premium...' : (
                    <>
                      Claim Free Premium <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Use this same email to sign in inside the apps.
                </p>
              </form>
            </>
          )}

          {/* Step 3: success */}
          {step === 'success' && (
            <div className="space-y-5">
              <div className="p-4 bg-green-50 rounded-xl text-sm text-green-800 flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Premium unlocked{churchName ? `, sponsored by ${churchName}` : ''}!{' '}
                  {accountCreated
                    ? 'Your account has been created.'
                    : 'Your existing account has been upgraded.'}{' '}
                  Sign in with <strong>{email}</strong> in both apps.
                </span>
              </div>

              <div className="space-y-3">
                <a
                  href={GODLY_KIDS_APP_URL}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-4 h-4" /> Open Godly Kids
                </a>
                <a
                  href={FAITH_DEFENSE_APP_URL}
                  className="w-full py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4" /> Get Faith Defense
                </a>
              </div>

              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                <Smartphone className="w-3.5 h-3.5" />
                Available on iOS, Android, and the web
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinChurch;
