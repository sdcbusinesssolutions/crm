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
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  const renderCaptionWithNewlines = (text: string) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i !== text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

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
    const stepLabels = ['DETAILS', 'AUDIENCE', 'INVESTMENT', 'OVERVIEW'];
    return (
      <div className="ctwa-stepper">
        {stepLabels.map((label, index) => {
          const stepNum = index + 1;
          const isActive = currentStep === stepNum;
          const isCompleted = currentStep > stepNum;
          return (
            <React.Fragment key={index}>
              <div className={`stepper-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                <div className="stepper-circle">
                  {isCompleted ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" style={{width:'16px',height:'16px'}}><polyline points="20 6 9 17 4 12"></polyline></svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <div className="stepper-label">{label}</div>
              </div>
              {index < stepLabels.length - 1 && (
                <div className={`stepper-line ${currentStep > stepNum ? 'completed' : ''}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="ctwa-container">
      <div className="ctwa-bg-element-1"></div>
      <div className="ctwa-bg-element-2"></div>
      
      <div className="ctwa-main-header">
        <div className="whatsapp-logo-wrapper">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </div>
        <div className="header-text-container">
          <h1>LAUNCH <span>WHATSAPP AD</span></h1>
          <p>Drive conversations directly from <strong>Facebook & Instagram</strong></p>
        </div>
        <div className="paper-plane-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </div>
      </div>

      <div className="ctwa-layout-wrapper">
        <div className="ctwa-card ctwa-form-card">
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
                {/* Row 1: Ad Account + Facebook Page */}
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label><span className="icon">🔴</span> Ad Account</label>
                    {accountsLoading ? (
                       <div style={{height: '40px', background: '#f3f4f6', borderRadius: '10px'}}></div>
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
                        placeholder="No accounts found. Enter ID manually" 
                        value={formData.adAccountId}
                        onChange={handleChange}
                        required 
                      />
                    )}
                  </div>
                  <div className="ctwa-form-group">
                    <label><span className="icon">f</span> Facebook Page</label>
                    {accountsLoading ? (
                       <div style={{height: '40px', background: '#f3f4f6', borderRadius: '10px'}}></div>
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
                        placeholder="No pages found. Enter ID manually" 
                        value={formData.pageId}
                        onChange={handleChange}
                        required 
                      />
                    )}
                  </div>
                </div>

                {/* Row 2: Campaign Name + Headline */}
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label><span className="icon">📢</span> Campaign Name</label>
                    <input 
                      type="text" 
                      name="campaignName" 
                      placeholder="Enter campaign name"
                      value={formData.campaignName}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label><span className="icon">T</span> Headline</label>
                    <input 
                      type="text" 
                      name="headline" 
                      value={formData.headline}
                      onChange={handleChange}
                      maxLength={40}
                      required 
                    />
                    <p className="field-hint">Max 40 characters.</p>
                  </div>
                </div>

                {/* Row 3: Primary Text (left) + Ad Media & Description (right) */}
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>
                      <span className="icon">📄</span> Primary Text
                      <span className={`char-count ${formData.primaryText.length > 125 ? 'warning' : 'safe'}`}>
                        {formData.primaryText.length} / 500 {formData.primaryText.length > 125 ? '(See More added)' : '(Safe Zone)'}
                      </span>
                    </label>
                    <textarea 
                      name="primaryText" 
                      placeholder="Get instant support and exclusive offers right in your WhatsApp inbox." 
                      value={formData.primaryText}
                      onChange={handleChange}
                      maxLength={500}
                      rows={4}
                      required 
                    />
                    {/(http|www\.)/i.test(formData.primaryText) && (
                      <p style={{color: '#dc2626', fontSize: '0.72rem', marginTop: '4px'}}>
                        ⚠️ Avoid URLs here! The WhatsApp CTA button is your only link.
                      </p>
                    )}
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    <div className="ctwa-form-group">
                      <label><span className="icon">🖼️</span> Ad Media (Image/Video)</label>
                      <div className="media-upload-area" onClick={() => document.getElementById('ad-media-upload')?.click()}>
                        <div className="upload-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-icon">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                          <span>Upload Image</span>
                        </div>
                        <input
                          id="ad-media-upload"
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleFileUpload}
                          className="file-input"
                        />
                      </div>
                      <p className="field-hint">Recommended: 1:1 aspect ratio<br/>at least 1080 × 1080 pixels.</p>
                      {uploading && <p style={{color: '#25D366', fontSize: '0.72rem'}}>Uploading...</p>}
                      {uploadError && <p style={{color: '#dc2626', fontSize: '0.72rem'}}>{uploadError}</p>}
                    </div>
                    <div className="ctwa-form-group">
                      <label><span className="icon">📝</span> Ad Description (Optional)</label>
                      <input 
                        type="text" 
                        name="description" 
                        placeholder="Write ad description..."
                        value={formData.description}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Winning Formula */}
                <div className="winning-formula-box">
                  <div className="formula-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="6"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                      <line x1="22" y1="2" x2="14" y2="10"></line>
                    </svg>
                  </div>
                  <div className="formula-text">
                    <strong>💡 Winning Formula:</strong>
                    <p>Hook (First 3 lines) + Pain Point + Solution + CTA</p>
                  </div>
                </div>

                {/* Row 4: Ad Status + Welcome Message + Ice Breaker (3 cols) */}
                <div className="ctwa-form-row" style={{gridTemplateColumns: '1fr 1fr 1fr'}}>
                  <div className="ctwa-form-group">
                    <label><span className="icon">🕒</span> Ad Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} required className="ctwa-select">
                      <option value="PAUSED">Paused (Draft)</option>
                      <option value="ACTIVE">Active (Publish Immediately)</option>
                    </select>
                  </div>
                  <div className="ctwa-form-group">
                    <label><span className="icon">💬</span> WhatsApp Welcome Message</label>
                    <input 
                      type="text" 
                      name="welcomeMessageText" 
                      value={formData.welcomeMessageText}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label><span className="icon">✨</span> Ice Breaker Button Text</label>
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
                          borderRadius: '8px',
                          borderWidth: '1px',
                          borderColor: state.isFocused ? '#25D366' : '#e5e7eb',
                          boxShadow: state.isFocused ? '0 0 0 3px rgba(37, 211, 102, 0.1)' : 'none',
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
                        className={`budget-preset ${Number(formData.dailyBudget) === amount ? 'active' : ''}`}
                        onClick={() => setFormData({...formData, dailyBudget: amount.toString()})}
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
                  <h3 style={{marginTop: 0}}>Campaign Overview</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label" style={{fontSize: '0.75rem', color: '#6b7280'}}>Campaign Name:</span>
                      <span className="summary-value" style={{fontWeight: 600}}>{formData.campaignName}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label" style={{fontSize: '0.75rem', color: '#6b7280'}}>Ad Account:</span>
                      <span className="summary-value" style={{fontWeight: 600}}>{formData.adAccountId}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label" style={{fontSize: '0.75rem', color: '#6b7280'}}>Page ID:</span>
                      <span className="summary-value" style={{fontWeight: 600}}>{formData.pageId}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label" style={{fontSize: '0.75rem', color: '#6b7280'}}>Daily Budget:</span>
                      <span className="summary-value" style={{fontWeight: 600}}>{currencySymbol}{formData.dailyBudget}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label" style={{fontSize: '0.75rem', color: '#6b7280'}}>Locations:</span>
                      <span className="summary-value" style={{fontWeight: 600}}>{formData.targetCountries || 'Global'}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label" style={{fontSize: '0.75rem', color: '#6b7280'}}>Demographics:</span>
                      <span className="summary-value" style={{fontWeight: 600}}>{formData.minAge}-{formData.maxAge} yrs, {formData.gender === 'all' ? 'All Genders' : formData.gender === '1' ? 'Men' : 'Women'}</span>
                    </div>
                  </div>
                </div>

                {error && <div className="ctwa-error" style={{color: 'red', marginTop: '1rem'}}>{error}</div>}
                
                {successData && (
                  <div className="ctwa-success" style={{background: '#dcfce7', padding: '1rem', borderRadius: '8px', marginTop: '1rem'}}>
                    <h4 style={{color: '#166534', margin: '0 0 0.5rem 0'}}>Ad Launched Successfully!</h4>
                    <ul style={{color: '#15803d', margin: 0, paddingLeft: '1.5rem'}}>
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
                <button type="submit" disabled={loading} className="ctwa-submit-btn" style={{marginLeft: 'auto'}}>
                  {currentStep === totalSteps ? (loading ? 'Launching Ad...' : 'Launch WhatsApp Ad') : 'Next →'}
                </button>
              )}

              {successData && (
                <button type="button" onClick={() => {
                  setSuccessData(null);
                  setCurrentStep(1);
                  setFormData({...formData, campaignName: 'New Campaign ' + Date.now()});
                }} className="ctwa-submit-btn" style={{marginLeft: 'auto'}}>
                  Create Another Ad
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Live Preview Panel */}
        <div className="ctwa-right-panel">
          <div className="ctwa-preview-card">
            <div className="preview-header">
              <div className="preview-avatar">
                {formData.pageId && pages.length > 0 
                  ? pages.find(p => p.id === formData.pageId)?.name?.charAt(0).toUpperCase() || 'W' 
                  : (formData.pageId ? formData.pageId.charAt(0).toUpperCase() : 'W')}
              </div>
              <div className="preview-header-text">
                <strong>
                  {formData.pageId && pages.length > 0 
                    ? pages.find(p => p.id === formData.pageId)?.name || 'YOUR BRAND' 
                    : (formData.pageId || 'YOUR BRAND')}
                </strong>
                <span>Sponsored Ad</span>
              </div>
              <div className="preview-wa-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
            </div>
            
            <div className="preview-caption">
              {formData.primaryText || 'Get instant support and exclusive offers right in your WhatsApp inbox.'}
            </div>
            
            <div className="preview-media">
              {formData.imageUrl ? (
                formData.imageUrl.match(/\.(mp4|webm|ogg|mov)(?:[\?#].*)?$/i) ? (
                  <video src={formData.imageUrl} autoPlay muted loop playsInline />
                ) : (
                  <img src={formData.imageUrl} alt="Ad Creative" />
                )
              ) : (
                <div className="mock-ad-creative">
                  <h2>Chat<br/>with us on<br/><span>WhatsApp!</span></h2>
                  <div className="mock-features">
                    <div className="mock-feature">
                      <span className="icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></span> Instant Support
                    </div>
                    <div className="mock-feature">
                      <span className="icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg></span> Exclusive Offers
                    </div>
                    <div className="mock-feature">
                      <span className="icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span> 100% Secure
                    </div>
                  </div>
                  <div className="mock-phone">
                    <div className="mock-phone-screen">
                      <div className="mock-msg bubble">Chat with us!</div>
                      <div className="mock-msg bubble-green">Hi there!</div>
                    </div>
                    <div className="mock-phone-wa-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="preview-footer">
              <div className="preview-footer-left">
                <span className="whatsapp-label">WHATSAPP</span>
                <strong className="headline-text">{formData.headline || 'Chat with us on WhatsApp!'}</strong>
              </div>
              <button className="preview-cta">Send WhatsApp Message</button>
            </div>
          </div>
          
          <div className="feature-icons-row">
            <div className="feature-icon-item">
              <div className="f-icon" style={{color: '#059669'}}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <span>More Leads</span>
            </div>
            <div className="feature-icon-item">
              <div className="f-icon" style={{color: '#059669'}}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
              </div>
              <span>Better<br/>Engagement</span>
            </div>
            <div className="feature-icon-item">
              <div className="f-icon" style={{color: '#059669'}}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.37-.71.55-1.02.16-.31 3.51-6.02 3.51-6.02C11.36 6.09 11.66 6 12 6h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>
              </div>
              <span>Instant<br/>Responses</span>
            </div>
            <div className="feature-icon-item">
              <div className="f-icon" style={{color: '#059669'}}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
              </div>
              <span>Higher<br/>Conversions</span>
            </div>
            <div className="feature-icon-item">
              <div className="f-icon" style={{color: '#059669'}}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M13.13 2.13l3.18 3.18c2.14-1.28 4.67-1.12 6.57.77-1.6 4.79-5.11 7.23-9.52 7.74l-3.32-3.32c.51-4.41 2.95-7.92 7.74-9.52.4.4.76.85 1.08 1.34L15.68.87a9.92 9.92 0 0 0-2.55 1.26zm-7.9 7.9l3.32 3.32c-2.3 3.57-5.55 6.04-9.55 7.65.34-.14.67-.3 1-.48l3.18-3.18c-1.39-1.92-1.57-4.46-.35-6.61a9.92 9.92 0 0 0 2.4-1z"/></svg>
              </div>
              <span>Grow Your<br/>Business</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClickToWhatsAppLauncher;
