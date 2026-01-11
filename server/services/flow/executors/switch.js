const contextManager = require('../context');

module.exports = {
    async execute(session, node, context) {
        console.log(`[SwitchExecutor] Executing node ${node.id}`);
        const { cases } = node.data; // cases is SwitchCase[]

        // Iterate through cases. First match wins.
        let matchedCaseId = null;

        if (Array.isArray(cases)) {
            for (const caseItem of cases) {
                // Each case has a SINGLE condition rule for now
                const rule = caseItem.condition;

                if (this.evaluateRule(rule, context)) {
                    console.log(`[Switch] Matched Case: ${caseItem.label} (${caseItem.id})`);
                    matchedCaseId = caseItem.id;
                    break; // Stop at first match
                }
            }
        }

        if (matchedCaseId) {
            return {
                status: 'success',
                outcome: matchedCaseId, // This will be passed as interactionId (Source Handle)
                timestamp: new Date().toISOString()
            };
        } else {
            console.log(`[Switch] No cases matched. Defaulting.`);
            return {
                status: 'success',
                outcome: 'default', // Fallback to 'default' handle
                timestamp: new Date().toISOString()
            };
        }
    },

    evaluateRule(rule, context) {
        // Resolve Attribute (Left Side)
        let attributeVal = rule.attribute;

        // Special case: Backwards compatibility (though likely not needed for new Switch node)
        if (attributeVal === 'Name') attributeVal = contextManager.resolve('{{trigger.name}}', context);
        else if (attributeVal === 'Phone Number') attributeVal = contextManager.resolve('{{trigger.phone}}', context);
        else if (attributeVal === 'Email') attributeVal = contextManager.resolve('{{trigger.email}}', context);
        else {
            attributeVal = contextManager.resolve(attributeVal, context);
        }

        console.log(`[Switch] Resolved Rule Attribute: '${rule.attribute}' -> '${attributeVal}'`);

        // Resolve Value (Right Side)
        const targetVal = contextManager.resolve(rule.value, context);
        console.log(`[Switch] Resolved Rule Value: '${rule.value}' -> '${targetVal}'`);

        return this.compare(attributeVal, rule.operator, targetVal);
    },

    compare(left, operator, right) {
        return require('../conditionUtils').robustCompare(left, operator, right);
    }
};
