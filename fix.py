import os

files = [
    'client/src/components/ClickToWhatsAppDashboard.css',
    'client/src/components/ClickToWhatsAppDashboard.tsx',
    'client/src/components/ClickToWhatsAppAnalytics.tsx',
    'client/src/components/AdDetailPanel.tsx'
]

for f in files:
    path = os.path.join('/home/devendra/proj/wpcode', f)
    with open(path, 'r') as file:
        content = file.read()
    content = content.replace('var(--color-primary)', 'var(--color-brand)')
    with open(path, 'w') as file:
        file.write(content)
    print('Updated ' + path)
