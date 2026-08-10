import axios from 'axios';
import { API_BASE_URL } from './apiClient';

/**
 * Church portal auth + API helpers.
 * Church accounts are stored separately from admin/creator auth so a church
 * admin session never collides with the CMS session.
 */

const CHURCH_TOKEN_KEY = 'church_portal_token';
const CHURCH_DATA_KEY = 'church_portal_data';

export interface Church {
  id: string;
  name: string;
  contactName?: string;
  email: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  joinCode: string;
  subscriptionStatus: 'none' | 'active' | 'past_due' | 'cancelled';
  subscriptionPlan: 'church_monthly' | 'church_annual' | null;
  subscriptionActivatedAt?: string;
  memberCount: number;
  status: 'active' | 'suspended';
  entitled: boolean;
  joinUrl: string;
  createdAt: string;
}

export interface ChurchMember {
  id: string;
  name?: string;
  email?: string;
  app: 'godly-kids' | 'faith-defense';
  status?: string;
  joinedAt: string;
}

export const churchApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

churchApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(CHURCH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const churchAuth = {
  getToken: () => localStorage.getItem(CHURCH_TOKEN_KEY),
  isAuthenticated: () => !!localStorage.getItem(CHURCH_TOKEN_KEY),
  getCachedChurch: (): Church | null => {
    const data = localStorage.getItem(CHURCH_DATA_KEY);
    return data ? JSON.parse(data) : null;
  },
  setSession: (token: string, church: Church) => {
    localStorage.setItem(CHURCH_TOKEN_KEY, token);
    localStorage.setItem(CHURCH_DATA_KEY, JSON.stringify(church));
  },
  clearSession: () => {
    localStorage.removeItem(CHURCH_TOKEN_KEY);
    localStorage.removeItem(CHURCH_DATA_KEY);
  },
};

export const registerChurch = async (payload: {
  name: string;
  contactName?: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  state?: string;
  estimatedFamilies?: number;
}) => {
  const res = await churchApi.post('/api/church/register', payload);
  churchAuth.setSession(res.data.token, res.data.church);
  return res.data.church as Church;
};

export const loginChurch = async (email: string, password: string) => {
  const res = await churchApi.post('/api/church/login', { email, password });
  churchAuth.setSession(res.data.token, res.data.church);
  return res.data.church as Church;
};

export const fetchChurch = async (): Promise<Church> => {
  const res = await churchApi.get('/api/church/me');
  localStorage.setItem(CHURCH_DATA_KEY, JSON.stringify(res.data.church));
  return res.data.church;
};

export const fetchChurchMembers = async (): Promise<ChurchMember[]> => {
  const res = await churchApi.get('/api/church/members');
  return res.data.members;
};

export const removeChurchMember = async (memberId: string) => {
  await churchApi.delete(`/api/church/members/${memberId}`);
};

export const startChurchCheckout = async (plan: 'church_monthly' | 'church_annual') => {
  const origin = window.location.origin;
  const res = await churchApi.post('/api/church/create-checkout-session', {
    plan,
    successUrl: `${origin}/church?checkout=success`,
    cancelUrl: `${origin}/church?checkout=cancelled`,
  });
  return res.data.url as string;
};

export const openBillingPortal = async () => {
  const res = await churchApi.post('/api/church/billing-portal', {
    returnUrl: `${window.location.origin}/church`,
  });
  return res.data.url as string;
};

// Public funnel (no auth)
export const validateJoinCode = async (code: string) => {
  const res = await axios.get(`${API_BASE_URL}/api/church/code/${encodeURIComponent(code)}`);
  return res.data as { valid: boolean; church: { name: string; city?: string; state?: string } };
};

export const joinChurch = async (payload: {
  code: string;
  email: string;
  password: string;
  name?: string;
}) => {
  const res = await axios.post(`${API_BASE_URL}/api/church/join`, payload);
  return res.data as { success: boolean; premium: boolean; accountCreated: boolean; church: { name: string } };
};
