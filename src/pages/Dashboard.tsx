import { useState } from 'react';
import EngagementDashboard from './EngagementDashboard';
import AccountDirectory from './AccountDirectory';
export default function Dashboard() {
  const [accounts, setAccounts] = useState(false);
  return <div className="space-y-6"><nav className="flex gap-2" aria-label="Dashboard views">
    <button className={`px-4 py-2 rounded-lg ${!accounts ? 'bg-indigo-600 text-white' : 'bg-white border'}`} onClick={() => setAccounts(false)}>App engagement</button>
    <button className={`px-4 py-2 rounded-lg ${accounts ? 'bg-indigo-600 text-white' : 'bg-white border'}`} onClick={() => setAccounts(true)}>Accounts · lifetime totals</button>
  </nav>{accounts ? <AccountDirectory /> : <EngagementDashboard />}</div>;
}
