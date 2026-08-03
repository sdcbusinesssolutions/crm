const { parseISO } = require('date-fns');
try {
  parseISO(null);
} catch(e) {
  console.error("parseISO error:", e.stack);
}
