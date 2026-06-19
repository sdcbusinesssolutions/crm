const { URLSearchParams } = require('url');
const params = new URLSearchParams();
params.append('or', 'contact_phone.in.(+919373393645)');
console.log(params.toString());
