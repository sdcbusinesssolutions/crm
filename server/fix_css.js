const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/components/admin/AdminSignupNotifications.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Box border increase to solid emerald
content = content.replace(/border border-\[\#006B4D\]\/30/g, 'border-2 border-[#006B4D]');

// 2. Input borders to solid emerald (or semi-transparent)
content = content.replace(/border border-slate-200/g, 'border-2 border-[#006B4D]/40');
content = content.replace(/border border-slate-100/g, 'border-2 border-[#006B4D]/30');

// 3. Change all text-slate-* to text-black
content = content.replace(/text-slate-\d00/g, 'text-black');

// 4. Change bg-slate-100 hover:bg-slate-200 (for the Upload button)
content = content.replace(/bg-slate-100 hover:bg-slate-200/g, 'bg-black hover:bg-gray-800 text-white');
content = content.replace(/text-slate-700 rounded-lg text-sm font-bold cursor-pointer transition-colors flex items-center justify-center border border-slate-200/g, 'text-white rounded-lg text-sm font-bold cursor-pointer transition-colors flex items-center justify-center border-2 border-black');

// 5. Change "text-[11px] font-black text-slate-500 uppercase tracking-[0.08em]" to text-black
// (Handled by #3 regex)

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replacements applied successfully!');
