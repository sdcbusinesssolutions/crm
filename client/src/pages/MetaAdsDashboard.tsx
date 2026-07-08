import React, { useState, useEffect } from 'react';
import ClickToWhatsAppAnalytics from '../components/ClickToWhatsAppAnalytics';
import { tokenService } from '../services/tokenService';

const MetaAdsDashboard = () => {
  const [accountId, setAccountId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        setLoading(true);
        const authHeader = await tokenService.getAuthHeader();
        const response = await fetch('/api/click-to-whatsapp/accounts', {
          headers: { ...authHeader }
        });
        const result = await response.json();
        
        if (result.success && result.data?.adAccounts?.length > 0) {
          // Use the first connected ad account
          setAccountId(result.data.adAccounts[0].id.replace('act_', ''));
        } else {
          setError(result.error || 'No connected Ad Accounts found. Please connect Facebook first.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Meta Ads Dashboard...</div>;
  
  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 text-red-600 p-6 rounded-lg border border-red-100 max-w-2xl mx-auto">
        <h3 className="font-bold mb-2">Could not load Ads Manager</h3>
        <p>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto animate-fade-in h-full overflow-y-auto pb-32">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Meta Ads Manager</h1>
        <p className="text-slate-500">Manage your Click to WhatsApp campaigns and monitor performance.</p>
      </div>
      
      {accountId && <ClickToWhatsAppAnalytics accountId={accountId} />}
    </div>
  );
};

export default MetaAdsDashboard;
