import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { tokenService } from '../services/tokenService';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import './ClickToWhatsAppLauncher.css';

const countryOptions = [
  { value: 'US', label: 'United States', lat: 37.0902, lng: -95.7129 },
  { value: 'GB', label: 'United Kingdom', lat: 55.3781, lng: -3.4360 },
  { value: 'IN', label: 'India', lat: 20.5937, lng: 78.9629 },
  { value: 'CA', label: 'Canada', lat: 56.1304, lng: -106.3468 },
  { value: 'AU', label: 'Australia', lat: -25.2744, lng: 133.7751 },
  { value: 'BR', label: 'Brazil', lat: -14.2350, lng: -51.9253 },
  { value: 'MX', label: 'Mexico', lat: 23.6345, lng: -102.5528 },
  { value: 'ID', label: 'Indonesia', lat: -0.7893, lng: 113.9213 },
  { value: 'PH', label: 'Philippines', lat: 12.8797, lng: 121.7740 },
  { value: 'ZA', label: 'South Africa', lat: -30.5595, lng: 22.9375 },
  { value: 'NG', label: 'Nigeria', lat: 9.0820, lng: 8.6753 },
  { value: 'AE', label: 'United Arab Emirates', lat: 23.4241, lng: 53.8478 },
  { value: 'SA', label: 'Saudi Arabia', lat: 23.8859, lng: 45.0792 },
  { value: 'DE', label: 'Germany', lat: 51.1657, lng: 10.4515 },
  { value: 'FR', label: 'France', lat: 46.2276, lng: 2.2137 },
  { value: 'IT', label: 'Italy', lat: 41.8719, lng: 12.5674 },
  { value: 'ES', label: 'Spain', lat: 40.4637, lng: -3.7492 }
];

const customMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapClickHandler({ onLocationClick }: { onLocationClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onLocationClick(e.latlng);
    }
  });
  return null;
}

function MapResizer() {
  const map = useMapEvents({});
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  return null;
}

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
  const [droppedPins, setDroppedPins] = useState<{lat: number, lng: number, name?: string}[]>([]);

  // Geocode custom locations that are added to formData but not yet in droppedPins
  useEffect(() => {
    const currentLocations = formData.targetCountries ? formData.targetCountries.split(',').filter(Boolean) : [];
    
    currentLocations.forEach(locName => {
      const isPredefined = countryOptions.some(c => c.value === locName || c.label === locName);
      if (isPredefined) return;
      
      setDroppedPins(prev => {
        if (prev.some(p => p.name === locName)) return prev;
        
        // Fetch if not present
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locName)}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.length > 0) {
              const lat = parseFloat(data[0].lat);
              const lon = parseFloat(data[0].lon);
              setDroppedPins(currentPins => {
                if (currentPins.some(p => p.name === locName)) return currentPins;
                return [...currentPins, { lat, lng: lon, name: locName }];
              });
            }
          })
          .catch(e => console.error("Geocoding failed", e));
          
        return prev;
      });
    });
  }, [formData.targetCountries]);

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
      <div className="ctwa-layout-wrapper">
        <div className="ctwa-form-column">
          <div className="ctwa-main-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 20px' }}>
            <div className="header-text-container">
              <h1>Launch <span>WhatsApp Ad</span></h1>
              <p>Drive real conversations from <strong style={{color: '#1877F2'}}>Facebook</strong> & <strong style={{color: '#E4405F'}}>Instagram</strong></p>
            </div>
          </div>

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
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span> Ad Account</label>
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
                    <label><span className="icon" style={{color: '#1877F2'}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></span> Facebook Page</label>
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
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></span> Campaign Name</label>
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
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg></span> Headline</label>
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
                      <span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></span> Primary Text
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
                      <label><span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></span> Ad Media (Image/Video)</label>
                      <div className={`media-upload-area ${formData.imageUrl && formData.imageUrl !== '/header-banner.png' ? 'has-image' : ''}`} onClick={() => document.getElementById('ad-media-upload')?.click()}>
                        {formData.imageUrl && formData.imageUrl !== '/header-banner.png' ? (
                          <div className="upload-preview-container" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '10px 0'}}>
                            <img src={formData.imageUrl} alt="Ad Media" style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e5e7eb'}} />
                            <span style={{fontSize: '0.8rem', fontWeight: 500, color: '#068E3E'}}>Image Selected (Click to change)</span>
                          </div>
                        ) : (
                          <div className="upload-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-icon">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="17 8 12 3 7 8"></polyline>
                              <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <span>Upload Image</span>
                          </div>
                        )}
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
                  </div>
                </div>

                {/* Ad Description + Winning Formula */}
                <div className="ctwa-form-row">
                  <div className="winning-formula-box" style={{ marginBottom: 0, marginTop: 'auto' }}>
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

                  <div className="ctwa-form-group">
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></span> Ad Description (Optional)</label>
                    <textarea 
                      name="description" 
                      placeholder="Write ad description..."
                      value={formData.description}
                      onChange={handleChange}
                      rows={2}
                    />
                  </div>
                </div>

                {/* Row 4: Ad Status + Welcome Message + Ice Breaker (3 cols) */}
                <div className="ctwa-form-row" style={{gridTemplateColumns: '1fr 1fr 1fr'}}>
                  <div className="ctwa-form-group">
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span> Ad Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} required className="ctwa-select">
                      <option value="PAUSED">Paused (Draft)</option>
                      <option value="ACTIVE">Active (Publish Immediately)</option>
                    </select>
                  </div>
                  <div className="ctwa-form-group">
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></span> WhatsApp Welcome Message</label>
                    <input 
                      type="text" 
                      name="welcomeMessageText" 
                      value={formData.welcomeMessageText}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span> Ice Breaker Button Text</label>
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
                <div className="ctwa-form-row" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="ctwa-form-group">
                    <label>Target Locations (City, State, Country)</label>
                    <CreatableSelect
                      isMulti
                      options={countryOptions}
                      placeholder="Type a location or select a country..."
                      value={formData.targetCountries.split(',').filter(Boolean).map(val => {
                        const existingOption = countryOptions.find(c => c.value === val);
                        return existingOption ? existingOption : { label: val, value: val };
                      })}
                      onChange={(selected: any) => {
                        const newLocations = selected ? selected.map((s: any) => s.value) : [];
                        setFormData({ ...formData, targetCountries: newLocations.join(',') });
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
                    
                    {/* Interactive Meta-style Map */}
                    <div style={{ height: '350px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb', marginTop: '1rem', position: 'relative', zIndex: 1 }}>
                      <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />
                        <MapResizer />
                        <MapClickHandler onLocationClick={async (latlng) => {
                          try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=10&addressdetails=1`);
                            const data = await res.json();
                            const locationName = data.address?.city || data.address?.state || data.address?.country || 'Custom Target Region';
                            
                            setDroppedPins([...droppedPins, { lat: latlng.lat, lng: latlng.lng, name: locationName }]);
                            
                            // Add to form data target locations as well
                            const currentLocations = formData.targetCountries ? formData.targetCountries.split(',') : [];
                            if (!currentLocations.includes(locationName)) {
                              setFormData({ ...formData, targetCountries: [...currentLocations, locationName].join(',') });
                            }
                          } catch (err) {
                            console.error('Failed to geocode location', err);
                            setDroppedPins([...droppedPins, { lat: latlng.lat, lng: latlng.lng, name: 'Custom Target Region' }]);
                          }
                        }} />
                        
                        {/* Selected Country Markers */}
                        {formData.targetCountries.split(',').filter(Boolean).map((locName, idx) => {
                          const country = countryOptions.find(c => c.value === locName || c.label === locName);
                          if (country) {
                            return (
                              <Marker key={`preset-${idx}`} position={[country.lat, country.lng]} icon={customMarkerIcon} title={country.label}>
                                <Tooltip direction="top" offset={[0, -30]} opacity={1}>{country.label}</Tooltip>
                                <Popup>{country.label}</Popup>
                              </Marker>
                            );
                          }
                          return null;
                        })}

                        {/* Custom Dropped Pins */}
                        {droppedPins.map((pin: any, i) => (
                          <Marker key={`pin-${i}`} position={[pin.lat, pin.lng]} icon={customMarkerIcon} title={pin.name}>
                            <Tooltip direction="top" offset={[0, -30]} opacity={1}>{pin.name}</Tooltip>
                            <Popup>{pin.name}</Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                      <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000, fontWeight: 600 }}>
                        Click anywhere to drop a target pin
                      </div>
                    </div>
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
                        {amount}
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
                      <span className="summary-value" style={{fontWeight: 600}}>{formData.dailyBudget}</span>
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
                <img src="/mock-ad.png" alt="Ad Creative" />
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
              <div className="f-icon" style={{color: '#068E3E'}}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              </div>
              <span>More<br/>Leads</span>
            </div>
            <div className="feature-icon-item">
              <div className="f-icon" style={{color: '#068E3E'}}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 9h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z"/></svg>
              </div>
              <span>Better<br/>Engagement</span>
            </div>
            <div className="feature-icon-item">
              <div className="f-icon" style={{color: '#068E3E'}}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 3L4 14h7v8l9-11h-7z"/></svg>
              </div>
              <span>Instant<br/>Responses</span>
            </div>
            <div className="feature-icon-item">
              <div className="f-icon" style={{color: '#068E3E'}}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
              </div>
              <span>Higher<br/>Conversions</span>
            </div>
            <div className="feature-icon-item">
              <div className="f-icon">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <g transform="rotate(45 12 12)">
                    <polygon points="9,19 15,19 12,24" fill="#eab308" />
                    <path d="M12 2 C17 5 16 14 16 14 L19 20 L5 20 L8 14 C8 14 7 5 12 2 Z" fill="#034B33" />
                    <circle cx="12" cy="11" r="2.5" fill="#f0fdf4" />
                  </g>
                </svg>
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
