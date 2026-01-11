/**
 * Helper to flatten nested objects for easier variable access
 * 
 * @param {Object} obj - The object to flatten
 * @param {Object} result - The accumulator object (optional)
 * @returns {Object} - The flattened object
 */
function flattenObject(obj, result = {}) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            // 1. Copy original key
            result[key] = obj[key];

            // 2. Generate simplified key (strip screen_xxxxx_)
            // Example: screen_xotyyv_question_zrqqvc -> question_zrqqvc
            if (key.startsWith('screen_')) {
                const parts = key.split('_');
                // parts[0] = screen, parts[1] = id, parts[2...] = rest
                if (parts.length >= 3) {
                    const simplifiedKey = parts.slice(2).join('_');
                    if (!result[simplifiedKey]) {
                        result[simplifiedKey] = obj[key];
                    }

                    // 2.1. Handle keys with trailing indices (e.g. TASK_NAME_0 -> TASK_NAME)
                    // This is common in some Flow Builders where unique IDs are appended
                    const lastUnderscoreIndex = simplifiedKey.lastIndexOf('_');
                    if (lastUnderscoreIndex > 0) {
                        const suffix = simplifiedKey.substring(lastUnderscoreIndex + 1);
                        // Check if suffix is a number
                        if (!isNaN(parseInt(suffix)) && isFinite(suffix)) {
                            const keyWithoutIndex = simplifiedKey.substring(0, lastUnderscoreIndex);
                            // Only add if not already present (prioritize first occurrence or explicit name)
                            if (!result[keyWithoutIndex]) {
                                result[keyWithoutIndex] = obj[key];
                            }
                        }
                    }
                }
            }

            // 3. Recurse if object
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                flattenObject(obj[key], result);
            }
        }
    }
    return result;
}

/**
 * Flattens a JSON object into dot-notation keys, supporting arrays.
 * Example: { a: [{ b: 1 }] } -> { "a": [...], "a.0": {...}, "a.0.b": 1 }
 */
function flattenJSON(obj, prefix = '', result = {}) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const val = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            result[newKey] = val;

            if (typeof val === 'object' && val !== null) {
                flattenJSON(val, newKey, result);
            }
        }
    }
    return result;
}

module.exports = {
    flattenObject,
    flattenJSON
};
