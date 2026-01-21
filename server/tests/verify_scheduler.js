const SheetAutomationService = require('../services/SheetAutomationService');

console.log("--- SCHEDULER LOGIC VERIFICATION ---");

const now = new Date();
console.log(`Raw Server Time (UTC/Local): ${now.toISOString()}`);

// Re-implementing the exact logic used in SheetAutomationService.shouldRun
const getISTPart = (part) => {
    const f = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        [part]: 'numeric',
        hour12: false
    });
    return parseInt(f.format(now));
};

const istHour = getISTPart('hour');
const istMinute = getISTPart('minute');

console.log(`Scheduler Sees IST Time as: ${istHour}:${istMinute}`);

// Verification
const targetTime = `${istHour}:${istMinute}`;
console.log(`\nTEST: If you set a schedule for '${targetTime}' NOW, the system compares:`);
console.log(`   Current IST Hour (${istHour}) === Target Hour (${istHour})`);
console.log(`   Current IST Minute (${istMinute}) === Target Minute (${istMinute})`);

if (istHour === istHour && istMinute === istMinute) {
    console.log("Result: MATCH! The scheduler WOULD trigger right now.");
} else {
    console.log("Result: FAILURE.");
}
