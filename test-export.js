const http = require('http');
// Just test syntax of contacts.js
try {
  require('./server/routes/contacts.js');
  console.log("Syntax is OK");
} catch(e) {
  console.error("Syntax Error:", e);
}
