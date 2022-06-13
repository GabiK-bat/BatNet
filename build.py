#!/bin/python
import os, shutil, sys, subprocess, time

os.environ['DO_NOT_RELOAD'] = 'true'
from backend.app import App
App().recompile_static(force=True)        #make sure the static/ folder is up to date

build_name = f'{time.strftime("%Y-%m-%d_%Hh%Mm%Ss")}_BatDetector'
build_dir  = 'builds/%s'%build_name

rc = subprocess.call(f'''pyinstaller --noupx                 \
              --hidden-import=torchvision                    \
              --additional-hooks-dir=./hooks                 \
              --distpath {build_dir}  main.py''')
if rc!=0:
    print(f'PyInstaller exited with code {rc}')
    sys.exit(rc)

shutil.copytree('static', build_dir+'/static')
shutil.copytree('models', build_dir+'/models')
shutil.copyfile('species_codes.txt', build_dir+'/species_codes.txt')

if 'linux' in sys.platform:
    os.symlink('/main/main', build_dir+'/batnet')
else:
    open(build_dir+'/main.bat', 'w').write(r'main\main.exe %*'+'\npause')

shutil.rmtree('./build')
os.remove('./main.spec')
