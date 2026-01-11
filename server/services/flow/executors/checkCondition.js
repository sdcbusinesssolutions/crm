const contextManager = require('../context');

module.exports = {
    async execute(session, node, context) {
        console.log(`[CheckConditionExecutor] Executing node ${node.id}`);
        const { conditions } = node.data; // conditions is ConditionGroup[]

        // Need to iterate through groups (Blocks) in order
        // First match wins.
        // Each Block matches if ALL its rules match (AND) - Wait, logic says rules are sequential
        // Let's check data structure:
        // conditions: [{ id, name, rules: [{ attribute, operator, value, logicalOperator }] }]

        // Default to no match
        let matchedBlockId = null;

        if (Array.isArray(conditions)) {
            for (const group of conditions) {
                // Check if this group matches
                let groupMatch = true; // Default true, invalid if any rule fails (Handling AND/OR correctly)

                // Usually standard rule engines use:
                // Rule 1 AND Rule 2 OR Rule 3...
                // Simpler implementation: Check all rules.
                // The `logicalOperator` property is usually "Previous Rule [OP] Current Rule".
                // But the UI shows it on the rule itself.
                // Rule 1 (No OP)
                // Rule 2 (AND/OR)

                if (!group.rules || group.rules.length === 0) continue;

                // Evaluate first rule
                let currentResult = this.evaluateRule(group.rules[0], context);

                // Evaluate subsequent rules
                for (let i = 1; i < group.rules.length; i++) {
                    const rule = group.rules[i];
                    const ruleResult = this.evaluateRule(rule, context);

                    if (rule.logicalOperator === 'OR') {
                        currentResult = currentResult || ruleResult;
                    } else {
                        // Default to AND
                        currentResult = currentResult && ruleResult;
                    }
                }

                if (currentResult) {
                    console.log(`[CheckCondition] Matched Block: ${group.name} (${group.id})`);
                    matchedBlockId = group.id;
                    break; // Stop at first matching block
                }
            }
        }

        // Determine outcome
        // If matchedBlockId is found, we behave as if the user clicked that "SourceHandle".
        // If not found, we look for 'False' or 'Default' logic.
        // Usually Check Condition has a "Default" (Else) path. 
        // If the UI allows defining an "Else" block explicitly, it would be in conditions.
        // If not, we fall back to "default" handle.

        if (matchedBlockId) {
            return {
                status: 'success',
                outcome: matchedBlockId, // This will be passed as interactionId
                timestamp: new Date().toISOString()
            };
        } else {
            // If no condition matched, we try to go to the "Default" / "False" path
            // In many systems this is a dedicated "Else" socket.
            // If we return 'default', flowEngine will look for a sourceHandle='default' edge.
            console.log(`[CheckCondition] No blocks matched. Defaulting.`);
            return {
                status: 'success',
                outcome: 'default', // Or null? If null, flowEngine looks for default anyway. But 'default' is explicit.
                timestamp: new Date().toISOString()
            };
        }
    },

    evaluateRule(rule, context) {
        // Resolve Attribute (Left Side)
        // Attribute might be "Name" (simple string) or "{{trigger.name}}" (variable)
        // Or "Name" might effectively mean "{{trigger.name}}" if we map "Name" -> trigger.name
        // But the user wants "any field", so assume they provide {{variables}} or raw strings.

        let attributeVal = rule.attribute;

        // Naive check: if it looks like a variable, resolve it.
        // If it's a known shorthand like "Name" or "Phone Number", we might want to resolve it to standard paths.
        // However, standard paths depend on the flow context.
        // Let's assume if it contains {{}}, resolve it. If it matches a key in context, resolve it?
        // Or use contextManager.resolve() which handles {{}}.

        // Special case: Backwards compatibility for the dropdown strings "Name", "Phone Number", etc.
        if (attributeVal === 'Name') attributeVal = contextManager.resolve('{{trigger.name}}', context);
        else if (attributeVal === 'Phone Number') attributeVal = contextManager.resolve('{{trigger.phone}}', context);
        else if (attributeVal === 'Email') attributeVal = contextManager.resolve('{{trigger.email}}', context);
        // STRICT CHECK: If it matches explicitly {{variable}}, get the raw value (preserve null/undefined)
        else if (typeof attributeVal === 'string' && attributeVal.trim().match(/^\{\{[^}]+\}\}$/)) {
            const path = attributeVal.trim().slice(2, -2).trim();
            attributeVal = contextManager.getValueByPath(context, path);
            // If undefined, it remains undefined. Logic downstream handles it.
        } else {
            // Treat as raw string or mixed string (e.g. "User: {{name}}")
            attributeVal = contextManager.resolve(attributeVal, context);
        }

        console.log(`[CheckCondition] Resolved Rule Attribute: '${rule.attribute}' -> '${attributeVal}'`);

        // Resolve Value (Right Side)
        // Value is entered by user, likely a static string or {{variable}}.
        const targetVal = contextManager.resolve(rule.value, context);
        console.log(`[CheckCondition] Resolved Rule Value: '${rule.value}' -> '${targetVal}'`);

        return this.compare(attributeVal, rule.operator, targetVal);
    },

    compare(left, operator, right) {
        return require('../conditionUtils').robustCompare(left, operator, right);
    }
};
