const fs = require('fs');

const path = 'client/src/components/ClickToWhatsAppLauncher.tsx';
let content = fs.readFileSync(path, 'utf8');

// The easiest way is to find index of markers.
const step1_start = content.indexOf('{currentStep === 1 && (');
if (step1_start === -1) { console.error("Step 1 not found"); process.exit(1); }

// Extract Ad Account block to keep it in Step 1
const fbPageStart = content.indexOf('<div className="ctwa-form-group">\n                    <label><span className="icon" style={{ background: \'transparent\' }}>');
const fbPageEnd = content.indexOf('</div>\n                </div>\n\n                {/* Row 2: Campaign Name + Headline */}');
const fbPageHtml = content.substring(fbPageStart, fbPageEnd);
content = content.substring(0, fbPageStart) + content.substring(fbPageEnd);

// Extract Headline
const headlineStart = content.indexOf('<div className="ctwa-form-group">\n                    <label style={{ display: \'flex\', alignItems: \'center\', gap: \'6px\' }}>\n                      <span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4v3h5.5v12h3V7H19V4H5z"/></svg></span> \n                      Headline');
const headlineEnd = content.indexOf('</div>\n                </div>\n\n                {/* Merged Row 2.5 and 3 into 2-Column Grid */}');
const headlineHtml = content.substring(headlineStart, headlineEnd);
content = content.substring(0, headlineStart) + content.substring(headlineEnd);

// Extract WhatsApp Number
const waNumStart = content.indexOf('<div className="ctwa-form-group">\n                      <label style={{ display: \'flex\', alignItems: \'center\', gap: \'6px\' }}>\n                        <span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 14c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1-.2.2-.7.8-.8 1-.1.2-.3.2-.5.1-.2-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.8-.2-.2 0-.3.1-.4.1-.1.2-.2.3-.3.1-.1.2-.2.2-.4 0-.1 0-.3-.1-.4-.1-.2-.6-1.5-.9-2-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.3c.2.3 2.2 3.4 5.3 4.7 2.1.9 2.9 1 3.9.9 1 0 3.2-1.3 3.6-2.5.4-1.2.4-2.2.3-2.5-.2-.1-.4-.2-.7-.3z"/></svg></span> \n                        WhatsApp Number (Optional)');
const waNumEnd = content.indexOf('</div>\n\n                  </div>\n\n                  {/* RIGHT COLUMN */}');
const waNumHtml = content.substring(waNumStart, waNumEnd);
content = content.substring(0, waNumStart) + content.substring(waNumEnd);

// Extract Ad Media
const mediaStart = content.indexOf('<div className="ctwa-form-group" style={{ marginBottom: 0 }}>\n                      <label><span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></span> Ad Media</label>');
const mediaEnd = content.indexOf('</div>\n\n                  </div>\n                </div>\n                {/* Row 4: Primary Text + Ad Description */}');
const mediaHtml = content.substring(mediaStart, mediaEnd);
content = content.substring(0, mediaStart) + content.substring(mediaEnd);

// Extract Text and Status rows
const textRowsStart = content.indexOf('{/* Row 4: Primary Text + Ad Description */}');
const textRowsEnd = content.indexOf('</div>\n            )}\n\n            {currentStep === 3 && (');
const textRowsHtml = content.substring(textRowsStart, textRowsEnd);
content = content.substring(0, textRowsStart) + content.substring(textRowsEnd);


// Inject into Step 2
const step2Start = content.indexOf('{currentStep === 2 && (\n              <div className="ctwa-step-content">');
const step2InjectPoint = step2Start + '{currentStep === 2 && (\n              <div className="ctwa-step-content">'.length;

const adSetInjection = `
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Ad Set Name</label>
                    <input 
                      type="text" 
                      name="adSetName" 
                      placeholder="Enter Ad Set name"
                      value={formData.adSetName}
                      onChange={handleChange}
                      required 
                    />
                  </div>
${fbPageHtml}
                </div>
                <div className="ctwa-form-row">
${waNumHtml}
                </div>
`;
content = content.substring(0, step2InjectPoint) + adSetInjection + content.substring(step2InjectPoint);

// Replace Step 4 with Ad View
const summaryStart = content.indexOf('{currentStep === 4 && (');
const summaryEnd = content.indexOf('{currentStep === 5 && (');

const adView = `{currentStep === 4 && (
              <div className="ctwa-step-content">
                <div className="ctwa-form-row">
                  <div className="ctwa-form-group">
                    <label>Ad Name</label>
                    <input 
                      type="text" 
                      name="adName" 
                      placeholder="Enter Ad name"
                      value={formData.adName}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
${headlineHtml}
${mediaHtml}
${textRowsHtml}
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
`;
content = content.substring(0, summaryStart) + adView + content.substring(summaryEnd);


// Move Budget to Step 1
const budgetStart = content.indexOf('{currentStep === 3 && (\n              <div className="ctwa-step-content">');
const budgetEnd = content.indexOf('</div>\n            )}\n\n            {currentStep === 4 && (');
const budgetContent = content.substring(budgetStart + '{currentStep === 3 && (\n              <div className="ctwa-step-content">'.length, budgetEnd);

content = content.substring(0, budgetStart) + content.substring(budgetEnd + '</div>\n            )}\n\n'.length);

const step1End = content.indexOf('</div>\n            )}\n\n            {currentStep === 2 && (');
content = content.substring(0, step1End) + budgetContent + content.substring(step1End);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully extracted JSX fields");
