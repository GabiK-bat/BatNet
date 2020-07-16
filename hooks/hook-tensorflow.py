from PyInstaller.utils.hooks import collect_all


def hook(hook_api):
    packages = [
        'tensorflow',
        #'tensorflow_core',
        #'astor'
    ]
    for package in packages:
        datas, binaries, hiddenimports = collect_all(package)
        hook_api.add_datas(datas)
        hook_api.add_binaries(binaries)
        hook_api.add_imports(*hiddenimports)

    
binaries = []    

import glob
from PyInstaller.compat import is_win
if is_win:
    binaries += [('hooks/VC_redist/*', '.')]
    print("Adding binaries for tensorflow: ", binaries)
