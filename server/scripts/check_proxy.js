require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });

console.log('--- ENV VAR CHECK ---');
console.log('HTTP_PROXY:', process.env.HTTP_PROXY);
console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY);
console.log('http_proxy:', process.env.http_proxy);
console.log('https_proxy:', process.env.https_proxy);
console.log('npm_config_proxy:', process.env.npm_config_proxy);
console.log('npm_config_https_proxy:', process.env.npm_config_https_proxy);
console.log('ALL_PROXY:', process.env.ALL_PROXY);
