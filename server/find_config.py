
import json
import os

def find_number(number_to_find):
    path = "f:/project-10/wpcode/db_whatsapp_config.json"
    if not os.path.exists(path):
        print(f"File {path} not found")
        return
    
    # Try different encodings
    encodings = ['utf-16le', 'utf-16', 'utf-8']
    
    for enc in encodings:
        try:
            with open(path, 'r', encoding=enc) as f:
                content = f.read()
                data = json.loads(content)
                for row in data:
                    phone = row.get('phone_number', '') or ''
                    if number_to_find in phone.replace(' ', '').replace('+', '').replace('-', ''):
                        print(json.dumps(row, indent=2))
                        return
            break # If success, stop trying encodings
        except Exception:
            continue

find_number("9429793144")
