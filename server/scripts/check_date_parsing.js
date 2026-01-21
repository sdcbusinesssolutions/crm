const dateStr = '20-Jan-2026';
const d = new Date(dateStr);
console.log(`Input: ${dateStr}`);
console.log(`Parsed: ${d.toString()}`);
console.log(`Is Valid: ${!isNaN(d.getTime())}`);

const dateStr2 = '20/01/2026';
const d2 = new Date(dateStr2);
console.log(`Input: ${dateStr2}`);
console.log(`Parsed: ${d2.toString()}`);
