// If Socket.IO is unreliable for 1000 users, maybe the 800ms delay in inbox.js is just not enough.
// A common WhatsApp delay is 2-3 seconds for delivery.
// If we increase the delay to 2500ms, it gives webhooks plenty of time to arrive.
// This is a reliable fallback for users with broken Socket.IO.
const fs = require('fs');
const path = require('path');

const inboxJsPath = path.join(__dirname, 'server/routes/inbox.js');
let inboxJs = fs.readFileSync(inboxJsPath, 'utf8');

inboxJs = inboxJs.replace(
    /await new Promise\(resolve => setTimeout\(resolve, 800\)\);/g,
    "await new Promise(resolve => setTimeout(resolve, 2500));"
);

fs.writeFileSync(inboxJsPath, inboxJs);
console.log("inbox.js updated to 2500ms delay.");
