const fs = require('fs');
const file = 'client/src/components/ClickToWhatsAppLauncher.tsx';
let code = fs.readFileSync(file, 'utf8');

// Find the bad snippet
const badSnippet = "currencySymbolMap[currencyCode] || '\\n                      {[10, 20, 50, 100]";
// This might not match exactly. Let's do a more robust replace.

// Let's replace the whole block correctly.
// I will just find `<span className="currency-symbol">{currencySymbolMap[currencyCode] || '`
// and ensure it is `<span className="currency-symbol">{currencySymbolMap[currencyCode] || '$'}</span>`
code = code.replace(/<span className="currency-symbol">\{currencySymbolMap\[currencyCode\] \|\| '\n\s*\{\[10, 20, 50, 100\]/g, `<span className="currency-symbol">{currencySymbolMap[currencyCode] || '$'}</span>\n                    <input \n                      type="number" \n                      className="ctwa-input with-icon"\n                      placeholder="e.g. 500" \n                      name="dailyBudget" \n                      value={formData.dailyBudget}\n                      onChange={handleChange}\n                      required \n                    />\n                  </div>\n                  <div className="ctwa-budget-presets">\n                      {[10, 20, 50, 100]`);

fs.writeFileSync(file, code);
