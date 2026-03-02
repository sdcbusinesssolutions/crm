const { Client } = require('pg');

const connectionString = 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function checkDatabase() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to DB');

        // 1. Check messages for the remote number '8408907516' or with '91' prefix
        const queries = [
            `SELECT * FROM messages WHERE remote_jid LIKE '%8408907516%' ORDER BY created_at DESC LIMIT 5;`,
            `SELECT * FROM automation_logs WHERE contact_phone LIKE '%8408907516%' ORDER BY executed_at DESC LIMIT 5;`,
            `SELECT * FROM whatsapp_config WHERE phone_number LIKE '%7744903787%';`
        ];

        for (let q of queries) {
            console.log(`\n\nRunning query: ${q}`);
            const res = await client.query(q);
            console.log(`Results: ${res.rowCount}`);
            if (res.rowCount > 0) {
                console.log(JSON.stringify(res.rows, null, 2));
            }
        }

    } catch (err) {
        console.error('Error connecting to database', err);
    } finally {
        await client.end();
    }
}

checkDatabase();
