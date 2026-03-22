
import json
import os

def find_number(number_to_find, path):
    encodings = ['utf-8', 'utf-16le']
    for enc in encodings:
        try:
            with open(path, 'r', encoding=enc) as f:
                data = json.load(f)
                for i, row in enumerate(data):
                    phone = (row.get('phone_number') or '').replace(' ', '').replace('+', '').replace('-', '')
                    if number_to_find in phone:
                        print(f"Index: {i}")
                        print(json.dumps(row, indent=2))
                        return
        except Exception:
            continue

find_number("9429793144", "f:/project-10/wpcode/db_whatsapp_config.json")
