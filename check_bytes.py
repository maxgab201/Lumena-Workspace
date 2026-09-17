with open(r'C:\Users\Maxga\OneDrive\Documentos\Proyectos\Lumena-Workspace\src\stores\knowledgeStore.ts', 'rb') as f:
    content = f.read()
lines = content.split(b'\n')
for i, line in enumerate(lines):
    if i >= 173 and i <= 176:
        print(f'Line {i+1}: {line}')
        for j, b in enumerate(line):
            char = chr(b) if 32 <= b < 127 else '?'
            print(f'  Byte {j}: {b} (0x{b:02x}) = {chr(b) if 32 <= b < 127 else "?"}')