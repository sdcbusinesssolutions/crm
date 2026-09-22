import re

with open('src/utils/flowVariables.ts', 'r') as f:
    lines = f.readlines()

nodes_to_remove = ['NewLead', 'TaskReminder', 'PipelineTrigger', 'SheetTrigger', 'SetWebhook', 'Gmail', 'Smtp', 'Calendar']

# Remove arrays like [NodeType.X]: [ ... ],
to_delete = []
i = 0
while i < len(lines):
    line = lines[i]
    matched = False
    for node in nodes_to_remove:
        if line.strip().startswith(f'[NodeType.{node}]:'):
            matched = True
            break
    
    if matched:
        start_idx = i
        end_idx = i
        # find closing bracket
        for j in range(i, len(lines)):
            if '],' in lines[j] or ']' in lines[j]:
                if lines[j].strip() == '],' or lines[j].strip() == ']':
                    end_idx = j
                    break
        to_delete.append((start_idx, end_idx+1))
        i = end_idx + 1
    else:
        i += 1

to_delete.sort(reverse=True)
for start, end in to_delete:
    del lines[start:end]

# Remove if statements or cases:
# if (node.type === NodeType.X ...)
for i in range(len(lines)):
    for node in nodes_to_remove:
        if f'node.type === NodeType.{node}' in lines[i]:
            lines[i] = ''

with open('src/utils/flowVariables.ts', 'w') as f:
    f.writelines(lines)

