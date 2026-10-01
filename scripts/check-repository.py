"""Inspect tracked and newly staged files without printing suspected secret contents."""
import re, subprocess, sys
from pathlib import Path
files = subprocess.check_output(['git','ls-files','-z']).decode().split('\0')
patterns = [r'gh[pousr]_[A-Za-z0-9]{30,}',r'github_pat_[A-Za-z0-9_]{40,}',r'sk-[A-Za-z0-9_-]{25,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r'AKIA[A-Z0-9]{16}']
violations=[]
for name in files:
    if not name: continue
    p=Path(name)
    if name=='.env' or name.startswith(('node_modules/','builds/','models/','.runtime/','.qa/')):violations.append((name,'forbidden runtime/secret path'))
    if p.stat().st_size>40*1024*1024:violations.append((name,'unexpected file above 40MB'))
    if p.suffix.lower() not in ['.md','.txt','.json','.mjs','.jsx','.cjs','.py','.ps1','.cmd','.css','.html','.yml','.yaml']:continue
    content=p.read_text(encoding='utf-8',errors='replace')
    if any(re.search(pattern,content) for pattern in patterns):violations.append((name,'possible secret signature'))
if violations:
    for name,reason in violations:print(f'FAIL {name}: {reason}')
    sys.exit(1)
print(f'PASS inspected {len(files)-1} tracked files: no secret signatures, forbidden cache/model paths or oversized files.')
