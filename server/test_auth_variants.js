require('dotenv').config();
const { google } = require('googleapis');
const axios = require('axios');

async function testGoogleAuth() {
    console.log('--- STARTING GOOGLE AUTH RE-VERIFICATION (Exact Code Match) ---');

    // 1. Define Credentials (simulating what comes from DB)
    const creds = {
        client_email: "sheet-apiautoamtion-service-ac@maximal-arcadia-470418-g3.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDK8FSab2olXctg\nL7eIQ0473Irxc0/0fkbGSN1Bo/MN/Lj63Hcxe+XFzhIlo0p/vlCVED3nj2C963XP\nH/sBeFoSXjU8CPcbgXXcYzdLw/xrLeOXWenI+l5XnGjFRSbl46gFMmh+50ODJJ/i\n9tCDT01PNHPBv2juVCwJn4DK9e2XHT7lkROyaxa2jDpRjehZwyrTAJK3Ixh23G/H\n1HIayCZ5Oc7W/lwTtX59WBVsBY5Lk12gZvOwBvxeQJUHo2cif0IeD1AVRxkwuWIL\nqMNYN4XDb4jMLNVCJdV3lQBshZHLI9V4Xcl2EaEi3ho4f7uiEOs83FcEZyL7vmXd\nbZC5eLDnAgMBAAECggEAYuvCOaNMeNle/MxVqKCyPmCzA53jX/i7tASpgUkS/YLu\ngi28Fg1gQ8q+ssUFV/5jVj3cBwcvL3RacTOUDTPmp+RvC4wNM8Wnt11Pg2mNnYr5\nUPndiP9txEP0GBCstMuDR8E6CX3ePUs5eo83tYIO26hkMpGEawPxkWFEDOrSvOEA\naEAp1T/cm17EyrP2ALbuX4+zsxCFkpgF8hxxQeCUGkdKXhd7SPTF3ShtqVXEtqKp\n1xUUTopxw+H4puutT8U9q3YHUN51Nrrjqn5u/tFjCcugoe3aObvtO4fBmpYtPzkF\n6CHBnGNTqUeh2F77EW1Rd8q2cfXB6IgGbq120ptFKQKBgQDzks254M5CfH4zhKMG\nzirn5f9EDhU62sDRfST0inja7X14cDdr0KUsOP/jxDbU8gJACl0+g700MomqqXR2\nfIHiy++yP/zEB64VvZZrU2osOO8AE3CWpZevghlyZAXfKAJVJ6yQmRQj7bQe8Rlp\nfhFptl049geJge7PPvjgac+d7wKBgQDVStEmUd2QfVOMNDIEPCbpY626EbTlpH5P\nYl/voJ5sCc+vbx3T1orfG34anj9vg0yF360NAGpc6t/K96BFbNoc3rirxhMCgIY4\nYkwcPCQuzHwx/EZEM0t2hT1T6E9L9ITyEE4o0qEJBVw31ohpUiIwm0+Anl56iW0P\nk0ok7eGUiQKBgQCL+FfKslo1MM9hEZ6RwZY8bxoy5JjkmmLlv7Gl6ZEr1gAdXvcq\nONtCP3slS1NrKauLW6lbzF7FCSm9beWkVUZaq3ESEN1TVUp/6dPv1x6TTSBi/cjc\neUpirDOtXbdWFurIPqVW7vD4+JdilJBS5ARjqE2H9zI7nfQ7Gmfwpj2N9wKBgA7d\n4CYjnqXrll83ZCUXbD7oS7ukcE9xX7x4xucU8vXk2S0JObMCSTuz1t5UGWfUZwkN\nxioZ1VAUrvSevfUY2TsZ6xVOARUzkCdt8pAlQQBiEGYLh3pJeQER2Gx4zM4mhP26\nVThTNhZC4WKi+W8d4nQw3yG/6CXyXj+vrINWcVrBAoGBAJDy5YyNdnnQKkhk/5T6\nY+DDmehOX3HQnFTHtIK82rCH747FN42g2ht/1PDWosZGSev+BElAfnLAlrEYH3Jr\n1rvHsI3RVK8foDyIhfP+k7zl4LBLXhFNxquUofhQFQbrw2RM6kECSfnvxJFjQaxp\n1smy0x3FrfsEqJkObsxcGgIT\n-----END PRIVATE KEY-----\n"
    };

    // 2. Format Key (Same logic as server)
    let privateKey = creds.private_key;
    if (privateKey && typeof privateKey === 'string') {
        if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
        privateKey = privateKey.replace(/^"|"$/g, '');
    }

    console.log(`Key Formatted. Length: ${privateKey.length}`);
    console.log(`Key First 20 chars: ${privateKey.substring(0, 20)}`);
    console.log(`Key includes \\n literals: ${privateKey.includes('\\n')}`);
    console.log(`Key includes real newlines: ${privateKey.includes('\n')}`);

    // --- TEST A: GoogleAuth ---
    try {
        console.log('\n--- TEST A: GoogleAuth ---');
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: creds.client_email,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const client = await auth.getClient();
        const tokenRes = await client.getAccessToken();
        const token = tokenRes.token || tokenRes;
        console.log('✅ GoogleAuth SUCCESS! Token:', token ? token.substring(0, 5) + '...' : 'NULL');
    } catch (e) {
        console.log('❌ GoogleAuth FAILED:', e.message);
    }

    // --- TEST B: Explicit JWT ---
    try {
        console.log('\n--- TEST B: Explicit JWT (Arg 2 is null) ---');
        const jwtClient = new google.auth.JWT(
            creds.client_email,
            null,
            privateKey,
            ['https://www.googleapis.com/auth/spreadsheets']
        );
        const tokens = await jwtClient.authorize();
        console.log('✅ Explicit JWT SUCCESS! Token:', tokens.access_token ? tokens.access_token.substring(0, 5) + '...' : 'NULL');
    } catch (e) {
        console.log('❌ Explicit JWT FAILED:', e.message);
    }

    // --- TEST C: Explicit JWT (Arg 2 is undefined) ---
    try {
        console.log('\n--- TEST C: Explicit JWT (Arg 2 is undefined) ---');
        // Sometimes null is treated as "use this file path which is null" -> error?
        const jwtClient = new google.auth.JWT(
            creds.client_email,
            undefined,
            privateKey,
            ['https://www.googleapis.com/auth/spreadsheets']
        );
        const tokens = await jwtClient.authorize();
        console.log('✅ Explicit JWT (undefined) SUCCESS! Token:', tokens.access_token ? tokens.access_token.substring(0, 5) + '...' : 'NULL');
    } catch (e) {
        console.log('❌ Explicit JWT (undefined) FAILED:', e.message);
    }

    // --- TEST D: fromJSON ---
    try {
        console.log('\n--- TEST D: fromJSON ---');
        const auth = google.auth.fromJSON({
            type: 'service_account',
            client_email: creds.client_email,
            private_key: privateKey
        });
        auth.scopes = ['https://www.googleapis.com/auth/spreadsheets'];
        const client = await auth.getClient();
        const res = await client.getAccessToken();
        console.log('✅ fromJSON SUCCESS! Token:', res.token ? res.token.substring(0, 5) + '...' : 'NULL');
    } catch (e) {
        console.log('❌ fromJSON FAILED:', e.message);
    }
}

testGoogleAuth();
