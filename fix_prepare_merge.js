const fs = require('fs');
const file = 'prepare_upload.sh';
let content = fs.readFileSync(file, 'utf8');

const regex = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [a-f0-9]+/;
const match = content.match(regex);

if (match) {
    const headCode = match[1];
    const incomingCode = match[2];
    // Take incoming code because it's newer automated process
    content = content.replace(regex, incomingCode);
}
fs.writeFileSync(file, content);
console.log('Merged prepare_upload.sh');
