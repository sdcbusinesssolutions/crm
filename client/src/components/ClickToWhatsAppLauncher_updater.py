import re

file_path = '/home/devendra/proj/wpcode/client/src/components/ClickToWhatsAppLauncher.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update state type definitions
content = content.replace("detailedTargeting: [] as { id: string, name: string, type: 'interest'|'behavior', mode: 'include'|'exclude' }[]", 
                          "detailedTargeting: [] as { id: string, name: string, type: 'interest'|'behavior', mode: 'include'|'exclude'|'narrow' }[]")
content = content.replace("const [targetingMode, setTargetingMode] = useState<'include' | 'exclude'>('include');",
                          "const [targetingMode, setTargetingMode] = useState<'include' | 'exclude' | 'narrow'>('include');")

# 2. Update flexibleSpec building logic
old_logic = """      // Grouping by type for OR logic (Default broad match behavior)
      const includedInterests = formData.detailedTargeting.filter(t => t.mode === 'include' && t.type === 'interest').map(t => ({ id: t.id, name: t.name }));
      const includedBehaviors = formData.detailedTargeting.filter(t => t.mode === 'include' && t.type === 'behavior').map(t => ({ id: t.id, name: t.name }));
      
      const flexibleSpec = [];
      if (includedInterests.length > 0 || includedBehaviors.length > 0) {
        const orCondition: any = {};
        if (includedInterests.length > 0) orCondition.interests = includedInterests;
        if (includedBehaviors.length > 0) orCondition.behaviors = includedBehaviors;
        flexibleSpec.push(orCondition); // Pushing as a single object creates OR logic between all of them
      }"""

new_logic = """      // Grouping by type for OR logic (Primary Match Box)
      const includedInterests = formData.detailedTargeting.filter(t => t.mode === 'include' && t.type === 'interest').map(t => ({ id: t.id, name: t.name }));
      const includedBehaviors = formData.detailedTargeting.filter(t => t.mode === 'include' && t.type === 'behavior').map(t => ({ id: t.id, name: t.name }));
      
      const flexibleSpec = [];
      if (includedInterests.length > 0 || includedBehaviors.length > 0) {
        const orCondition: any = {};
        if (includedInterests.length > 0) orCondition.interests = includedInterests;
        if (includedBehaviors.length > 0) orCondition.behaviors = includedBehaviors;
        flexibleSpec.push(orCondition); // Pushing as a single object creates OR logic between all of them
      }
      
      // Grouping narrow tags into a SECOND object (AND logic across boxes, OR logic within box)
      const narrowInterests = formData.detailedTargeting.filter(t => t.mode === 'narrow' && t.type === 'interest').map(t => ({ id: t.id, name: t.name }));
      const narrowBehaviors = formData.detailedTargeting.filter(t => t.mode === 'narrow' && t.type === 'behavior').map(t => ({ id: t.id, name: t.name }));
      if (narrowInterests.length > 0 || narrowBehaviors.length > 0) {
        const narrowCondition: any = {};
        if (narrowInterests.length > 0) narrowCondition.interests = narrowInterests;
        if (narrowBehaviors.length > 0) narrowCondition.behaviors = narrowBehaviors;
        flexibleSpec.push(narrowCondition); // Pushing as a SECOND object creates AND logic with the first box!
      }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)

# 3. Replace the entire Targeting Modal section (removing tabs, using new UI)
start_str = '            {/* Modal Header */}'
end_str = '            <div style={{ padding: \'16px 24px\', borderTop: \'1px solid #e2e8f0\', display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\', background: \'white\' }}>'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_modal_content = """            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>Detailed Targeting</h3>
              <button onClick={() => setIsTargetingModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* ---------------- BOX 1: INCLUDE (OR) ---------------- */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc', boxShadow: targetingMode === 'include' ? '0 0 0 2px #ea580c' : 'none', transition: '0.2s' }} onClick={() => setTargetingMode('include')}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>Include people who match</div>
                  
                  {/* Tags */}
                  {formData.detailedTargeting.filter(t => t.mode === 'include').length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      {formData.detailedTargeting.filter(t => t.mode === 'include').map(tag => (
                        <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'white', borderRadius: '20px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                          <span style={{ color: '#0f172a', fontWeight: 500 }}>{tag.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, detailedTargeting: prev.detailedTargeting.filter(t => t.id !== tag.id) })); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0', display: 'flex', alignItems: 'center' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Search Input (Only show if active) */}
                  {targetingMode === 'include' && (
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Add interests or behaviors..."
                        value={targetingSearch}
                        onChange={(e) => setTargetingSearch(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none', background: 'white', color: '#0f172a' }}
                      />
                      {isSearchingTargeting && <span style={{ position: 'absolute', right: '12px', top: '12px', fontSize: '0.75rem', color: '#64748b' }}>Searching...</span>}
                      
                      {targetingSearch && !isSearchingTargeting && (
                        <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                          {targetingSearchResults.length > 0 ? targetingSearchResults.map((res: any) => (
                              <div key={res.id} onClick={(e) => { e.stopPropagation(); setFormData(prev => { if (prev.detailedTargeting.some(t => t.id === res.id)) return prev; return { ...prev, advantageAudience: 0, detailedTargeting: [...prev.detailedTargeting, { id: res.id, name: res.name, type: searchTargetingType === 'adinterest' ? 'interest' : 'behavior', mode: 'include' }] }; }); setTargetingSearch(''); setTargetingSearchResults([]); }} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{res.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Size: {res.audience_size_lower_bound?.toLocaleString() || 'Unknown'}</div>
                              </div>
                            )) : <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>No results found.</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* ---------------- BOX 2: NARROW (AND) ---------------- */}
                {(!formData.detailedTargeting.some(t => t.mode === 'narrow') && targetingMode !== 'narrow') ? (
                  <button onClick={() => { setTargetingMode('narrow'); setTargetingSearch(''); }} style={{ background: 'none', border: 'none', color: '#ea580c', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    + Narrow Audience
                  </button>
                ) : (
                  <div style={{ border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', background: '#f0fdf4', boxShadow: targetingMode === 'narrow' ? '0 0 0 2px #22c55e' : 'none', transition: '0.2s' }} onClick={() => setTargetingMode('narrow')}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#166534', marginBottom: '12px' }}>And must also match (Narrow)</div>
                    
                    {/* Tags */}
                    {formData.detailedTargeting.filter(t => t.mode === 'narrow').length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {formData.detailedTargeting.filter(t => t.mode === 'narrow').map(tag => (
                          <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'white', borderRadius: '20px', border: '1px solid #86efac', fontSize: '0.85rem' }}>
                            <span style={{ color: '#14532d', fontWeight: 500 }}>{tag.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, detailedTargeting: prev.detailedTargeting.filter(t => t.id !== tag.id) })); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', padding: '0', display: 'flex', alignItems: 'center' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Search Input (Only show if active) */}
                    {targetingMode === 'narrow' && (
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Add interests or behaviors to narrow..."
                          value={targetingSearch}
                          onChange={(e) => setTargetingSearch(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #86efac', fontSize: '0.95rem', outline: 'none', background: 'white', color: '#0f172a' }}
                        />
                        {isSearchingTargeting && <span style={{ position: 'absolute', right: '12px', top: '12px', fontSize: '0.75rem', color: '#64748b' }}>Searching...</span>}
                        
                        {targetingSearch && !isSearchingTargeting && (
                          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            {targetingSearchResults.length > 0 ? targetingSearchResults.map((res: any) => (
                                <div key={res.id} onClick={(e) => { e.stopPropagation(); setFormData(prev => { if (prev.detailedTargeting.some(t => t.id === res.id)) return prev; return { ...prev, advantageAudience: 0, detailedTargeting: [...prev.detailedTargeting, { id: res.id, name: res.name, type: searchTargetingType === 'adinterest' ? 'interest' : 'behavior', mode: 'narrow' }] }; }); setTargetingSearch(''); setTargetingSearchResults([]); }} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{res.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Size: {res.audience_size_lower_bound?.toLocaleString() || 'Unknown'}</div>
                                </div>
                              )) : <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>No results found.</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* ---------------- BOX 3: EXCLUDE ---------------- */}
                {(!formData.detailedTargeting.some(t => t.mode === 'exclude') && targetingMode !== 'exclude') ? (
                  <button onClick={() => { setTargetingMode('exclude'); setTargetingSearch(''); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    + Exclude Audience
                  </button>
                ) : (
                  <div style={{ border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', background: '#fef2f2', boxShadow: targetingMode === 'exclude' ? '0 0 0 2px #ef4444' : 'none', transition: '0.2s' }} onClick={() => setTargetingMode('exclude')}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#991b1b', marginBottom: '12px' }}>Exclude people who match</div>
                    
                    {/* Tags */}
                    {formData.detailedTargeting.filter(t => t.mode === 'exclude').length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {formData.detailedTargeting.filter(t => t.mode === 'exclude').map(tag => (
                          <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'white', borderRadius: '20px', border: '1px solid #fca5a5', fontSize: '0.85rem' }}>
                            <span style={{ color: '#7f1d1d', fontWeight: 500 }}>{tag.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, detailedTargeting: prev.detailedTargeting.filter(t => t.id !== tag.id) })); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0', display: 'flex', alignItems: 'center' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Search Input (Only show if active) */}
                    {targetingMode === 'exclude' && (
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Add interests or behaviors to exclude..."
                          value={targetingSearch}
                          onChange={(e) => setTargetingSearch(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #fca5a5', fontSize: '0.95rem', outline: 'none', background: 'white', color: '#0f172a' }}
                        />
                        {isSearchingTargeting && <span style={{ position: 'absolute', right: '12px', top: '12px', fontSize: '0.75rem', color: '#64748b' }}>Searching...</span>}
                        
                        {targetingSearch && !isSearchingTargeting && (
                          <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            {targetingSearchResults.length > 0 ? targetingSearchResults.map((res: any) => (
                                <div key={res.id} onClick={(e) => { e.stopPropagation(); setFormData(prev => { if (prev.detailedTargeting.some(t => t.id === res.id)) return prev; return { ...prev, advantageAudience: 0, detailedTargeting: [...prev.detailedTargeting, { id: res.id, name: res.name, type: searchTargetingType === 'adinterest' ? 'interest' : 'behavior', mode: 'exclude' }] }; }); setTargetingSearch(''); setTargetingSearchResults([]); }} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{res.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Size: {res.audience_size_lower_bound?.toLocaleString() || 'Unknown'}</div>
                                </div>
                              )) : <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>No results found.</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <select 
                    value={searchTargetingType} 
                    onChange={(e) => setSearchTargetingType(e.target.value as 'adinterest'|'adbehavior')}
                    style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', color: '#334155', fontWeight: 500 }}
                  >
                    <option value="adinterest">Search Interests</option>
                    <option value="adbehavior">Search Behaviors</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>"""

    content = content[:start_idx] + new_modal_content + content[end_idx + len(end_str):]
    with open(file_path, 'w') as f:
        f.write(content)
    print("Done")
else:
    print("Start or end not found!")
