const http = require('http');

const data = JSON.stringify({
  rates: ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'].map(cat => ({
    scope: 'GLOBAL',
    category: cat,
    country_code: 'IN',
    meta_cost: 0.1,
    platform_rate: 0.2,
    is_active: true
  }))
});

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 5000,
  path: '/api/admin/pricing/bulk',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
