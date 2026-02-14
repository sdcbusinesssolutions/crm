/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/components/Node.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Header padding: px-3 py-2 -> px-3 py-1.5
content = content.replace(/px-3 py-2 /g, 'px-3 py-1.5 ');

// 2. Input/Select padding: px-3 py-2.5 -> px-3 py-1.5
content = content.replace(/px-3 py-2.5/g, 'px-3 py-1.5');

// 3. Spacing: space-y-3 -> space-y-2
content = content.replace(/space-y-3/g, 'space-y-2');

// 4. Margins: mb-3 -> mb-2
content = content.replace(/mb-3/g, 'mb-2'); // Be careful not to replace mb-30 or similar? using \b
content = content.replace(/\bmb-3\b/g, 'mb-2');

// 5. General padding: p-3 -> p-2.5
// Use word boundary to avoid replacing others like snap-3 or something existing (unlikely, but safe)
content = content.replace(/\bp-3\b/g, 'p-2.5');

// 6. Specific list item padding: px-3 py-2.5 -> px-3 py-1.5 (already covered by #2 regex possibly, if strictly matching string)
// The regex in #2 matches "px-3 py-2.5". Let's check visually in file. 
// "px-3 py-2.5" is used in inputs. 
// Also in ListMessageNodeUI item: "px-3 py-2.5".
// Also in CheckConditionNodeUI: "px-3 py-2.5".
// So #2 covers widespread usage.

fs.writeFileSync(filePath, content, 'utf8');
console.log('Reduced vertical node height/spacing.');
