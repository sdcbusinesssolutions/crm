/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/components/Node.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace p-4 with p-3 (already done, but safe to run again if idempotent or if I missed some)
// My previous regex was /className="p-4 / which assumes p-4 is at start.
// Better to replace /p-4/ with /p-3/ but that's dangerous (e.g. step-4).
// Looking at the file, standard tailwind classes are space separated.
// " p-4 " is safer, or "p-4" at start of string.

// Let's target specific spacing classes that are large
content = content.replace(/space-y-4/g, 'space-y-3');
content = content.replace(/mb-4/g, 'mb-3');
content = content.replace(/mt-4/g, 'mt-3');
content = content.replace(/px-4/g, 'px-3');
// specific text inputs might use px-3 py-2.5. If I reduce px-4 to px-3, it's consistent.
// Check if "p-4" exists not at start of className (e.g. `className="w-full p-4`)
content = content.replace(/ p-4 /g, ' p-3 ');
content = content.replace(/"p-4 /g, '"p-3 '); // Start of class string
// And also "gap-4"?
content = content.replace(/gap-4/g, 'gap-3');


fs.writeFileSync(filePath, content, 'utf8');
console.log('Further reduced spacings in Node.tsx');
