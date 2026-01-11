const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../server.js');
const tempServerPath = path.join(__dirname, '../server_temp.js');

try {
  let content = fs.readFileSync(serverPath, 'utf8');

  const injection = `
// --- INJECTED FOR SINGLE PORT TESTING ---
const path_module = require('path');
const fs = require('fs');
console.log('NOTE: Running in Single Port Mode (Serving Client from /dist)');

// Serve static files from client/dist
// We assume the client has been built to ../client/dist
app.use(express.static(path_module.join(__dirname, '../client/dist')));

// Handle client-side routing, return all requests to index.html
// This must come AFTER API routes are defined (which they are, above this block)
app.get('*', (req, res, next) => {
  // Ignore API routes and other static assets if they fell through
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  
  const indexPath = path_module.join(__dirname, '../client/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Client build not found. Did you run "npm run build" in client?');
  }
});
// ----------------------------------------
`;

  // Insert before "// --- Local Start ---"
  const marker = '// --- Local Start ---';
  if (content.includes(marker)) {
    content = content.replace(marker, injection + '\n' + marker);
    fs.writeFileSync(tempServerPath, content);
    console.log('Temporary server file created: server_temp.js');
  } else {
    console.error('Could not find injection marker "// --- Local Start ---" in server.js');
    process.exit(1);
  }
} catch (err) {
  console.error('Error generating temp server:', err);
  process.exit(1);
}
