const contextManager = require('./context');

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

function isStrictNumber(val) {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    return !isNaN(num);
}

function isEmpty(val) {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string' && val.trim() === '') return true;
    if (Array.isArray(val) && val.length === 0) return true;
    if (typeof val === 'object' && Object.keys(val).length === 0) return true;
    return false;
}

function robustCompare(left, operator, right) {
    // Basic existence checks first (no need to resolve right side often)
    if (operator === 'exists') return left != null && left != undefined;
    if (operator === 'does not exist') return left == null || left == undefined;
    if (operator === 'is empty') return isEmpty(left);
    if (operator === 'is not empty') return !isEmpty(left);

    // 1. Equality Aliases
    if (operator === 'is equal to') operator = 'is';
    if (operator === 'is not equal to') operator = 'is not';

    // 2. Handle Null/Undefined/Empty for Equality
    if (operator === 'is not') {
        if (left == null && right != null) return true;
        if (left != null && right == null) return true;
        if (left === '' && right !== '') return true;
        if (left !== '' && right === '') return true;
    }

    if (operator === 'is') {
        if (left == right) return true;
    }

    // Normalized Strings for fallback
    const lStr = (left !== undefined && left !== null) ? String(left).toLowerCase() : '';
    const rStr = (right !== undefined && right !== null) ? String(right).toLowerCase() : '';

    // 3. Type Detection for Ordered Comparisons (>, <, >=, <=)
    const lIsNum = isStrictNumber(left);
    const rIsNum = isStrictNumber(right);
    const areBothNumbers = lIsNum && rIsNum;

    let lDate = null;
    let rDate = null;
    let areBothDates = false;

    if (!areBothNumbers) {
        lDate = parseDate(left);
        rDate = parseDate(right);
        areBothDates = lDate && rDate;
    }

    // Helper for comparison
    const compareEntities = (op) => {
        if (areBothNumbers) {
            return op(Number(left), Number(right));
        }
        if (areBothDates) {
            return op(lDate.getTime(), rDate.getTime());
        }
        return op(lStr, rStr);
    };

    switch (operator) {
        case 'is':
            return lStr === rStr;

        case 'is not':
            return lStr !== rStr;

        case 'contains':
            return lStr.includes(rStr);

        case 'does not contain':
            return !lStr.includes(rStr);

        case 'starts with':
            return lStr.startsWith(rStr);

        case 'does not start with':
            return !lStr.startsWith(rStr);

        case 'ends with':
            return lStr.endsWith(rStr);

        case 'does not end with':
            return !lStr.endsWith(rStr);

        case 'matches regex':
            try {
                return new RegExp(right).test(left); // Case-sensitive regex usually expected? Or use flags? User likely types regex pattern.
                // If user wants case insensitive they can add flags if we support it, but JS RegExp("pattern") doesn't take flags in 1st arg easily if string.
                // Let's assume standard regex.
            } catch (e) {
                console.warn('Invalid Regex:', right);
                return false;
            }

        case 'does not match regex':
            try {
                return !new RegExp(right).test(left);
            } catch (e) {
                return true; // If invalid regex, arguably it "does not match".
            }

        case 'greater than':
        case '>':
            return compareEntities((a, b) => a > b);

        case 'less than':
        case '<':
            return compareEntities((a, b) => a < b);

        case 'greater than or equal to':
        case '>=':
            return compareEntities((a, b) => a >= b);

        case 'less than or equal to':
        case '<=':
            return compareEntities((a, b) => a <= b);

        default:
            return false;
    }
}

module.exports = {
    robustCompare
};
