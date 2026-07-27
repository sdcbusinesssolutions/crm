const fs = require('fs');
const file = 'client/src/components/ClickToWhatsAppLauncher.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!code.includes("import BulkDuplicateTable from './BulkDuplicateTable';")) {
    code = code.replace("import './ClickToWhatsAppLauncher.css';", "import './ClickToWhatsAppLauncher.css';\nimport BulkDuplicateTable from './BulkDuplicateTable';");
}

// 2. Add AI Prompt State
code = code.replace("const [currentStep, setCurrentStep] = useState(1);", "const [currentStep, setCurrentStep] = useState(0);\n  const [aiPromptText, setAiPromptText] = useState('');");

// 3. Add budgetOptimization to formData
code = code.replace("campaignName: '',\n    dailyBudget: '',", "campaignName: '',\n    budgetOptimization: 'CBO' as 'CBO' | 'ABO',\n    dailyBudget: '',");

// 4. Update Step 3 (Budget)
const oldBudgetSection = `                <div className="ctwa-form-group">
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
                  <div className="ctwa-budget-presets">`;

const newBudgetSection = `                <div className="ctwa-form-group">
                  <label className="ctwa-label">
                    <span className="step-number">2</span>
                    Budget Optimization
                  </label>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '-4px 0 12px 0' }}>
                    How should Meta distribute your budget across Ad Sets?
                  </p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div 
                      onClick={() => setFormData({...formData, budgetOptimization: 'CBO'})}
                      style={{ padding: '16px', border: \`2px solid \${formData.budgetOptimization === 'CBO' ? '#25D366' : '#e2e8f0'}\`, borderRadius: '8px', cursor: 'pointer', background: formData.budgetOptimization === 'CBO' ? '#f0fdf4' : 'white' }}
                    >
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1e293b' }}>Advantage+ Campaign Budget (CBO)</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Set one budget for the whole campaign. Meta automatically finds the best-performing Ad Sets.</p>
                    </div>
                    
                    <div 
                      onClick={() => setFormData({...formData, budgetOptimization: 'ABO'})}
                      style={{ padding: '16px', border: \`2px solid \${formData.budgetOptimization === 'ABO' ? '#25D366' : '#e2e8f0'}\`, borderRadius: '8px', cursor: 'pointer', background: formData.budgetOptimization === 'ABO' ? '#f0fdf4' : 'white' }}
                    >
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1e293b' }}>Ad Set Budget (ABO)</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Set a strict daily budget for each individual Ad Set separately.</p>
                    </div>
                  </div>
                </div>

                <div className="ctwa-form-group">
                  <label className="ctwa-label">
                    <span className="step-number">3</span>
                    {formData.budgetOptimization === 'CBO' ? 'Campaign Daily Budget' : 'Default Ad Set Daily Budget'}
                  </label>
                  <div className="budget-input-wrapper">
                    <span className="currency-symbol">{currencySymbolMap[currencyCode] || '$'}</span>
                    <input 
                      type="number" 
                      className="ctwa-input with-icon"
                      placeholder="e.g. 500" 
                      name="dailyBudget" 
                      value={formData.dailyBudget}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="ctwa-budget-presets">`;
code = code.replace(oldBudgetSection, newBudgetSection);

// 5. Replace Tree State with Array
const oldTreeState = `  // A/B Testing Tree State (Mocked for UI visualization)
  const [adTree, setAdTree] = useState([
    { id: '1', name: 'Ad Set 1', targeting: 'Pune, Maharashtra', budget: '100', ads: [ { id: '1-1', name: 'Creative 1', media: 'Image' } ] }
  ]);
  const handleAddAdSet = () => {
    setAdTree([...adTree, { id: Date.now().toString(), name: \`Ad Set \${adTree.length + 1}\`, targeting: 'New Audience', budget: '100', ads: [{ id: Date.now().toString()+'-1', name: 'Creative 1', media: 'Image' }] }]);
  };
  const handleAddCreative = (adSetId: string) => {
    setAdTree(adTree.map(aset => {
      if (aset.id === adSetId) {
        return { ...aset, ads: [...aset.ads, { id: Date.now().toString(), name: \`Creative \${aset.ads.length + 1}\`, media: 'Image' }] };
      }
      return aset;
    }));
  };`;
code = code.replace(oldTreeState, "  const [duplicateRows, setDuplicateRows] = useState<any[]>([]);");


// 6. Replace Step 5 UI
const oldStep5 = `{currentStep === 5 && (
              <div className="ctwa-form-section fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ margin: 0, color: '#1c2b33', fontSize: '18px', fontWeight: 600 }}>A/B Testing & Duplication</h3>
                </div>
                
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#1c2b33', fontSize: '16px' }}>Campaign Hierarchy</h4>
                  <p style={{ margin: '0 0 20px 0', color: '#475569', fontSize: '14px' }}>
                    Review your campaign structure below. You can duplicate audiences or creatives to run A/B tests.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {adTree.map((aset) => (
                      <div key={aset.id} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', background: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h5 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>▼ {aset.name} <span style={{fontSize: '12px', color: '#64748b', fontWeight: 'normal'}}>(Targeting: {aset.targeting} • Budget: {currencySymbolMap[currencyCode] || '$'}{aset.budget})</span></h5>
                        </div>
                        
                        <div style={{ paddingLeft: '24px', borderLeft: '2px solid #e2e8f0', marginLeft: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {aset.ads.map((ad) => (
                            <div key={ad.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#334155' }}>
                              <span>├──</span>
                              <span>🖼️ {ad.name} <span style={{fontSize: '12px', color: '#64748b'}}>({ad.media})</span></span>
                            </div>
                          ))}
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginTop: '4px' }}>
                            <span style={{ color: '#94a3b8' }}>└──</span>
                            <button type="button" onClick={() => handleAddCreative(aset.id)} className="ctwa-btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }}>
                              + Add Another Creative to {aset.name}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={handleAddAdSet} className="ctwa-btn-secondary" style={{ marginTop: '20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    + Add Another Ad Set (Test New Audience)
                  </button>
                </div>
              </div>
            )}`;

const newStep5 = `{currentStep === 5 && (
              <div className="ctwa-form-section fade-in">
                <BulkDuplicateTable 
                  baseFormData={formData} 
                  budgetOptimization={formData.budgetOptimization}
                  onRowsChange={setDuplicateRows} 
                />
              </div>
            )}`;
code = code.replace(oldStep5, newStep5);


// 7. Add Step 0 AI Screen and update Progress
const oldProgress = `{/* Progress Indicator */}
          <div className="ctwa-progress">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className={\`ctwa-step-dot \${currentStep >= step ? 'active' : ''}\`} />
            ))}
          </div>

          <form className="ctwa-form" onSubmit={(e) => e.preventDefault()}>

            {/* STEP 1: Objective & Identity */}`;

const newProgress = `{/* Progress Indicator (Only show for manual steps 1-5) */}
          {currentStep > 0 && currentStep <= 5 && (
            <div className="ctwa-progress">
              {[1, 2, 3, 4, 5].map((step) => (
                <div key={step} className={\`ctwa-step-dot \${currentStep >= step ? 'active' : ''}\`} />
              ))}
            </div>
          )}

          <form className="ctwa-form" onSubmit={(e) => e.preventDefault()}>

            {/* STEP 0: AI vs Manual Choice */}
            {currentStep === 0 && (
              <div className="ctwa-form-section fade-in">
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#1c2b33', fontSize: '24px', fontWeight: 700 }}>How would you like to build your campaign?</h3>
                  <p style={{ color: '#475569', fontSize: '15px', maxWidth: '500px', margin: '0 auto' }}>
                    Choose to let our AI Agent instantly build your campaign from a simple prompt, or build it manually yourself step-by-step.
                  </p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '700px', margin: '0 auto' }}>
                  {/* AI Path */}
                  <div style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '32px 24px', textAlign: 'center', transition: 'all 0.2s ease', cursor: 'pointer' }}
                       onMouseEnter={e => e.currentTarget.style.borderColor = '#25D366'}
                       onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#0f172a' }}>Use AI Agent</h4>
                    <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b' }}>
                      Just type what you want to sell. Our AI will automatically configure the targeting, budget, and creatives for you in seconds.
                    </p>
                    <button type="button" className="ctwa-submit-btn" style={{ width: '100%' }} onClick={() => setCurrentStep('ai-prompt' as any)}>
                      Start with AI
                    </button>
                  </div>

                  {/* Manual Path */}
                  <div style={{ background: 'white', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '32px 24px', textAlign: 'center', transition: 'all 0.2s ease', cursor: 'pointer' }}
                       onMouseEnter={e => e.currentTarget.style.borderColor = '#25D366'}
                       onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                       onClick={() => setCurrentStep(1)}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛠️</div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#0f172a' }}>Build Manually</h4>
                    <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b' }}>
                      Full control. Use our guided 4-step wizard to manually configure your Master Template and location map pins.
                    </p>
                    <button type="button" className="ctwa-btn-secondary" style={{ width: '100%' }} onClick={() => setCurrentStep(1)}>
                      Start Manual Setup
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI PROMPT SCREEN */}
            {currentStep === 'ai-prompt' as any && (
              <div className="ctwa-form-section fade-in">
                <button type="button" onClick={() => setCurrentStep(0)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: 0 }}>
                  ← Back to choices
                </button>
                <div style={{ background: '#f8fafc', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '20px' }}>Tell the AI what you want to achieve</h3>
                  
                  <p style={{ color: '#475569', fontSize: '14px', marginBottom: '16px' }}>
                    Be as specific as you want. Mention locations to include/exclude, age groups, budgets, and what you are selling.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <button type="button" onClick={() => setAiPromptText("I want to sell luxury apartments to people aged 30-55 in Mumbai, Delhi, and Bangalore. My total budget is ₹5000 a day.")} style={{ background: '#e2e8f0', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', color: '#475569', cursor: 'pointer' }}>
                      🏢 Real Estate Template
                    </button>
                    <button type="button" onClick={() => setAiPromptText("Create a campaign for my online fitness coaching targeting young adults 18-25 across India, but exclude Kerala and Tamil Nadu. ₹1000/day budget.")} style={{ background: '#e2e8f0', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', color: '#475569', cursor: 'pointer' }}>
                      💪 Fitness Template
                    </button>
                    <button type="button" onClick={() => setAiPromptText("I run a local restaurant. I want to target men and women aged 18-40 in Pune only, specifically around Koregaon Park. Set my budget to ₹500.")} style={{ background: '#e2e8f0', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', color: '#475569', cursor: 'pointer' }}>
                      🍕 Local Business Template
                    </button>
                  </div>

                  <textarea 
                    className="ctwa-input" 
                    rows={6}
                    value={aiPromptText}
                    onChange={(e) => setAiPromptText(e.target.value)}
                    placeholder="e.g., I want to sell gym memberships to young adults in Delhi and Mumbai, but exclude Noida. My budget is ₹1500 per day."
                    style={{ resize: 'vertical', marginBottom: '16px' }}
                  ></textarea>
                  <button type="button" className="ctwa-submit-btn" style={{ width: '100%', padding: '16px' }} onClick={() => {
                    setCurrentStep(5);
                  }}>
                    ✨ Generate Campaign Magic Table
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1: Objective & Identity */}`;
code = code.replace(oldProgress, newProgress);

// 8. Update actions buttons
const oldActions = `{currentStep > 1 && (
                <button 
                  type="button" 
                  className="ctwa-btn-secondary"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                >
                  Back
                </button>
              )}
              {currentStep < totalSteps ? (
                <button 
                  type="button" 
                  className="ctwa-submit-btn ctwa-btn-next"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={accountsLoading}
                >
                  Next Step →
                </button>
              ) : (
                <button 
                  type="button" 
                  className="ctwa-submit-btn ctwa-btn-launch"
                  onClick={handleLaunchAd}
                  disabled={isLaunching}
                >
                  {isLaunching ? 'Launching Campaign...' : '🚀 Launch Bulk Campaign'}
                </button>
              )}`;

const newActions = `{currentStep > 1 && currentStep <= 5 && (
                <button 
                  type="button" 
                  className="ctwa-btn-secondary"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                >
                  Back
                </button>
              )}
              {currentStep > 0 && currentStep < 5 && (
                <button 
                  type="button" 
                  className="ctwa-submit-btn ctwa-btn-next"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={accountsLoading}
                >
                  Next Step →
                </button>
              )}
              {currentStep === 5 && (
                <button 
                  type="button" 
                  className="ctwa-submit-btn ctwa-btn-launch"
                  onClick={handleLaunchAd}
                  disabled={isLaunching}
                >
                  {isLaunching ? 'Launching Campaign...' : '🚀 Launch Bulk Campaign'}
                </button>
              )}`;
code = code.replace(oldActions, newActions);

fs.writeFileSync(file, code);
