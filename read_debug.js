const fs = require('fs');
const path = 'debug_output_full.txt'; // Relative to CWD
try {
    // Try reading as UTF-16LE if that's what created it
    const content = fs.readFileSync(path, 'utf16le');
    console.log(content);
} catch (err) {
    console.error('Read error:', err);
    // Fallback to utf8 just in case
    try {
        const content2 = fs.readFileSync(path, 'utf8');
        console.log(content2);
    } catch (e) { console.error(e); }
}
