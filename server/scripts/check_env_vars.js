const path = require('path');
const dotenv = require('dotenv');
const result = dotenv.config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });

if (result.error) {
    console.log('Error loading .env:', result.error);
} else {
    console.log('.env parsed successfully.');
    console.log('Use Env Vars:', Object.keys(process.env).filter(k => k.startsWith('SUPABASE')));
}
