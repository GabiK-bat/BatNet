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



#zip full + zip as update + TODO: upload
import argparse, glob, zipfile
parser = argparse.ArgumentParser()
parser.add_argument('--zip', action='store_true')
args = parser.parse_args()

if args.zip:
    shutil.rmtree(build_dir+'/cache', ignore_errors=True)

    print('Zipping update package...')
    files_to_zip  = []
    files_to_zip += [os.path.join(build_dir, 'main', 'main.exe')]
    files_to_zip += glob.glob(os.path.join(build_dir, 'static/**'), recursive=True)
    with zipfile.ZipFile(build_dir+'.update.zip', 'w') as archive:
        for f in files_to_zip:
            archive.write(f, f.replace(build_dir, ''))

    print('Zipping full package...')
    shutil.make_archive(build_dir, "zip", build_dir)


print('Done')
