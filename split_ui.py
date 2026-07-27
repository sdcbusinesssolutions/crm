import re
import sys

def main():
    file_path = 'client/src/components/ClickToWhatsAppLauncher.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Change the first condition to just `currentStep === 1`
    content = content.replace('{(currentStep === 1 || currentStep === 3) && (', '{currentStep === 1 && (')

    # 2. Extract Facebook Page to Step 2
    fb_page_start = content.find('<div className="ctwa-form-group">\n                    <label><span className="icon" style={{ background: \'transparent\' }}>')
    fb_page_end = content.find('</div>\n                </div>\n\n                {/* Row 2: Campaign Name + Headline */}')
    fb_page_html = content[fb_page_start:fb_page_end]
    content = content[:fb_page_start] + content[fb_page_end:]

    # Extract Headline
    headline_start = content.find('<div className="ctwa-form-group">\n                    <label style={{ display: \'flex\', alignItems: \'center\', gap: \'6px\' }}>\n                      <span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4v3h5.5v12h3V7H19V4H5z"/></svg></span> \n                      Headline')
    headline_end = content.find('</div>\n                </div>\n\n                {/* Merged Row 2.5 and 3 into 2-Column Grid */}')
    headline_html = content[headline_start:headline_end]
    content = content[:headline_start] + content[headline_end:]

    # Extract WhatsApp Number
    wa_num_start = content.find('<div className="ctwa-form-group">\n                      <label style={{ display: \'flex\', alignItems: \'center\', gap: \'6px\' }}>\n                        <span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 14c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1-.2.2-.7.8-.8 1-.1.2-.3.2-.5.1-.2-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.8-.2-.2 0-.3.1-.4.1-.1.2-.2.3-.3.1-.1.2-.2.2-.4 0-.1 0-.3-.1-.4-.1-.2-.6-1.5-.9-2-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.3c.2.3 2.2 3.4 5.3 4.7 2.1.9 2.9 1 3.9.9 1 0 3.2-1.3 3.6-2.5.4-1.2.4-2.2.3-2.5-.2-.1-.4-.2-.7-.3z"/></svg></span> \n                        WhatsApp Number (Optional)')
    wa_num_end = content.find('</div>\n\n                  </div>\n\n                  {/* RIGHT COLUMN */}')
    wa_num_html = content[wa_num_start:wa_num_end]
    content = content[:wa_num_start] + content[wa_num_end:]

    # Extract Ad Media
    media_start = content.find('<div className="ctwa-form-group" style={{ marginBottom: 0 }}>\n                      <label><span className="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></span> Ad Media</label>')
    media_end = content.find('</div>\n\n                  </div>\n                </div>\n                {/* Row 4: Primary Text + Ad Description */}')
    media_html = content[media_start:media_end]
    content = content[:media_start] + content[media_end:]

    # Extract Row 4 (Primary Text + Ad Description) and Row 5 (Ad Status + Welcome Message + Ice Breaker)
    text_rows_start = content.find('{/* Row 4: Primary Text + Ad Description */}')
    text_rows_end = content.find('</div>\n            )}\n\n            {currentStep === 3 && (')
    text_rows_html = content[text_rows_start:text_rows_end]
    content = content[:text_rows_start] + content[text_rows_end:]

    # Now, inject Ad Set fields to Step 2
    step_2_start = content.find('{currentStep === 2 && (\n              <div className="ctwa-step-content">')
    injection_point = step_2_start + len('{currentStep === 2 && (\n              <div className="ctwa-step-content">')
    
    ad_set_injection = """
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
""" + fb_page_html + """
                </div>
                <div className="ctwa-form-row">
""" + wa_num_html + """
                </div>
"""
    content = content[:injection_point] + ad_set_injection + content[injection_point:]

    # Inject Ad fields into Step 4
    # Wait, Step 4 exists but it's the Summary. I'll replace Step 4 (Summary) with Ad View!
    # Or just replace the whole currentStep === 4 block.
    summary_start = content.find('{currentStep === 4 && (')
    summary_end = content.find('{currentStep === 5 && (')
    
    ad_view = """{currentStep === 4 && (
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
""" + headline_html + "\n" + media_html + "\n" + text_rows_html + """
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
"""
    content = content[:summary_start] + ad_view + content[summary_end:]

    # Move Budget logic
    # Right now Budget is currentStep === 3.
    # User wants: CBO in Campaign (Step 1), ABO in Ad Set (Step 2).
    # Since they are tied, it's easier to put the CBO/ABO selector in Step 1, and the Daily Budget input in BOTH conditionally!
    # Let's extract currentStep === 3
    budget_start = content.find('{currentStep === 3 && (\n              <div className="ctwa-step-content">')
    budget_end = content.find('</div>\n            )}\n\n            {currentStep === 4 && (')
    budget_html = content[budget_start + len('{currentStep === 3 && (\n              <div className="ctwa-step-content">') : budget_end]
    content = content[:budget_start] + content[budget_end + len('</div>\n            )}\n\n'):] # removing step 3 entirely
    
    # Inject budget_html into the end of Step 1
    step_1_end = content.find('</div>\n            )}\n\n            {currentStep === 2 && (')
    content = content[:step_1_end] + budget_html + content[step_1_end:]

    # Write back
    with open(file_path, 'w') as f:
        f.write(content)

    print("Success")

if __name__ == '__main__':
    main()
