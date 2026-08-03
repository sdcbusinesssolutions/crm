import re

with open('client/src/components/ClickToWhatsAppLauncher.tsx', 'r') as f:
    content = f.read()

# I will just write a function to do simple replacements, but it's hard to parse JSX.
