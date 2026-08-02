const service = require('../services/SheetAutomationService');

console.log("date_between:", service.checkSingleCondition({ column: 'C', operator: 'date_between', value: '2026-05-10,2026-05-20' }, { 'C': '15/05/2026' }));
console.log("is_current_month:", service.checkSingleCondition({ column: 'C', operator: 'is_current_month', value: '' }, { 'C': '15/08/2026' }));

const today = new Date();
const m = today.getMonth() + 1;
const y = today.getFullYear();
console.log(`month: ${m}, year: ${y}`);
console.log("is_current_month test:", service.checkSingleCondition({ column: 'C', operator: 'is_current_month', value: '' }, { 'C': `15/${String(m).padStart(2,'0')}/${y}` }));

