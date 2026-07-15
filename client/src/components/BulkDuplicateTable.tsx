import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { tokenService } from '../services/tokenService';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import AsyncCreatableSelect from 'react-select/async-creatable';
import debounce from 'lodash/debounce';

interface AdSetRow {
  id: string;
  name: string;
  location: string;
  locationsExclude?: string;
  age: string;
  gender?: string;
  detailedTargeting?: string;
  budget: string;
  creativesCount: number;
  customMediaUrls?: string[];
}

interface BulkDuplicateTableProps {
  baseFormData: any;
  budgetOptimization?: 'CBO' | 'ABO';
  onRowsChange: (rows: AdSetRow[]) => void;
}

export default function BulkDuplicateTable({ baseFormData, budgetOptimization = 'CBO', onRowsChange }: BulkDuplicateTableProps) {
  const [duplicateCount, setDuplicateCount] = useState<number>(1);
  const [copyCreatives, setCopyCreatives] = useState<boolean>(true);
  const [rows, setRows] = useState<AdSetRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<AdSetRow | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const generateRows = () => {
    const newRows: AdSetRow[] = [];
    const baseLocation = baseFormData.targetCountries ? baseFormData.targetCountries.split('|')[0] : (baseFormData.baseCountryCode || 'Delhi');
    const baseAge = `${baseFormData.minAge}-${baseFormData.maxAge}`;
    
    for (let i = 0; i < duplicateCount; i++) {
      newRows.push({
        id: `adset_${Date.now()}_${i}`,
        name: `${baseLocation} - ${baseAge} - Copy ${i+1}`,
        location: baseLocation,
        locationsExclude: '',
        age: baseAge,
        gender: baseFormData.gender || 'ALL',
        detailedTargeting: '',
        budget: baseFormData.dailyBudget?.toString() || '500',
        creativesCount: copyCreatives ? (baseFormData.mediaUrls?.length || 0) : 0,
        customMediaUrls: []
      });
    }
    setRows(newRows);
    onRowsChange(newRows);
  };

  const handleCellChange = (id: string, field: keyof AdSetRow, value: string) => {
    const updatedRows = rows.map(r => r.id === id ? { ...r, [field]: value } : r);
    setRows(updatedRows);
    onRowsChange(updatedRows);
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const authHeader = await tokenService.getAuthHeader();
      const response = await fetch('/api/click-to-whatsapp/generate-bulk-ai', {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ baseConfig: baseFormData, prompt: aiPrompt })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate');
      
      if (data.data && Array.isArray(data.data)) {
        const baseLocation = baseFormData.targetCountries ? baseFormData.targetCountries.split('|')[0] : (baseFormData.baseCountryCode || 'Delhi');
        const baseAge = `${baseFormData.minAge}-${baseFormData.maxAge}`;
        const newRows = data.data.map((item: any, i: number) => ({
          id: `adset_ai_${Date.now()}_${i}`,
          name: item.name || `${baseLocation} - AI Copy ${i+1}`,
          location: item.location || baseLocation,
          locationsExclude: item.locationsExclude || '',
          age: item.age || baseAge,
          gender: item.gender || baseFormData.gender || 'ALL',
          detailedTargeting: item.detailedTargeting || '',
          budget: item.budget?.toString() || baseFormData.dailyBudget?.toString() || '500',
          creativesCount: item.creativesCount || (copyCreatives ? (baseFormData.mediaUrls?.length || 0) : 0),
          customMediaUrls: []
        }));
        setRows(newRows);
        onRowsChange(newRows);
        setAiPrompt('');
      }
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const fetchLocations = useMemo(
    () =>
      debounce((inputValue: string, resolve: (options: any[]) => void) => {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=15&accept-language=en&q=${encodeURIComponent(inputValue)}`)
          .then(res => res.json())
          .then(data => {
            if (!Array.isArray(data)) {
              resolve([]);
              return;
            }
            const options = data.map((item: any) => {
              const addr = item.address || {};
              const nameParts = [];
              const localName = addr.neighbourhood || addr.suburb || addr.village || addr.town || addr.city || item.name;
              if (localName) nameParts.push(localName);
              if (addr.state && addr.state !== localName) nameParts.push(addr.state);
              if (addr.country && addr.country !== localName && addr.country !== addr.state) nameParts.push(addr.country);
              const cleanLabel = nameParts.join(', ');
              
              let type = item.addresstype || item.type || 'Location';
              if (type === 'administrative' || type === 'state_district') type = 'Region';
              else type = type.charAt(0).toUpperCase() + type.slice(1);
              
              return { label: cleanLabel, value: cleanLabel, type: type };
            });
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

  const loadLocationOptions = useCallback((inputValue: string) => {
    return new Promise<any[]>(resolve => {
      if (!inputValue) {
        resolve([]);
        return;
      }
      fetchLocations(inputValue, resolve);
    });
  }, [fetchLocations]);

  const fetchTargeting = useMemo(
    () =>
      debounce(async (inputValue: string, resolve: (options: any[]) => void) => {
        try {
          const authHeader = await tokenService.getAuthHeader();
          const response = await fetch(`/api/click-to-whatsapp/search-targeting?q=${encodeURIComponent(inputValue)}&type=interests&adAccountId=${baseFormData.adAccountId || ''}&country=${baseFormData.baseCountryCode || 'IN'}`, {
             headers: { 'Authorization': authHeader.Authorization || '' }
          });
          const data = await response.json();
          if (response.ok && data.data && data.data.data) {
            const options = data.data.data.map((item: any) => ({
              label: item.name,
              value: item.name,
              audienceSize: item.audience_size_upper_bound
            }));
            resolve(options);
          } else {
            resolve([]);
          }
        } catch (error) {
          console.error("Error fetching targeting:", error);
          resolve([]);
        }
      }, 600),
    [baseFormData]
  );

  const loadTargetingOptions = useCallback((inputValue: string) => {
    return new Promise<any[]>(resolve => {
      if (!inputValue) {
        resolve([]);
        return;
      }
      fetchTargeting(inputValue, resolve);
    });
  }, [fetchTargeting]);

  return (
    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#1c2b33', fontSize: '16px' }}>Bulk Duplication Magic Setup</h4>
      <p style={{ margin: '0 0 20px 0', color: '#475569', fontSize: '14px' }}>
        Create multiple AdSets instantly based on your Master Template.
      </p>

      {/* AI Magic Generator */}
      <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '24px' }}>
        <h5 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ✨ AI Magic Prompt
        </h5>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input 
            type="text" 
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. Test 3 tier-1 cities in India with 1000 budget each..." 
            className="ctwa-input" 
            style={{ flex: 1, border: '1px solid #86efac' }}
            disabled={aiLoading}
          />
          <button 
            type="button" 
            onClick={generateWithAI} 
            disabled={aiLoading || !aiPrompt.trim()}
            className="ctwa-submit-btn" 
            style={{ padding: '8px 16px', background: '#16a34a', border: 'none', minWidth: '120px' }}
          >
            {aiLoading ? 'Generating...' : 'Generate with AI'}
          </button>
        </div>
        {aiError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{aiError}</div>}
      </div>
      
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '4px' }}>How many copies?</label>
          <input type="number" min="1" max="50" value={duplicateCount} onChange={e => setDuplicateCount(parseInt(e.target.value) || 1)} className="ctwa-input" style={{ width: '150px' }} />
        </div>
        <div style={{ paddingBottom: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={copyCreatives} onChange={e => setCopyCreatives(e.target.checked)} />
            Copy Creatives Too
          </label>
        </div>
        <button type="button" onClick={generateRows} className="ctwa-submit-btn" style={{ padding: '8px 16px' }}>Generate Table</button>
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
            <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#475569' }}>AdSet Name</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#475569' }}>Location</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#475569' }}>Age</th>
                {budgetOptimization === 'ABO' && (
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#475569' }}>Budget</th>
                )}
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#475569' }}>Creatives</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="text" value={row.name} onChange={e => handleCellChange(row.id, 'name', e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px 8px', width: '100%' }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="text" value={row.location} onChange={e => handleCellChange(row.id, 'location', e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px 8px', width: '100px' }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="text" value={row.age} onChange={e => handleCellChange(row.id, 'age', e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px 8px', width: '60px' }} />
                  </td>
                  {budgetOptimization === 'ABO' && (
                    <td style={{ padding: '8px 12px' }}>
                      <input type="text" value={row.budget} onChange={e => handleCellChange(row.id, 'budget', e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px 8px', width: '80px' }} />
                    </td>
                  )}
                  <td style={{ padding: '8px 12px', fontSize: '14px', color: '#64748b' }}>
                    {row.creativesCount} Ready
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <button type="button" onClick={() => setSelectedRow(row)} className="ctwa-btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>✎ Edit Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', width: '600px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#0f172a' }}>Advanced Edit</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Customizing row: <strong style={{color: '#334155'}}>{selectedRow.name}</strong></p>
              </div>
              <button onClick={() => setSelectedRow(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>AdSet Name</label>
                <input type="text" value={selectedRow.name} onChange={e => setSelectedRow({...selectedRow, name: e.target.value})} className="ctwa-input" style={{ width: '100%', border: '1px solid #cbd5e1' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Included Locations</label>
                <AsyncCreatableSelect
                  isMulti
                  cacheOptions
                  loadOptions={loadLocationOptions}
                  defaultOptions
                  placeholder="Search locations (city, state, village)..."
                  value={(selectedRow.location || '').split('|').filter(Boolean).map(l => ({ label: l, value: l }))}
                  onChange={(newVals: any) => setSelectedRow({...selectedRow, location: newVals ? newVals.map((v: any) => v.value).join('|') : ''})}
                  styles={{ control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px', borderColor: '#cbd5e1' }) }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Excluded Locations</label>
                <AsyncCreatableSelect
                  isMulti
                  cacheOptions
                  loadOptions={loadLocationOptions}
                  defaultOptions
                  placeholder="Search locations to exclude..."
                  value={(selectedRow.locationsExclude || '').split('|').filter(Boolean).map(l => ({ label: l, value: l }))}
                  onChange={(newVals: any) => setSelectedRow({...selectedRow, locationsExclude: newVals ? newVals.map((v: any) => v.value).join('|') : ''})}
                  styles={{ control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px', borderColor: '#cbd5e1' }) }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Age Range</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select 
                    value={selectedRow.age.split('-')[0] || '18'} 
                    onChange={e => {
                      const max = selectedRow.age.split('-')[1] || '65';
                      setSelectedRow({...selectedRow, age: `${e.target.value}-${max}`});
                    }} 
                    className="ctwa-select" style={{ flex: 1, border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px' }}
                  >
                    {Array.from({length: 48}, (_, i) => 18 + i).map(age => <option key={age} value={age}>{age}</option>)}
                  </select>
                  <span style={{color: '#64748b'}}>-</span>
                  <select 
                    value={selectedRow.age.split('-')[1] || '65'} 
                    onChange={e => {
                      const min = selectedRow.age.split('-')[0] || '18';
                      setSelectedRow({...selectedRow, age: `${min}-${e.target.value}`});
                    }} 
                    className="ctwa-select" style={{ flex: 1, border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px' }}
                  >
                    {Array.from({length: 48}, (_, i) => 18 + i).map(age => <option key={age} value={age}>{age}</option>)}
                    <option value="65+">65+</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Gender</label>
                <select value={selectedRow.gender || 'ALL'} onChange={e => setSelectedRow({...selectedRow, gender: e.target.value})} className="ctwa-select" style={{ width: '100%', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '6px', height: '38px' }}>
                  <option value="ALL">All Genders</option>
                  <option value="MALE">Men Only</option>
                  <option value="FEMALE">Women Only</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Detailed Targeting (Interests, Behaviors)</label>
                <AsyncCreatableSelect
                  isMulti
                  cacheOptions
                  loadOptions={loadTargetingOptions}
                  defaultOptions
                  placeholder="Search detailed targeting (e.g. Digital marketing, Real estate)..."
                  value={(selectedRow.detailedTargeting || '').split(',').filter(Boolean).map(l => ({ label: l.trim(), value: l.trim() }))}
                  onChange={(newVals: any) => setSelectedRow({...selectedRow, detailedTargeting: newVals ? newVals.map((v: any) => v.value).join(', ') : ''})}
                  styles={{ control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px', borderColor: '#cbd5e1' }) }}
                />
              </div>

              {budgetOptimization === 'ABO' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Daily Budget (₹)</label>
                  <input type="number" value={selectedRow.budget} onChange={e => setSelectedRow({...selectedRow, budget: e.target.value})} className="ctwa-input" style={{ width: '100%', border: '1px solid #cbd5e1' }} />
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🖼️</span>
              <p style={{ margin: '0 0 8px 0', color: '#475569', fontSize: '14px', fontWeight: 500 }}>Override Master Creatives</p>
              <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '12px' }}>Upload specific images/videos just for this AdSet (Up to 4).</p>
              
              {selectedRow.customMediaUrls && selectedRow.customMediaUrls.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
                  {selectedRow.customMediaUrls.map((url, i) => (
                    <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                      {url.match(/\.(mp4|webm|ogg|mov)(?:[\?#].*)?$/i) ? (
                        <video src={url} style={{width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e5e7eb'}} />
                      ) : (
                        <img src={url} alt="Override Creative" style={{width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #e5e7eb'}} />
                      )}
                      <button type="button" onClick={() => setSelectedRow({...selectedRow, customMediaUrls: selectedRow.customMediaUrls?.filter((_, idx) => idx !== i)})} style={{position: 'absolute', top: '-6px', right: '-6px', background: '#dc2626', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>&times;</button>
                    </div>
                  ))}
                </div>
              )}
              
              {(!selectedRow.customMediaUrls || selectedRow.customMediaUrls.length < 4) && (
                <button type="button" className="ctwa-btn-secondary" style={{ fontSize: '13px' }} onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*,video/*';
                  input.onchange = async (e: any) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const uploadData = new FormData();
                    uploadData.append('file', file);
                    uploadData.append('module', 'ctwa');
                    try {
                      const authHeader = await tokenService.getAuthHeader();
                      const response = await fetch('/api/upload', {
                        method: 'POST',
                        headers: { 'Authorization': authHeader.Authorization || '' },
                        body: uploadData
                      });
                      const data = await response.json();
                      if (response.ok) {
                        const currentUrls = selectedRow.customMediaUrls || [];
                        setSelectedRow({...selectedRow, customMediaUrls: [...currentUrls, data.url]});
                      }
                    } catch (err) { console.error('Upload failed', err); }
                  };
                  input.click();
                }}>Browse Files</button>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <button type="button" onClick={() => setSelectedRow(null)} className="ctwa-btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button type="button" onClick={() => {
                const updatedRows = rows.map(r => r.id === selectedRow.id ? selectedRow : r);
                setRows(updatedRows);
                onRowsChange(updatedRows);
                setSelectedRow(null);
              }} className="ctwa-submit-btn" style={{ padding: '10px 24px' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
