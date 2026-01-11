/**
 * Context Manager
 * Handles variable substitution in strings using the {{variable}} syntax.
 * Example: "Hello {{trigger.name}}" -> "Hello John"
 */

class ContextManager {
    /**
     * Replaces variables in a string with values from the context.
     * @param {string} text - The text containing variables (e.g. "Hello {{name}}")
     * @param {object} context - The data object (e.g. { name: "John" })
     * @returns {string} - The text with variables replaced.
     */
    resolve(text, context) {
        if (typeof text !== 'string') return text;

        return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const trimmedPath = path.trim();

            // Handle system variables
            if (trimmedPath.startsWith('sys.')) {
                return this.resolveSystemVariable(trimmedPath) || match;
            }

            const value = this.getValueByPath(context, trimmedPath);
            if (value !== undefined) {
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(value);
                }
                return value;
            } else {
                // FALLBACK: Path Shifting Strategy
                // Finds "B.C" in "A.B.C" if "A.B.C" doesn't exist but "B" is a root variable.
                // Useful when frontend prefixes variables with Node IDs (e.g. NodeId.VarName.Prop)
                if (trimmedPath.includes('.')) {
                    const parts = trimmedPath.split('.');
                    // Try stripping 1, 2, ... N parts from the front
                    for (let i = 1; i < parts.length; i++) {
                        const subPath = parts.slice(i).join('.');
                        const subValue = this.getValueByPath(context, subPath);
                        if (subValue !== undefined) {
                            // If object, stringify
                            if (typeof subValue === 'object' && subValue !== null) {
                                return JSON.stringify(subValue);
                            }
                            return subValue;
                        }
                    }
                }

                // Debug: Log if not found
                // console.warn(`[ContextManager] Variable '${trimmedPath}' not found.`);
                // Try to find similar keys to help debugging
                if (trimmedPath.includes('response.')) {
                    const parts = trimmedPath.split('.');
                    const lastPart = parts[parts.length - 1];
                    // Search in context for keys containing lastPart
                    // This is expensive, so only do it if needed
                    // ...
                }
            }
            return match; // Keep original if not found
        });
    }

    resolveSystemVariable(path) {
        const now = new Date();
        switch (path) {
            case 'sys.currentDate': return now.toISOString().split('T')[0]; // YYYY-MM-DD
            case 'sys.currentTime': return now.toTimeString().split(' ')[0]; // HH:mm:ss
            case 'sys.currentDateTime': return now.toISOString(); // Full ISO string
            case 'sys.currentDay': return now.toLocaleDateString('en-US', { weekday: 'long' });
            case 'sys.currentMonth': return now.toLocaleDateString('en-US', { month: 'long' });
            case 'sys.currentYear': return now.getFullYear().toString();
            case 'sys.timezone': return Intl.DateTimeFormat().resolvedOptions().timeZone;
            case 'sys.unixTimestamp': return Math.floor(now.getTime() / 1000).toString();
            default: return undefined;
        }
    }

    /**
     * Resolves all string properties in an object or array.
     * @param {any} data - The object/array to resolve.
     * @param {object} context - The data context.
     * @returns {any} - The resolved object.
     */
    resolveObject(data, context) {
        if (typeof data === 'string') {
            return this.resolve(data, context);
        }
        if (Array.isArray(data)) {
            return data.map(item => this.resolveObject(item, context));
        }
        if (data !== null && typeof data === 'object') {
            const result = {};
            for (const key in data) {
                result[key] = this.resolveObject(data[key], context);
            }
            return result;
        }
        return data;
    }

    /**
     * Helper to get a nested value from an object using dot notation.
     * Supports keys with hyphens and other characters.
     * @param {object} obj - The object to search.
     * @param {string} path - The path (e.g. "trigger.contact.name" or "on-message-node.text")
     */
    getValueByPath(obj, path) {
        if (!obj || !path) return undefined;

        // Split by dot, but be careful if keys themselves contain dots (rare but possible)
        // For now, standard dot notation splitting is sufficient for our node IDs.
        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            current = current[part];
        }

        return current;
    }
}

module.exports = new ContextManager();
