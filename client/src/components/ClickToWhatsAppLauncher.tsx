import React, { useState, useEffect } from 'react';
import './ClickToWhatsAppLauncher.css';

const ClickToWhatsAppLauncher = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    adAccountId: '',
    pageId: '',
    campaignName: 'New Click to WhatsApp Campaign',
    dailyBudget: 10,
    headline: 'Chat with us on WhatsApp!',
    primaryText: 'Click below to instantly connect with our team via WhatsApp.',
    imageUrl: '',
    targetCountries: '',
    minAge: 18,
    maxAge: 65,
    gender: 'all',
    startDate: '',
    endDate: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');
  
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const token = localStorage.getItem('supabase.auth.token') 
              ? JSON.parse(localStorage.getItem('supabase.auth.token') || '{}').currentSession?.access_token
              : null;
        const res = await fetch('/api/click-to-whatsapp/accounts', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const result = await res.json();
        if (res.ok && result.success) {
          setAdAccounts(result.data.adAccounts || []);
          setPages(result.data.pages || []);
          if (result.data.adAccounts?.length > 0) {
            setFormData(prev => ({ ...prev, adAccountId: result.data.adAccounts[0].account_id }));
          }
          if (result.data.pages?.length > 0) {
            setFormData(prev => ({ ...prev, pageId: result.data.pages[0].id }));
          }
        }
      } catch (err) {
        console.error("Failed to load accounts:", err);
      } finally {
        setAccountsLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep !== totalSteps) {
      nextStep();
      return;
    }

    setLoading(true);
    setError('');
    setSuccessData(null);

    try {
      const token = localStorage.getItem('supabase.auth.token') 
            ? JSON.parse(localStorage.getItem('supabase.auth.token') || '{}').currentSession?.access_token
            : null;
      
      const response = await fetch('/api/click-to-whatsapp/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to launch ad');
      }

      setSuccessData(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const stepLabels = ['Details', 'Audience', 'Investment', 'Overview'];
    return (
      <div className="ctwa-step-indicator">
        {stepLabels.map((label, index) => (
          <div key={index} className={`ctwa-step ${currentStep === index + 1 ? 'active' : ''} ${currentStep > index + 1 ? 'completed' : ''}`}>
            <div className="ctwa-step-number">{currentStep > index + 1 ? '✓' : index + 1}</div>
            <div className="ctwa-step-label">{label}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="ctwa-container">
      <div className="ctwa-layout-wrapper">
        <div className="ctwa-card ctwa-form-card">
          <div className="ctwa-header">
            <div className="ctwa-icon-container">
              <svg viewBox="0 0 24 24" fill="currentColor" className="ctwa-icon">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.205.534 1.292.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.665.592 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.392-10.61c-4.418 0-8 3.582-8 8s3.582 8 8 8c1.396 0 2.709-.356 3.844-.981l4.156 1.089-1.111-4.053c.699-1.203 1.111-2.607 1.111-4.055 0-4.418-3.582-8-8-8z"/>
              </svg>
            </div>
            <h2>Launch WhatsApp Ad</h2>
            <p>Drive conversations directly from Facebook & Instagram.</p>
          </div>

          {renderStepIndicator()}

          <form onSubmit={handleSubmit} className="ctwa-form">
            {currentStep === 1 && (
              <div className="ctwa-step-content">
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Ad Account</label>
                    {accountsLoading ? (
                       <div className="animate-pulse bg-gray-200 h-10 rounded-xl w-full"></div>
                    ) : adAccounts.length > 0 ? (
                      <select name="adAccountId" value={formData.adAccountId} onChange={handleChange} required className="ctwa-select">
                        {adAccounts.map(account => (
                          <option key={account.id} value={account.account_id}>{account.name} ({account.account_id})</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        name="adAccountId" 
                        placeholder="No accounts found. Enter ID manually e.g. 1234567890" 
                        value={formData.adAccountId}
                        onChange={handleChange}
                        required 
                      />
                    )}
                  </div>

                  <div className="ctwa-form-group">
                    <label>Facebook Page</label>
                    {accountsLoading ? (
                       <div className="animate-pulse bg-gray-200 h-10 rounded-xl w-full"></div>
                    ) : pages.length > 0 ? (
                      <select name="pageId" value={formData.pageId} onChange={handleChange} required className="ctwa-select">
                        {pages.map(page => (
                          <option key={page.id} value={page.id}>{page.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        name="pageId" 
                        placeholder="No pages found. Enter ID manually e.g. 9876543210" 
                        value={formData.pageId}
                        onChange={handleChange}
                        required 
                      />
                    )}
                  </div>
                </div>

                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Campaign Name</label>
                    <input 
                      type="text" 
                      name="campaignName" 
                      value={formData.campaignName}
                      onChange={handleChange}
                      required 
                    />
                  </div>

                  <div className="ctwa-form-group">
                    <label>Headline</label>
                    <input 
                      type="text" 
                      name="headline" 
                      value={formData.headline}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                </div>

                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Primary Text</label>
                    <textarea 
                      name="primaryText" 
                      rows={1}
                      value={formData.primaryText}
                      onChange={handleChange}
                      required 
                      style={{ minHeight: '42px', resize: 'vertical' }}
                    />
                  </div>

                  <div className="ctwa-form-group">
                    <label>Image URL</label>
                    <input 
                      type="url" 
                      name="imageUrl" 
                      placeholder="e.g. https://yourwebsite.com/image.jpg" 
                      value={formData.imageUrl}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="ctwa-step-content">
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Target Countries (Comma-separated codes)</label>
                    <input 
                      type="text" 
                      name="targetCountries" 
                      placeholder="e.g. US, IN, GB" 
                      value={formData.targetCountries}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label>Min Age</label>
                    <input 
                      type="number" 
                      name="minAge" 
                      min="18" 
                      max="65"
                      value={formData.minAge}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                </div>

                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Max Age</label>
                    <input 
                      type="number" 
                      name="maxAge" 
                      min="18" 
                      max="65"
                      value={formData.maxAge}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label>Gender</label>
                    <select name="gender" value={formData.gender} onChange={handleChange} required className="ctwa-select">
                      <option value="all">All Genders</option>
                      <option value="1">Men</option>
                      <option value="2">Women</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="ctwa-step-content">
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Daily Budget (USD)</label>
                    <input 
                      type="number" 
                      name="dailyBudget" 
                      min="1"
                      step="0.01"
                      value={formData.dailyBudget}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label>Start Date (Optional)</label>
                    <input 
                      type="datetime-local" 
                      name="startDate" 
                      value={formData.startDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>End Date (Optional)</label>
                    <input 
                      type="datetime-local" 
                      name="endDate" 
                      value={formData.endDate}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="ctwa-form-group">
                    {/* Empty placeholder to keep column aligned */}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="ctwa-step-content">
                <div className="ctwa-summary">
                  <h3>Campaign Overview</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Campaign Name:</span>
                      <span className="summary-value">{formData.campaignName}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Ad Account:</span>
                      <span className="summary-value">{formData.adAccountId}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Page ID:</span>
                      <span className="summary-value">{formData.pageId}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Daily Budget:</span>
                      <span className="summary-value">${formData.dailyBudget}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Locations:</span>
                      <span className="summary-value">{formData.targetCountries || 'Global'}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Demographics:</span>
                      <span className="summary-value">{formData.minAge}-{formData.maxAge} yrs, {formData.gender === 'all' ? 'All Genders' : formData.gender === '1' ? 'Men' : 'Women'}</span>
                    </div>
                  </div>
                </div>

                {error && <div className="ctwa-error">{error}</div>}
                
                {successData && (
                  <div className="ctwa-success">
                    <h4>Ad Launched Successfully!</h4>
                    <ul>
                      <li>Campaign ID: {successData.campaignId}</li>
                      <li>Ad Set ID: {successData.adSetId}</li>
                      <li>Ad ID: {successData.adId}</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="ctwa-actions">
              {currentStep > 1 && !successData && (
                <button type="button" onClick={prevStep} className="ctwa-back-btn">
                  Back
                </button>
              )}
              
              {!successData && (
                <button type="submit" disabled={loading} className="ctwa-submit-btn">
                  {currentStep === totalSteps ? (loading ? 'Launching Ad...' : 'Launch WhatsApp Ad') : 'Next'}
                </button>
              )}

              {successData && (
                <button type="button" onClick={() => {
                  setSuccessData(null);
                  setCurrentStep(1);
                  setFormData({...formData, campaignName: 'New Campaign ' + Date.now()});
                }} className="ctwa-submit-btn">
                  Create Another Ad
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Live Preview Panel */}
        <div className="ctwa-preview-panel">
          <div className="ctwa-premium-preview">
            <div className="premium-preview-glass">
              <div className="premium-preview-header">
                <div className="premium-avatar-group">
                  <div className="premium-avatar">
                    {formData.pageId && pages.length > 0 
                      ? pages.find(p => p.id === formData.pageId)?.name?.charAt(0).toUpperCase() || 'W' 
                      : (formData.pageId ? formData.pageId.charAt(0).toUpperCase() : 'W')}
                  </div>
                  <div className="premium-header-info">
                    <strong>
                      {formData.pageId && pages.length > 0 
                        ? pages.find(p => p.id === formData.pageId)?.name || 'Your Brand' 
                        : (formData.pageId || 'Your Brand')}
                    </strong>
                    <span>Sponsored Ad</span>
                  </div>
                </div>
                <div className="premium-whatsapp-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.205.534 1.292.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.665.592 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.392-10.61c-4.418 0-8 3.582-8 8s3.582 8 8 8c1.396 0 2.709-.356 3.844-.981l4.156 1.089-1.111-4.053c.699-1.203 1.111-2.607 1.111-4.055 0-4.418-3.582-8-8-8z"/>
                  </svg>
                  WhatsApp
                </div>
              </div>
              
              <div className="premium-preview-body">
                <p className="premium-caption">
                  {formData.primaryText || 'Your compelling ad copy will appear here. Write something that drives action!'}
                </p>
                
                <div className="premium-media-container">
                  {formData.imageUrl && formData.imageUrl.startsWith('http') ? (
                    <div className="premium-image-wrapper">
                      <img 
                        src={formData.imageUrl} 
                        alt="Ad Creative Preview" 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="%23f1f5f9"/><text x="200" y="100" font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="middle" fill="%2394a3b8">Invalid Image URL</text></svg>';
                        }}
                      />
                      <div className="premium-image-overlay"></div>
                    </div>
                  ) : (
                    <div className="premium-placeholder">
                      <div className="premium-pulse-ring"></div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
                        <circle cx="8.5" cy="8.5" r="2"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                      <span>Visual Creative</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="premium-preview-footer">
                <div className="premium-footer-content">
                  <span className="premium-chat-label">CHAT WITH US</span>
                  <strong className="premium-headline">{formData.headline || 'Your Catchy Headline'}</strong>
                </div>
                <button className="premium-cta-btn">
                  Send Message
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
            </div>
          </div>
          

        </div>
      </div>
    </div>
  );
};

export default ClickToWhatsAppLauncher;
