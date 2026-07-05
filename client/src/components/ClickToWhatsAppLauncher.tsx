import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { tokenService } from '../services/tokenService';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import AsyncCreatableSelect from 'react-select/async-creatable';
import debounce from 'lodash/debounce';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMapEvents, Circle } from 'react-leaflet';
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

function MapZoomToPins({ droppedPins, presetCountries }: { droppedPins: any[], presetCountries: any[] }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (droppedPins.length === 0 && presetCountries.length === 0) return;
    
    const bounds = L.latLngBounds([]);
    presetCountries.forEach(c => { if(c) bounds.extend([c.lat, c.lng]); });
    droppedPins.forEach(p => { if(p) bounds.extend([p.lat, p.lng]); });
    
    if (bounds.isValid()) {
      // Zoom map to fit the bounds to perfectly frame the 25-mile radius circles
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [map, droppedPins, presetCountries]);
  return null;
}

const MemoizedMap = React.memo(({ formData, setFormData, droppedPins, setDroppedPins }: any) => {
  return (
    <div style={{ height: '350px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb', marginTop: '1rem', position: 'relative', zIndex: 1 }}>
      <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapResizer />
        <MapZoomToPins 
          droppedPins={droppedPins} 
          presetCountries={formData.targetCountries.split('|').filter(Boolean).map((locName: string) => countryOptions.find(c => c.value === locName || c.label === locName)).filter(Boolean)} 
        />
        <MapClickHandler onLocationClick={async (latlng) => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=10&addressdetails=1`);
            const data = await res.json();
            const locationName = data.address?.city || data.address?.state || data.address?.country || 'Custom Target Region';
            
            setDroppedPins((prev: any) => [...prev, { lat: latlng.lat, lng: latlng.lng, name: locationName }]);
            
            setFormData((prev: any) => {
              const currentLocations = prev.targetCountries ? prev.targetCountries.split('|') : [];
              if (!currentLocations.includes(locationName)) {
                return { ...prev, targetCountries: [...currentLocations, locationName].join('|') };
              }
              return prev;
            });
          } catch (err) {
            console.error('Failed to geocode location', err);
            setDroppedPins((prev: any) => [...prev, { lat: latlng.lat, lng: latlng.lng, name: 'Custom Target Region' }]);
          }
        }} />
        
        {/* Selected Country Markers */}
        {formData.targetCountries.split('|').filter(Boolean).map((locName: string, idx: number) => {
          const country = countryOptions.find((c: any) => c.value === locName || c.label === locName);
          if (country) {
            return (
              <React.Fragment key={`preset-${idx}`}>
                <Circle center={[country.lat, country.lng]} radius={40233} pathOptions={{ color: '#25D366', fillColor: '#25D366', fillOpacity: 0.2, weight: 2 }} />
                <Marker position={[country.lat, country.lng]} icon={customMarkerIcon} title={country.label}>
                  <Popup>{country.label} (+25mi radius)</Popup>
                </Marker>
              </React.Fragment>
            );
          }
          return null;
        })}
        {/* Dropped Pins */}
        {droppedPins.map((pin: any, idx: number) => {
          const radiusMi = formData.locationRadiuses?.[pin.name] !== undefined ? formData.locationRadiuses[pin.name] : 25;
          return (
          <React.Fragment key={`dropped-${idx}`}>
            {radiusMi > 0 && <Circle center={[pin.lat, pin.lng]} radius={radiusMi * 1609.34} pathOptions={{ color: '#25D366', fillColor: '#25D366', fillOpacity: 0.2, weight: 2 }} />}
            <Marker position={[pin.lat, pin.lng]} icon={customMarkerIcon}>
              <Popup>{pin.name || 'Custom Pin'} {radiusMi > 0 ? `(+${radiusMi}mi radius)` : '(Current city only)'}</Popup>
            </Marker>
          </React.Fragment>
        )})}
      </MapContainer>
      <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000, fontWeight: 600 }}>
        Click anywhere to drop a target pin
      </div>
    </div>
  );
}, (prev, next) => 
  prev.formData.targetCountries === next.formData.targetCountries && 
  prev.formData.locationRadiuses === next.formData.locationRadiuses &&
  prev.droppedPins === next.droppedPins
);


function RadiusConfigurator({ locationName, radius, onChange }: { locationName: string, radius: number, onChange: (r: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          background: isOpen ? '#e5e7eb' : '#f3f4f6', 
          border: 'none', padding: '6px 12px', borderRadius: '6px', 
          fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          color: '#374151', fontWeight: 600, transition: 'all 0.2s ease',
          boxShadow: isOpen ? 'inset 0 2px 4px rgba(0,0,0,0.05)' : '0 1px 2px rgba(0,0,0,0.05)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
        onMouseLeave={(e) => e.currentTarget.style.background = isOpen ? '#e5e7eb' : '#f3f4f6'}
      >
        {radius === 0 ? 'Current city only' : `+ ${radius} mi`}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={isOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}/></svg>
      </button>
      
      {isOpen && (
        <div style={{ 
          position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '260px', 
          background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', 
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', 
          zIndex: 9999, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', cursor: 'pointer', color: '#111827', fontWeight: radius === 0 ? 600 : 400 }}>
            <div style={{ 
              width: '18px', height: '18px', borderRadius: '50%', border: radius === 0 ? '5px solid #25D366' : '1px solid #d1d5db',
              background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s ease', boxSizing: 'border-box'
            }} />
            <input type="radio" checked={radius === 0} onChange={() => { onChange(0); setIsOpen(false); }} style={{ display: 'none' }} />
            Current city only
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', cursor: 'pointer', color: '#111827', fontWeight: radius > 0 ? 600 : 400 }}>
            <div style={{ 
              width: '18px', height: '18px', borderRadius: '50%', border: radius > 0 ? '5px solid #25D366' : '1px solid #d1d5db',
              background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s ease', boxSizing: 'border-box'
            }} />
            <input type="radio" checked={radius > 0} onChange={() => { if(radius === 0) onChange(25); }} style={{ display: 'none' }} />
            Cities within radius
          </label>
          
          <div style={{ paddingLeft: '30px', display: 'flex', alignItems: 'center', gap: '12px', opacity: radius > 0 ? 1 : 0.4, pointerEvents: radius > 0 ? 'auto' : 'none', transition: 'opacity 0.2s ease' }}>
            <input 
              type="range" min="10" max="50" step="1" 
              value={radius > 0 ? radius : 25} 
              onChange={(e) => onChange(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: '#25D366', height: '4px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.85rem', background: '#f3f4f6', padding: '4px 8px', borderRadius: '6px', fontWeight: 600, color: '#374151', minWidth: '45px', textAlign: 'center' }}>
              {radius > 0 ? radius : 25} mi
            </span>
          </div>
        </div>
      )}
    </div>
  );
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
    locationRadiuses: {},
    baseCountryCode: '',
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

  // Synchronize droppedPins with formData.targetCountries (add missing, remove deleted)
  useEffect(() => {
    const currentLocations = formData.targetCountries ? formData.targetCountries.split('|').filter(Boolean) : [];
    
    setDroppedPins(prevPins => {
      // 1. Remove pins that are no longer in targetCountries
      const nextPins = prevPins.filter(pin => {
        // If pin has no name, we can't sync it easily, keep it as custom pin.
        // Otherwise, keep it only if it's still in currentLocations
        if (!pin.name) return true;
        return currentLocations.includes(pin.name);
      });
      return nextPins;
    });
    
    // 2. Geocode and add new pins that are in targetCountries but not in droppedPins
    currentLocations.forEach(locName => {
      const isPredefined = countryOptions.some(c => c.value === locName || c.label === locName);
      if (isPredefined) return; // Predefined countries have their own markers
      
      setDroppedPins(prev => {
        if (prev.some(p => p.name === locName)) return prev;
        
        // Fetch if not present
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(locName)}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.length > 0) {
              const lat = parseFloat(data[0].lat);
              const lon = parseFloat(data[0].lon);
              setDroppedPins(currentPins => {
                // Double check it wasn't removed while we were fetching
                if (currentPins.some(p => p.name === locName)) return currentPins;
                const stillExists = (formData.targetCountries || '').includes(locName);
                if (!stillExists) return currentPins;
                
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

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

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


  const targetCountriesOptions = useMemo(() => {
    return formData.targetCountries.split('|').filter(Boolean).map(val => {
      const existingOption = countryOptions.find(c => c.value === val);
      return existingOption ? existingOption : { label: val, value: val };
    });
  }, [formData.targetCountries]);

  const baseCountryCodeRef = useRef(formData.baseCountryCode);
  useEffect(() => {
    baseCountryCodeRef.current = formData.baseCountryCode;
  }, [formData.baseCountryCode]);

  const fetchLocations = useMemo(
    () =>
      debounce((inputValue: string, resolve: (options: any[]) => void) => {
        // Append countrycode if baseCountryCode is set
        const currentCountryCode = baseCountryCodeRef.current;
        const countryParam = currentCountryCode ? `&countrycodes=${currentCountryCode.toLowerCase()}` : '';
        fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=15&email=hello@clicktowp.com&accept-language=en${countryParam}&q=${encodeURIComponent(inputValue)}`)
          .then(res => res.json())
          .then(data => {
            if (!Array.isArray(data)) {
              resolve([]);
              return;
            }
            
            const options = data.map((item: any) => {
              const addr = item.address || {};
              const nameParts = [];
              
              // 1. Specific local area
              const localName = addr.neighbourhood || addr.suburb || addr.village || addr.town || addr.city || item.name;
              if (localName) nameParts.push(localName);
              
              // 2. State
              if (addr.state && addr.state !== localName) nameParts.push(addr.state);
              
              // 3. Country
              if (addr.country && addr.country !== localName && addr.country !== addr.state) nameParts.push(addr.country);
              
              const cleanLabel = nameParts.join(', ');
              
              // Format type for display
              let type = item.addresstype || item.type || 'Location';
              if (type === 'administrative' || type === 'state_district') type = 'Region';
              else type = type.charAt(0).toUpperCase() + type.slice(1);
              
              return {
                label: cleanLabel,
                value: cleanLabel,
                type: type,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon)
              };
            });
            
            // Filter out exact duplicates that arise from cleaning the names
            const uniqueOptions = options.filter((v, i, a) => a.findIndex(t => (t.label === v.label)) === i).slice(0, 8);
            
            resolve(uniqueOptions);
          })
          .catch(error => {
            console.error("Error fetching locations:", error);
            resolve([]);
          });
      }, 600),
    []
  );

  const loadOptions = useCallback((inputValue: string) => {
    return new Promise<any[]>(resolve => {
      if (!inputValue) {
        resolve([]);
        return;
      }
      fetchLocations(inputValue, resolve);
    });
  }, [fetchLocations]);

  const customFormatOptionLabel = ({ label, type, __isNew__ }: any) => (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0' }}>
      <span style={{ fontWeight: 500, color: '#1c1e21', fontSize: '14px' }}>{label}</span>
      {!__isNew__ && (
        <span style={{ fontSize: '12px', color: '#606770', textTransform: 'capitalize', marginTop: '2px' }}>
          {type || 'Location'}
        </span>
      )}
    </div>
  );

  const renderStepIndicator = useCallback(() => {
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
  }, [currentStep]);

  const adPreview = useMemo(() => (
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
  ), [formData.pageId, pages, formData.primaryText, formData.imageUrl, formData.headline]);

  return (
    <div className="ctwa-container">
      <div className="ctwa-bg-element-1"></div>
      <div className="ctwa-bg-element-2"></div>
      <div className="ctwa-top-header-row" style={{ maxWidth: '1250px', margin: '0 auto 20px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', position: 'relative', zIndex: 10, flexWrap: 'wrap', gap: '10px' }}>
        <div className="ctwa-main-header" style={{ margin: 0, padding: 0 }}>
          <div className="header-text-container">
            <h1>Launch <span>WhatsApp Ad</span></h1>
            <p>Drive real conversations from <strong style={{color: '#1877F2'}}>Facebook</strong> & <strong style={{color: '#E4405F'}}>Instagram</strong></p>
          </div>
        </div>

        <div className="feature-icons-row" style={{ marginTop: 0, maxWidth: '550px', flex: 1, padding: '1rem', marginLeft: '0px' }}>
          <div className="feature-icon-item">
            <div className="f-icon" style={{color: '#FFFFFF', backgroundColor: '#3B82F6', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'}}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </div>
            <span>More<br/>Leads</span>
          </div>
          <div className="feature-icon-item">
            <div className="f-icon" style={{color: '#FFFFFF', backgroundColor: '#A855F7', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)'}}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 9h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z"/></svg>
            </div>
            <span>Better<br/>Engagement</span>
          </div>
          <div className="feature-icon-item">
            <div className="f-icon" style={{color: '#FFFFFF', backgroundColor: '#14B8A6', boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)'}}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 3L4 14h7v8l9-11h-7z"/></svg>
            </div>
            <span>Instant<br/>Responses</span>
          </div>
          <div className="feature-icon-item">
            <div className="f-icon" style={{color: '#FFFFFF', backgroundColor: '#F59E0B', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'}}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
            </div>
            <span>Higher<br/>Conversions</span>
          </div>
          <div className="feature-icon-item">
            <div className="f-icon" style={{color: '#FFFFFF', backgroundColor: '#EC4899', boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)'}}>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <g transform="rotate(45 12 12)">
                  <polygon points="9,19 15,19 12,24" fill="currentColor" opacity="0.8" />
                  <path d="M12 2 C17 5 16 14 16 14 L19 20 L5 20 L8 14 C8 14 7 5 12 2 Z" fill="currentColor" />
                  <circle cx="12" cy="11" r="2.5" fill="#EC4899" />
                </g>
              </svg>
            </div>
            <span>Grow Your<br/>Business</span>
          </div>
        </div>
      </div>

      <div className="ctwa-layout-wrapper">
        <div className="ctwa-form-column">
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
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span> Ad Account</label>
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
                    <label><span className="icon" style={{ background: 'transparent' }}><svg viewBox="0 0 24 24" fill="none" stroke="none" style={{ width: '18px', height: '18px', marginLeft: '2px', marginRight: '2px' }}><circle cx="12" cy="12" r="12" fill="#1877F2" /><path d="M15.36 12l-.54-3.52h-2.99V6.21c0-.97.48-1.91 2-1.91h1.55V1.31s-1.41-.24-2.75-.24c-2.82 0-4.65 1.71-4.65 4.79v2.66H5.43V12h2.55v8.52h3.84V12h3.54z" fill="white" /></svg></span> Facebook Page</label>
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
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg></span> Campaign Name</label>
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
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4v3h5.5v12h3V7H19V4H5z"/></svg></span> Headline</label>
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
                      <span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></span> Primary Text
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
                      <label><span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></span> Ad Media (Image/Video)</label>
                      <div className={`media-upload-area ${formData.imageUrl && formData.imageUrl !== '/header-banner.png' ? 'has-image' : ''}`} onClick={() => document.getElementById('ad-media-upload')?.click()}>
                        {formData.imageUrl && formData.imageUrl !== '/header-banner.png' ? (
                          <div className="upload-preview-container" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '10px 0'}}>
                            <img src={formData.imageUrl} alt="Ad Media" style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e5e7eb'}} />
                            <span style={{fontSize: '0.8rem', fontWeight: 500, color: '#068E3E'}}>Image Selected (Click to change)</span>
                          </div>
                        ) : (
                          <div className="upload-placeholder-new" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div className="upload-icon-box" style={{ background: '#eafff0', padding: '12px', borderRadius: '12px' }}>
                              <svg viewBox="0 0 24 24" fill="#068E3E" style={{ width: '28px', height: '28px' }}><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
                            </div>
                            <div className="upload-text-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111' }}>Upload Image or Video</span>
                              <span style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>Recommended: 1:1 aspect ratio<br/>at least 1080 × 1080 pixels.</span>
                              <button type="button" className="ctwa-upload-btn-mini" style={{ background: '#068E3E', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Upload
                              </button>
                            </div>
                          </div>
                        )}
                        <input
                          id="ad-media-upload"
                          type="file"
                          accept="image/*,video/*"
                          style={{ display: 'none' }}
                          onChange={handleFileUpload}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {uploading && <p style={{color: '#25D366', fontSize: '0.72rem'}}>Uploading...</p>}
                      {uploadError && <p style={{color: '#dc2626', fontSize: '0.72rem'}}>{uploadError}</p>}
                    </div>
                  </div>
                </div>

                {/* Ad Description + Winning Formula */}
                <div className="ctwa-form-row">
                  <div className="winning-formula-box" style={{ marginBottom: 0, marginTop: 'auto', background: '#eafff0', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #c8e6d5' }}>
                    <div className="formula-text">
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2563EB', fontSize: '0.8rem' }}>💡 Winning Formula:</strong>
                      <p style={{ color: '#2563EB', fontSize: '0.75rem', fontWeight: 600, margin: '4px 0 0' }}>Hook (First 3 lines) + Pain Point + Solution + CTA</p>
                    </div>
                    <div className="formula-icon-large">
                      <svg viewBox="0 0 120 120" style={{ width: '56px', height: '56px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>
                        <circle cx="50" cy="70" r="38" fill="#22c55e"></circle>
                        <circle cx="50" cy="70" r="26" fill="#ffffff"></circle>
                        <circle cx="50" cy="70" r="14" fill="#22c55e"></circle>
                        <circle cx="50" cy="70" r="6" fill="#f97316"></circle>
                        <circle cx="50" cy="70" r="2" fill="#ea580c"></circle>
                        <g>
                          <line x1="50" y1="70" x2="88" y2="32" stroke="#4b5563" strokeWidth="2.5" strokeLinecap="round"></line>
                          <polygon points="78,42 98,22 103,27 83,47" fill="#15803d" stroke="#14532d" strokeWidth="1" strokeLinejoin="round"></polygon>
                          <polygon points="78,42 98,22 93,17 73,37" fill="#22c55e" stroke="#14532d" strokeWidth="1" strokeLinejoin="round"></polygon>
                        </g>
                        <g>
                          <line x1="74" y1="70" x2="104" y2="50" stroke="#4b5563" strokeWidth="2.5" strokeLinecap="round"></line>
                          <polygon points="92,58 110,46 114,52 96,64" fill="#15803d" stroke="#14532d" strokeWidth="1" strokeLinejoin="round"></polygon>
                          <polygon points="92,58 110,46 106,40 88,52" fill="#22c55e" stroke="#14532d" strokeWidth="1" strokeLinejoin="round"></polygon>
                        </g>
                      </svg>
                    </div>
                  </div>

                  <div className="ctwa-form-group">
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span> Ad Description (Optional)</label>
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
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V12c0-.55-.45-1-1-1s-1 .45-1 1v6.09c-1.42-.51-2.5-1.78-2.83-3.34L11 11.41C11.39 10.05 12.74 9 14.34 9c1.66 0 3.04 1.14 3.39 2.59l-2.4 3.33c-.35 1.57-1.45 2.84-2.92 3.17z"/></svg></span> Ad Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} required className="ctwa-select">
                      <option value="PAUSED">Paused (Draft)</option>
                      <option value="ACTIVE">Active (Publish Immediately)</option>
                    </select>
                  </div>
                  <div className="ctwa-form-group">
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></span> WhatsApp Welcome Message</label>
                    <input 
                      type="text" 
                      name="welcomeMessageText" 
                      value={formData.welcomeMessageText}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label><span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 9h-2V9h2v2zm-4 0H9V9h2v2zm-4 0H5V9h2v2z"/></svg></span> Ice Breaker Button Text</label>
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
                  <div className="ctwa-form-group" style={{ marginBottom: '1rem' }}>
                    <label>1. Select Primary Country (Optional, for higher accuracy)</label>
                    <Select
                      options={countryOptions}
                      placeholder="Select a country to narrow down search..."
                      value={countryOptions.find(c => c.value === formData.baseCountryCode) || null}
                      onChange={(selected: any) => setFormData({ ...formData, baseCountryCode: selected ? selected.value : '' })}
                      isClearable
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          padding: '4px',
                          borderRadius: '10px',
                          borderWidth: '1.5px',
                          borderColor: state.isFocused ? '#25D366' : '#e2e8f0',
                          backgroundColor: '#f8fafc',
                          boxShadow: state.isFocused ? '0 0 0 4px rgba(37, 211, 102, 0.15), 0 2px 4px rgba(0,0,0,0.02) inset' : '0 2px 4px rgba(0,0,0,0.02) inset',
                          transition: 'all 0.25s ease',
                          '&:hover': {
                            borderColor: state.isFocused ? '#25D366' : '#cbd5e1'
                          }
                        })
                      }}
                    />
                  </div>
                  <div className="ctwa-form-group">
                    <label>2. Search Specific Target Locations (City, State, Neighborhood)</label>
                    <AsyncCreatableSelect
                      isMulti
                      cacheOptions
                      defaultOptions={[]}
                      loadOptions={loadOptions}
                      formatOptionLabel={customFormatOptionLabel}
                      placeholder="Search locations (e.g. City, Neighborhood)..."
                      value={targetCountriesOptions}
                      onChange={(selected: any) => {
                        const newLocations = selected ? selected.map((s: any) => s.value) : [];
                        setFormData({ ...formData, targetCountries: newLocations.join('|') });
                        
                        // If selected option has lat/lng, automatically drop a pin
                        if (selected && selected.length > 0) {
                          const latest = selected[selected.length - 1];
                          if (latest && latest.lat && latest.lng) {
                            setDroppedPins((prev: any) => {
                              if (!prev.some((p: any) => p.name === latest.value)) {
                                return [...prev, { lat: latest.lat, lng: latest.lng, name: latest.value }];
                              }
                              return prev;
                            });
                          }
                        }
                      }}
                      styles={{
                        menu: base => ({ ...base, zIndex: 9999, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }),
                        control: (base, state) => ({
                          ...base,
                          padding: '4px',
                          borderRadius: '10px',
                          borderWidth: '1.5px',
                          borderColor: state.isFocused ? '#25D366' : '#e2e8f0',
                          backgroundColor: '#f8fafc',
                          boxShadow: state.isFocused ? '0 0 0 4px rgba(37, 211, 102, 0.15), 0 2px 4px rgba(0,0,0,0.02) inset' : '0 2px 4px rgba(0,0,0,0.02) inset',
                          transition: 'all 0.25s ease',
                          '&:hover': {
                            borderColor: state.isFocused ? '#25D366' : '#cbd5e1'
                          }
                        })
                      }}
                    />
                    
                    {/* Meta-style Location List Configuration */}
                    {formData.targetCountries && (
                      <div style={{ marginTop: '12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                        {formData.targetCountries.split('|').filter(Boolean).map((locName: string, idx: number, arr: string[]) => (
                          <div key={idx} style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                            padding: '10px 16px', background: idx % 2 === 0 ? '#f9fafb' : 'white',
                            borderBottom: idx < arr.length - 1 ? '1px solid #e5e7eb' : 'none',
                            borderTopLeftRadius: idx === 0 ? '8px' : '0',
                            borderTopRightRadius: idx === 0 ? '8px' : '0',
                            borderBottomLeftRadius: idx === arr.length - 1 ? '8px' : '0',
                            borderBottomRightRadius: idx === arr.length - 1 ? '8px' : '0',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151' }}>{locName}</span>
                            </div>
                            
                            <RadiusConfigurator 
                              locationName={locName} 
                              radius={formData.locationRadiuses?.[locName] !== undefined ? formData.locationRadiuses[locName] : 25} 
                              onChange={(newRadius) => {
                                setFormData({
                                  ...formData,
                                  locationRadiuses: {
                                    ...formData.locationRadiuses,
                                    [locName]: newRadius
                                  }
                                });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Interactive Meta-style Map */}
                    <MemoizedMap 
                      formData={formData} 
                      setFormData={setFormData} 
                      droppedPins={droppedPins} 
                      setDroppedPins={setDroppedPins} 
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

            <div className="ctwa-actions" style={{ flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', position: 'relative' }}>
                {currentStep > 1 && !successData && (
                  <button type="button" onClick={prevStep} className="ctwa-back-btn" style={{ position: 'relative', transform: 'none', top: 'auto', left: 'auto' }}>
                    Back
                  </button>
                )}
                
                {!successData && (
                  <button type="submit" disabled={loading} className={`ctwa-submit-btn ${currentStep === totalSteps ? 'pulse-button' : ''}`} style={{marginLeft: 'auto'}}>
                    {currentStep === totalSteps ? (loading ? 'Launching Ad...' : 'Launch WhatsApp Ad') : (
                      <>
                        {loading ? 'Creating...' : 'Next'}
                        {!loading && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width: '16px', height: '16px', marginLeft: '6px'}}><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>}
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {!successData && (
                <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#64748b', display: 'flex', justifyContent: 'flex-end', width: '100%', gap: '16px', marginTop: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Meta Ads API Secured
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Takes ~2 mins
                  </span>
                </div>
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

        <div className="ctwa-right-panel">
          {adPreview}
        </div>
      </div>
    </div>
  );
};

export default ClickToWhatsAppLauncher;
