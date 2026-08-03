import re

with open('client/src/components/SheetAutomation/SheetAutomationWizard.tsx', 'r') as f:
    content = f.read()

with open('step3_ui.txt', 'r') as f:
    new_step3 = f.read()

# Replace Step 3 block
pattern = r'\{/\* STEP 3: TRIGGER \*/\}.*?(?=\{/\* STEP 4: MESSAGE \*/\})'
new_content = re.sub(pattern, new_step3, content, flags=re.DOTALL)

# Chunk 1
new_content = new_content.replace(
    "triggers: [{ column: '', operator: 'equals', value: '' }] as { column: string, operator: string, value: string }[],",
    "triggerGroups: [{ id: 'group-1', conditions: [{ column: '', operator: 'equals', value: '' }] }] as any[],"
)

# Chunk 2
old_chunk2 = """            recurring: sched.recurring || false,
            triggers: data.trigger_condition || [],"""
new_chunk2 = """            recurring: sched.recurring || false,
            triggerGroups: (() => {
                if (data.trigger_condition?.logic === 'OR' && Array.isArray(data.trigger_condition.groups)) {
                    return data.trigger_condition.groups;
                }
                if (Array.isArray(data.trigger_condition)) {
                    return [{ id: 'group-legacy', conditions: data.trigger_condition }];
                }
                if (data.trigger_condition) {
                    return [{ id: 'group-legacy', conditions: [data.trigger_condition] }];
                }
                return [{ id: 'group-1', conditions: [{ column: '', operator: 'equals', value: '' }] }];
            })(),"""
new_content = new_content.replace(old_chunk2, new_chunk2)

# Chunk 3
old_chunk3 = """        if (step === 3) {
            if (formData.triggers.length === 0) return alert('Please add at least one trigger condition');
            const invalidInfo = formData.triggers.find(t => !t.column || !t.operator);
            if (invalidInfo) return alert('Please complete all trigger conditions (Column and Operator are required)');
        }"""
new_chunk3 = """        if (step === 3) {
            if (!formData.triggerGroups || formData.triggerGroups.length === 0) return alert('Please add at least one trigger condition group');
            const invalidInfo = formData.triggerGroups.some((g: any) => g.conditions.find((t: any) => !t.column || !t.operator));
            if (invalidInfo) return alert('Please complete all trigger conditions (Column and Operator are required)');
        }"""
new_content = new_content.replace(old_chunk3, new_chunk3)

# Chunk 4
old_chunk4 = """            trigger_condition: formData.triggers, // Send array directly"""
new_chunk4 = """            trigger_condition: {
                logic: 'OR',
                groups: formData.triggerGroups
            }, // Advanced Logic Support"""
new_content = new_content.replace(old_chunk4, new_chunk4)


with open('client/src/components/SheetAutomation/SheetAutomationWizard.tsx', 'w') as f:
    f.write(new_content)

print("Replacement successful")
