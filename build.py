#!/bin/python
import os, shutil, sys
import datetime


build_name = '%s_BatDetector'%(datetime.datetime.now().strftime('%Y%m%d_%Hh%Mm%Ss') )
build_dir  = 'builds/%s'%build_name

os.system(f'''pyinstaller --noupx                            \
              --hidden-import=sklearn.utils._cython_blas     \
              --hidden-import=skimage.io._plugins.tifffile_plugin   \
              --additional-hooks-dir=./hooks                        \
              --distpath {build_dir}  main.py''')


shutil.copytree('HTML',   build_dir+'/HTML')
shutil.copytree('models', build_dir+'/models')
if 'linux' in sys.platform:
    os.symlink('/main/main', build_dir+'/batnet')
else:
    open(build_dir+'/main.bat', 'w').write(r'main\main.exe')
shutil.rmtree('./build')
#shutil.copyfile('settings.json', build_dir+'/settings.json')
os.remove('./main.spec')
