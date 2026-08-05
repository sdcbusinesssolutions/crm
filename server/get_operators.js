const fs = require('fs');
const content = fs.readFileSync('services/SheetAutomationService.js', 'utf8');
const match = content.match(/if \(\['is_today'[^\]]+\]/);
if (match) console.log(match[0]);
