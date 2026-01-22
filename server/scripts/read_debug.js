const fs = require('fs');
const content = fs.readFileSync('debug_output.txt', 'utf16le');
const lines = content.split(/\r?\n/);
lines.forEach(line => {
    if (line.includes('[DEBUG]')) {
        console.log(line);
    }
});
