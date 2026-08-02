function getISTComponents(d) {
    if (!d || isNaN(d.getTime())) return null;
    const f = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric', month: 'numeric', day: 'numeric'
    });
    const parts = f.formatToParts(d);
    const p = {};
    parts.forEach(x => p[x.type] = x.value);
    return {
        year: parseInt(p.year),
        month: parseInt(p.month) - 1, // 0-based
        day: parseInt(p.day)
    };
}

const now = new Date('2026-08-02T12:00:00Z');
const istNow = getISTComponents(now);

const getRelativeIST = (offsetDays) => {
    const d = new Date(istNow.year, istNow.month, istNow.day);
    d.setDate(d.getDate() + offsetDays);
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
};

const toInt = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const istNowInt = istNow.year * 10000 + (istNow.month + 1) * 100 + istNow.day;

function check(op, valInt, targetVal) {
    if (op === 'in_last_x_days') {
        const days = parseInt(targetVal) || 0;
        const thresholdObs = getRelativeIST(-days);
        const thresholdInt = thresholdObs.year * 10000 + (thresholdObs.month + 1) * 100 + thresholdObs.day;
        return valInt >= thresholdInt && valInt <= istNowInt;
    }
    if (op === 'in_next_x_days') {
        const days = parseInt(targetVal) || 0;
        const thresholdObs = getRelativeIST(days);
        const thresholdInt = thresholdObs.year * 10000 + (thresholdObs.month + 1) * 100 + thresholdObs.day;
        return valInt >= istNowInt && valInt <= thresholdInt;
    }
}

// valInt for today: 20260802
// valInt for tomorrow: 20260803
// valInt for yesterday: 20260801

console.log("last 5 days, today (20260802):", check('in_last_x_days', 20260802, "5"));
console.log("last 5 days, yesterday (20260801):", check('in_last_x_days', 20260801, "5"));
console.log("last 5 days, tomorrow (20260803):", check('in_last_x_days', 20260803, "5"));
console.log("last 5 days, 6 days ago (20260727):", check('in_last_x_days', 20260727, "5"));
console.log("next 5 days, tomorrow (20260803):", check('in_next_x_days', 20260803, "5"));

