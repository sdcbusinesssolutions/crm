
import json
import os

def find_number(number_to_find, path):
    if not os.path.exists(path):
        return None
    
    encodings = ['utf-8', 'utf-16le']
    for enc in encodings:
        try:
            with open(path, 'r', encoding=enc) as f:
                data = json.load(f)
                if isinstance(data, list):
                    for row in data:
                        phone = row.get('phone_number', '') or ''
                        if number_to_find in phone.replace(' ', '').replace('+', '').replace('-', ''):
                            return row
                elif isinstance(data, dict):
                     # Maybe a dict of configs
                     for k, v in data.items():
                         phone = v.get('phone_number', '') or ''
                         if number_to_find in phone.replace(' ', '').replace('+', '').replace('-', ''):
                            return v
        except Exception:
            continue
    return None

files = ["f:/project-10/wpcode/db_whatsapp_config.json", "f:/project-10/wpcode/server/temp_configs.json", "f:/project-10/wpcode/temp_config_dump.json"]
for f in files:
    res = find_number("9429793144", f)
    if res:
        print(json.dumps(res, indent=2))
        break
