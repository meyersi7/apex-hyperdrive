"""Baut dist/index.html: setzt alle Dateien aus src/js (alphabetisch) in src/shell.html ein."""
import glob, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
shell = open(f'{root}/src/shell.html', encoding='utf-8').read()
js = '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(f'{root}/src/js/*.js')))
out = shell.replace('/*__GAME_JS__*/', js)
os.makedirs(f'{root}/dist', exist_ok=True)
open(f'{root}/dist/index.html', 'w', encoding='utf-8').write(out)
print('built', len(out), 'bytes')
