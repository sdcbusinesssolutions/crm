try {
    const express = require('express');
    const app = express();
    // mock req.user and req.staff for testing requirePermission imports if needed
    require('../server/routes/leads.js');
    console.log("SUCCESS: leads.js compiles and loads correctly!");
} catch (e) {
    console.error("FAILURE: Error importing leads.js", e);
    process.exit(1);
}
