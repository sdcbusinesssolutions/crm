const service = require('../services/SheetAutomationService');

console.log("DD/MM/YYYY:", service.parseDate("21/01/2026"));
console.log("YYYY-MM-DD:", service.parseDate("2026-01-21"));
console.log("YYYY-MM-DD (Native):", new Date("2026-01-21"));

const d = service.parseDate("2026-01-21");
console.log("Date components (Local):", d.getFullYear(), d.getMonth() + 1, d.getDate());

