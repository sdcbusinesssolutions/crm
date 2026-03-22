
import os

path = "f:/project-10/wpcode/server/token.txt"
if os.path.exists(path):
    with open(path, 'r', encoding='utf-16le') as f:
        content = f.read()
        print(f"LEN={len(content)}")
        for i in range(0, len(content), 50):
            print(content[i:i+50])
