import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { tokenService } from '../services/tokenService';
import Select from 'react-select';
import './ClickToWhatsAppLauncher.css';

const countryOptions = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IN', label: 'India' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'PH', label: 'Philippines' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' }
];

const ClickToWhatsAppLauncher = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    adAccountId: '',
    pageId: '',
    campaignName: '',
    dailyBudget: '',
    headline: 'Chat with us on WhatsApp!',
    primaryText: 'Get instant support and exclusive offers right in your WhatsApp inbox.',
    imageUrl: '',
    targetCountries: '',
    minAge: '18',
    maxAge: '65',
    gender: 'all',
    startDate: '',
    endDate: '',
    welcomeMessageText: 'Hi! I am interested in this.',
    iceBreakerText: 'I am interested!',
    description: '',
    status: 'PAUSED'
  });
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const authHeader = await tokenService.getAuthHeader();
        const res = await fetch('/api/click-to-whatsapp/accounts', {
          headers: authHeader
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

  const selectedAccount = adAccounts.find(acc => acc.account_id === formData.adAccountId);
  const currencyCode = selectedAccount?.currency || 'USD';
  
  const currencySymbolMap: Record<string, string> = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    GBP: '£',
    AUD: 'A$',
    CAD: 'C$',
    BRL: 'R$',
    MXN: '$',
  };
  const currencySymbol = currencySymbolMap[currencyCode] || currencyCode + ' ';

  const validateStep = (step: number) => {
    const errors: string[] = [];
    if (step === 1) {
      if (!formData.campaignName) errors.push("Campaign Name is required");
      if (!formData.headline || formData.headline.length > 40) errors.push("Headline must be 1-40 characters");
      if (!formData.primaryText || formData.primaryText.length > 500) errors.push("Primary text must be 1-500 characters");
      if (formData.description && formData.description.length > 255) errors.push("Description must be under 255 characters");
      if (!formData.welcomeMessageText || formData.welcomeMessageText.length > 80) errors.push("Welcome Message must be 1-80 characters");
      if (!formData.iceBreakerText || formData.iceBreakerText.length > 80) errors.push("Ice Breaker button text must be 1-80 characters");
      if (!formData.imageUrl) errors.push("Ad Image is required");
    } else if (step === 2) {
      if (!formData.targetCountries) errors.push("Select at least one Target Country");
      const minAge = parseInt(formData.minAge);
      const maxAge = parseInt(formData.maxAge);
      if (minAge < 13 || maxAge > 65 || minAge > maxAge) errors.push("Valid age range is 13 to 65, and min age must be less than or equal to max age");
    } else if (step === 3) {
      const budget = parseFloat(formData.dailyBudget);
      if (isNaN(budget) || budget <= 0) errors.push("Daily budget must be greater than 0");
      if (formData.startDate && formData.endDate) {
        if (new Date(formData.startDate) >= new Date(formData.endDate)) {
          errors.push("End date must be after start date");
        }
      }
    }
    
    setFormErrors(errors);
    return errors.length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('module', 'ctwa');

    try {
      const authHeader = await tokenService.getAuthHeader();
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': authHeader.Authorization || ''
        },
        body: uploadData
      });

      const data = await response.json();
      if (response.ok) {
        setFormData(prev => ({ ...prev, imageUrl: data.url }));
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err: any) {
      setUploadError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep !== totalSteps) {
      if (validateStep(currentStep)) nextStep();
      return;
    }

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccessData(null);

    try {
      const authHeader = await tokenService.getAuthHeader();
      
      const response = await fetch('/api/click-to-whatsapp/launch', {
        method: 'POST',
        headers: {
          ...authHeader
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
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </div>
            <div className="ctwa-header-text">
              <h2>Launch WhatsApp Ad</h2>
              <p>Drive conversations directly from Facebook & Instagram.</p>
            </div>
          </div>

          {formErrors.length > 0 && (
            <div className="ctwa-error" style={{ marginBottom: '1.5rem', marginTop: '0' }}>
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {formErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

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
                      maxLength={40}
                      required 
                    />
                    <p className="text-xs text-gray-500 mt-1" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Max 40 characters.</p>
                  </div>
                </div>

                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Primary Text</label>
                    <input 
                      type="text"
                      name="primaryText" 
                      placeholder="e.g. Get 20% off your first order when you chat with us!" 
                      value={formData.primaryText}
                      onChange={handleChange}
                      maxLength={500}
                      required 
                    />
                    <p className="text-xs text-gray-500 mt-1" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Best practice: 125 chars. Max 500 chars.</p>
                  </div>

                  <div className="ctwa-form-group">
                    <label>Ad Media (Image/Video)</label>
                    <div className="flex gap-2 items-center w-full">
                      <input 
                        type="url" 
                        name="imageUrl" 
                        placeholder="Image URL..." 
                        value={formData.imageUrl}
                        onChange={handleChange}
                        required 
                        className="flex-1"
                        style={{ margin: 0 }}
                      />
                      <label className="cursor-pointer bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-semibold py-2.5 px-4 rounded-xl flex-shrink-0 transition-colors whitespace-nowrap shadow-sm">
                        Upload
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      Recommended: 1:1 aspect ratio (Square), at least 1080 x 1080 pixels.
                    </p>
                    {uploading && <p className="text-xs text-[#25D366] animate-pulse mt-1">Uploading...</p>}
                    {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
                  </div>
                  <div className="ctwa-form-group">
                    <label>Ad Description (Optional)</label>
                    <input 
                      type="text" 
                      name="description" 
                      value={formData.description}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Ad Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} required className="ctwa-select">
                      <option value="PAUSED">Paused (Draft)</option>
                      <option value="ACTIVE">Active (Publish Immediately)</option>
                    </select>
                  </div>
                  <div className="ctwa-form-group">
                    <label>WhatsApp Welcome Message</label>
                    <input 
                      type="text" 
                      name="welcomeMessageText" 
                      value={formData.welcomeMessageText}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label>Ice Breaker Button Text</label>
                    <input 
                      type="text" 
                      name="iceBreakerText" 
                      value={formData.iceBreakerText}
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
                    <label>Target Countries</label>
                    <Select
                      isMulti
                      options={countryOptions}
                      placeholder="Select countries..."
                      value={countryOptions.filter(c => formData.targetCountries.split(',').includes(c.value))}
                      onChange={(selected: any) => {
                        setFormData({ ...formData, targetCountries: selected ? selected.map((s: any) => s.value).join(',') : '' });
                      }}
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          padding: '4px',
                          borderRadius: '12px',
                          borderWidth: '2px',
                          borderColor: state.isFocused ? '#25D366' : '#e5e7eb',
                          boxShadow: state.isFocused ? '0 0 0 4px rgba(37, 211, 102, 0.15), 0 2px 4px rgba(0,0,0,0.02) inset' : '0 2px 4px rgba(0,0,0,0.02) inset',
                          '&:hover': {
                            borderColor: state.isFocused ? '#25D366' : '#d1d5db'
                          }
                        })
                      }}
                    />
                  </div>
                </div>

                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Age Range</label>
                    <div className="ctwa-age-range">
                      <input 
                        type="number" 
                        name="minAge" 
                        min="18" 
                        max="65"
                        value={formData.minAge}
                        onChange={handleChange}
                        required 
                        className="age-input"
                      />
                      <span className="age-separator">to</span>
                      <input 
                        type="number" 
                        name="maxAge" 
                        min="18" 
                        max="65"
                        value={formData.maxAge}
                        onChange={handleChange}
                        required 
                        className="age-input"
                      />
                    </div>
                  </div>
                  <div className="ctwa-form-group">
                    <label>Gender</label>
                    <div className="ctwa-pill-group">
                      <button 
                        type="button" 
                        className={`ctwa-pill ${formData.gender === 'all' ? 'active' : ''}`}
                        onClick={() => setFormData({...formData, gender: 'all'})}
                      >All</button>
                      <button 
                        type="button" 
                        className={`ctwa-pill ${formData.gender === '1' ? 'active' : ''}`}
                        onClick={() => setFormData({...formData, gender: '1'})}
                      >Men</button>
                      <button 
                        type="button" 
                        className={`ctwa-pill ${formData.gender === '2' ? 'active' : ''}`}
                        onClick={() => setFormData({...formData, gender: '2'})}
                      >Women</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="ctwa-step-content">
                <div className="ctwa-form-group">
                  <label>Daily Budget</label>
                  <div className="ctwa-budget-wrapper">
                    <span className="budget-currency">{currencySymbol}</span>
                    <input 
                      type="number" 
                      name="dailyBudget" 
                      min="1"
                      step="0.01"
                      value={formData.dailyBudget}
                      onChange={handleChange}
                      required 
                      className="budget-input"
                    />
                  </div>
                  <div className="ctwa-budget-presets">
                    {[10, 20, 50, 100].map(amount => (
                      <button
                        key={amount}
                        type="button"
                        className={`budget-preset ${formData.dailyBudget == amount ? 'active' : ''}`}
                        onClick={() => setFormData({...formData, dailyBudget: amount})}
                      >
                        {currencySymbol}{amount}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Start Date (Optional)</label>
                    <input 
                      type="datetime-local" 
                      name="startDate" 
                      value={formData.startDate}
                      onChange={handleChange}
                      className="ctwa-date-input"
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label>End Date (Optional)</label>
                    <input 
                      type="datetime-local" 
                      name="endDate" 
                      value={formData.endDate}
                      onChange={handleChange}
                      className="ctwa-date-input"
                    />
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
                      <span className="summary-value">{currencySymbol}{formData.dailyBudget}</span>
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
                <div className="premium-whatsapp-badge" style={{ padding: '6px' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </div>
              </div>
              
              <div className="premium-preview-body">
                <p className="premium-caption">
                  {formData.primaryText 
                    ? (formData.primaryText.length > 125 ? (
                        <>
                          {formData.primaryText.substring(0, 125)}...
                          <span style={{ color: '#65676b', cursor: 'pointer', fontWeight: 600 }}> See more</span>
                        </>
                      ) : formData.primaryText)
                    : 'Your compelling ad copy will appear here. Write something that drives action!'}
                </p>
                
                <div className="premium-media-container">
                  {formData.imageUrl && formData.imageUrl.startsWith('http') ? (
                    <div className="premium-image-wrapper">
                      {formData.imageUrl.match(/\.(mp4|webm|ogg|mov)(?:[\?#].*)?$/i) ? (
                        <video 
                          src={formData.imageUrl} 
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img 
                          src={formData.imageUrl} 
                          alt="Ad Creative Preview" 
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="%23f1f5f9"/><text x="200" y="100" font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="middle" fill="%2394a3b8">Invalid Image URL</text></svg>';
                          }}
                        />
                      )}
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
