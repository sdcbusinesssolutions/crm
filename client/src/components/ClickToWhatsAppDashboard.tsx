import React, { useState, useEffect } from 'react';
import './ClickToWhatsAppDashboard.css';
import ClickToWhatsAppLauncher from './ClickToWhatsAppLauncher';
import { settingsService } from '../services/settingsService';
import { tokenService } from '../services/tokenService';

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}
interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

interface AdAccount {
  id: string;
  account_id: string;
  name: string;
  currency?: string;
  balance?: number;
}

const ClickToWhatsAppDashboard = () => {
  const [activeTab, setActiveTab] = useState<'pages' | 'ads'>('pages');
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedAdAccount, setSelectedAdAccount] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const authHeader = await tokenService.getAuthHeader();
      const res = await fetch('/api/click-to-whatsapp/accounts', {
        headers: authHeader
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setPages(result.data.pages || []);
        
        // Use real data if it exists, otherwise fall back to mock data for UI testing
        if (result.data.adAccounts && result.data.adAccounts.length > 0) {
           setAdAccounts(result.data.adAccounts);
        } else {
           setAdAccounts([
             { id: '1', account_id: '853910235680563', name: 'HD Techs Admin', currency: 'USD', balance: 0 },
             { id: '2', account_id: '1634398143758884', name: 'Epiphany Publication', currency: 'INR', balance: 0 },
             { id: '3', account_id: '897350962172923', name: 'Cybersync Technologies Ad Account', currency: 'INR', balance: 24540 },
             { id: '4', account_id: '913506310415028', name: 'Biproraj Personal Ad Ac', currency: 'INR', balance: 0 },
           ]);
        }
      } else {
        if (res.status === 400 || res.status === 500) {
          alert('Error fetching accounts: ' + (result.error || 'Unknown error'));
        }
        // For development/UI testing: Show mock data if token is missing
        setAdAccounts([
          { id: '1', account_id: '853910235680563', name: 'HD Techs Admin', currency: 'USD', balance: 0 },
          { id: '2', account_id: '1634398143758884', name: 'Epiphany Publication', currency: 'INR', balance: 0 },
          { id: '3', account_id: '897350962172923', name: 'Cybersync Technologies Ad Account', currency: 'INR', balance: 24540 },
          { id: '4', account_id: '913506310415028', name: 'Biproraj Personal Ad Ac', currency: 'INR', balance: 0 },
        ]);
      }
    } catch (err) {
      console.error("Failed to fetch pages:", err);
      // Fallback on catch block as well
      setAdAccounts([
        { id: '1', account_id: '853910235680563', name: 'HD Techs Admin (Mock)', currency: 'USD', balance: 0 },
        { id: '2', account_id: '1634398143758884', name: 'Epiphany Publication (Mock)', currency: 'INR', balance: 0 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadEmbeddedConfig = async () => {
    try {
      const data = await settingsService.getEmbeddedSignupConfig();
      if (data && data.appId) {
        setAppId(data.appId);
        if (data.configId) setConfigId(data.configId);
      }
    } catch (err) {
      console.error("Failed to load embedded config for FB Ads:", err);
    }
  };

  useEffect(() => {
    fetchPages();
    loadEmbeddedConfig();
  }, []);

  const loadFacebookSDK = (appId: string): Promise<void> => {
    return new Promise((resolve) => {
      if (window.FB) {
        resolve();
        return;
      }
      
      window.fbAsyncInit = function() {
        window.FB.init({
          appId      : appId,
          cookie     : true,
          xfbml      : true,
          version    : 'v20.0'
        });
        resolve();
      };
      
      const loadScript = () => {
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";
        document.body.appendChild(script);
      };
      
      if (!document.getElementById('facebook-jssdk')) {
        loadScript();
      }
    });
  };

  const handleConnectFacebook = async () => {
    const finalAppId = appId || '1046904630557061';
    const finalConfigId = configId || '976277771227161';
    
    await loadFacebookSDK(finalAppId);
    
    window.FB.login((response: any) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        const accessToken = response.authResponse.accessToken;
        
        // Send token/code to backend
        tokenService.getAuthHeader().then(authHeader => {
          fetch('/api/click-to-whatsapp/auth', {
            method: 'POST',
            headers: {
              ...authHeader
            },
            body: JSON.stringify({ code: code, accessToken: accessToken })
          })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              fetchPages(); // Refresh the pages and ads data
              alert('Facebook account connected successfully for Ads.');
            } else {
              alert('Error connecting Facebook: ' + (data.error || 'Unknown error'));
            }
          })
          .catch(err => {
            console.error("Auth token exchange failed", err);
            alert('Failed to connect Facebook account.');
          });
        });
      } else {
        console.log('User cancelled login or did not fully authorize.');
      }
    }, { 
      config_id: finalConfigId,
      response_type: 'code',
      override_default_response_type: true,
      scope: 'ads_management,pages_show_list,pages_read_engagement,pages_manage_ads', 
      return_scopes: true 
    });
  };

  const handleSyncPages = () => {
    fetchPages();
  };

  const filteredPages = pages.filter(page => 
    page.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    page.id.includes(searchTerm)
  );

  const paginatedPages = filteredPages.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const totalPages = Math.ceil(filteredPages.length / rowsPerPage);

  return (
    <div className="ctwa-dash-container">
      {/* Header section matching the screenshot */}
      <div className="ctwa-dash-header-row">
        <div>
          <h1 className="ctwa-dash-title">Click To WhatsApp Ads</h1>
          <p className="ctwa-dash-subtitle">Connect your Facebook account to manage pages and ads.</p>
        </div>
        
        <div className="ctwa-dash-actions">
          <div className="ctwa-dash-tabs">
            <button 
              className={`ctwa-tab-btn ${activeTab === 'pages' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pages'); setSelectedAdAccount(null); setSearchTerm(''); }}
            >
              Pages
            </button>
            <button 
              className={`ctwa-tab-btn ${activeTab === 'ads' ? 'active' : ''}`}
              onClick={() => { setActiveTab('ads'); setSelectedAdAccount(null); setSearchTerm(''); }}
            >
              Ads
            </button>
          </div>

          {activeTab === 'ads' ? (
            <button className="ctwa-btn ctwa-btn-secondary" onClick={handleSyncPages}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ctwa-btn-icon text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Sync Ads
            </button>
          ) : (
            <button className="ctwa-btn ctwa-btn-secondary" onClick={handleSyncPages}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ctwa-btn-icon text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Sync Pages
            </button>
          )}

          <button 
            className="ctwa-btn ctwa-btn-create-ad" 
            onClick={() => {
              if (adAccounts.length > 0) {
                setSelectedAdAccount(adAccounts[0].account_id);
                setActiveTab('ads');
              } else {
                alert('Please connect your Facebook account and ensure you have an active Ad Account first.');
              }
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ctwa-btn-icon">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create WhatsApp Ad
          </button>

          <button className="ctwa-btn ctwa-btn-primary" onClick={handleConnectFacebook}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ctwa-btn-icon text-white">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
            </svg>
            Connect Facebook
          </button>
        </div>
      </div>

      {activeTab === 'pages' && (
        <div className="ctwa-dash-content">
          <div className="ctwa-dash-toolbar">
            <div className="ctwa-search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                placeholder="Search pages..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="ctwa-toolbar-actions">
              <button className="ctwa-toolbar-btn text-green-600" onClick={handleSyncPages}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <polyline points="23 20 23 14 17 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                Sync Social Account
              </button>
              <button className="ctwa-toolbar-btn" onClick={handleSyncPages}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Refresh
              </button>
              <button className="ctwa-toolbar-icon-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14"></line>
                  <line x1="4" y1="10" x2="4" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12" y2="3"></line>
                  <line x1="20" y1="21" x2="20" y2="16"></line>
                  <line x1="20" y1="12" x2="20" y2="3"></line>
                  <line x1="1" y1="14" x2="7" y2="14"></line>
                  <line x1="9" y1="8" x2="15" y2="8"></line>
                  <line x1="17" y1="16" x2="23" y2="16"></line>
                </svg>
              </button>
            </div>
          </div>

          <div className="ctwa-table-container">
            <table className="ctwa-table">
              <thead>
                <tr>
                  <th>Page Name <span>↕</span></th>
                  <th>Page ID</th>
                  <th>Instagram Connected</th>
                  <th>WhatsApp Connected</th>
                  <th>IG Username</th>
                  <th>Default</th>
                  <th>Status</th>
                  <th>Created At <span>↕</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-500">Loading pages...</td></tr>
                ) : paginatedPages.length > 0 ? (
                  paginatedPages.map(page => (
                    <tr key={page.id}>
                      <td className="ctwa-page-name-cell">
                        <div className="ctwa-page-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="3" y1="9" x2="21" y2="9"></line>
                            <line x1="9" y1="21" x2="9" y2="9"></line>
                          </svg>
                        </div>
                        <div>
                          <strong>{page.name}</strong>
                          <span className="ctwa-page-category">SOFTWARE COMPANY</span>
                        </div>
                      </td>
                      <td><span className="ctwa-badge-gray">{page.id}</span></td>
                      <td><span className="ctwa-badge-warning">No</span></td>
                      <td><span className="ctwa-badge-success">Yes</span></td>
                      <td>-</td>
                      <td>
                        <div className="ctwa-toggle-switch">
                           <input type="checkbox" id={`toggle-${page.id}`} />
                           <label htmlFor={`toggle-${page.id}`}></label>
                        </div>
                      </td>
                      <td><span className="ctwa-badge-connected">✓ Connected</span></td>
                      <td>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-500">No pages found. Click 'Connect Facebook' to start.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ctwa-pagination">
            <div className="ctwa-rows-per-page">
              ROWS PER PAGE 
              <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="ctwa-showing-text">
              Showing {filteredPages.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to {Math.min(currentPage * rowsPerPage, filteredPages.length)} of {filteredPages.length} results
            </div>
            <div className="ctwa-page-controls">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}>&lt;</button>
              <button className="active">{currentPage}</button>
              <button disabled={currentPage >= totalPages || totalPages === 0} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}>&gt;</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ads' && !selectedAdAccount && (
        <div className="ctwa-dash-content">
          <div className="ctwa-dash-toolbar">
            <div className="ctwa-search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                placeholder="Search ad accounts..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="ctwa-toolbar-actions">
              <button className="ctwa-toolbar-btn" onClick={handleSyncPages}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Refresh
              </button>
              <button className="ctwa-toolbar-icon-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14"></line>
                  <line x1="4" y1="10" x2="4" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12" y2="3"></line>
                  <line x1="20" y1="21" x2="20" y2="16"></line>
                  <line x1="20" y1="12" x2="20" y2="3"></line>
                  <line x1="1" y1="14" x2="7" y2="14"></line>
                  <line x1="9" y1="8" x2="15" y2="8"></line>
                  <line x1="17" y1="16" x2="23" y2="16"></line>
                </svg>
              </button>
            </div>
          </div>

          <div className="ctwa-table-container">
            <table className="ctwa-table">
              <thead>
                <tr>
                  <th>Account Name <span>↕</span></th>
                  <th>Account ID</th>
                  <th>Currency</th>
                  <th>Balance</th>
                  <th>Has Payment Method</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500">Loading ad accounts...</td></tr>
                ) : adAccounts.length > 0 ? (
                  adAccounts.filter(acc => acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || acc.account_id.includes(searchTerm)).map(account => (
                    <tr key={account.id}>
                      <td className="ctwa-page-name-cell">
                        <div className="ctwa-fb-icon">f</div>
                        <div>
                          <strong>{account.name}</strong>
                          <span className="ctwa-page-category">USD ACCOUNT</span>
                        </div>
                      </td>
                      <td><span className="ctwa-badge-gray">act_{account.account_id}</span></td>
                      <td><strong>{account.currency || 'USD'}</strong></td>
                      <td><strong>{account.balance !== undefined ? account.balance : 0} {account.currency || 'USD'}</strong></td>
                      <td><span className="ctwa-badge-success">✓ Yes</span></td>
                      <td><span className="ctwa-badge-active">Active</span></td>
                      <td>
                        <button 
                          className="ctwa-create-ad-table-btn"
                          onClick={() => {
                            setSelectedAdAccount(account.account_id);
                            setActiveTab('ads');
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                          Create Ad
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500">No ad accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ads' && selectedAdAccount && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <button 
              onClick={() => setSelectedAdAccount(null)}
              className="ctwa-back-link"
            >
              &larr; Back to Ad Accounts
            </button>
          </div>
          <ClickToWhatsAppLauncher />
        </div>
      )}
    </div>
  );
};

export default ClickToWhatsAppDashboard;
