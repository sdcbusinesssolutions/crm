with open('src/utils/flowVariables.ts', 'r') as f:
    lines = f.readlines()
for i in range(max(0, 225-25), min(len(lines), 225)):
    print(f"{i+1}: {lines[i]}", end='')
