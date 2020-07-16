# -----------------------------------------------------------------------------
# Copyright (c) 2013-2019, PyInstaller Development Team.
#
# Distributed under the terms of the GNU General Public License with exception
# for distributing bootloader.
#
# The full license is in the file COPYING.txt, distributed with this software.
# -----------------------------------------------------------------------------

import os
import glob
from PyInstaller.utils.hooks import get_module_file_attribute
from PyInstaller.compat import is_win

binaries = []

# package the DLL bundle that official scipy wheels for Windows ship
# The DLL bundle will either be in extra-dll on windows proper
# and in .libs if installed on a virtualenv created from MinGW (Git-Bash
# for example)
if is_win:
    extra_dll_locations = ['extra-dll', '.libs']
    for location in extra_dll_locations:
        dll_glob = os.path.join(os.path.dirname(
            get_module_file_attribute('scipy')), location, "*.dll")
        if glob.glob(dll_glob):
            binaries.append((dll_glob, "."))
            print('*'*40)
            print(binaries)
            print('*'*40)

# collect library-wide utility extension modules
hiddenimports = ['scipy._lib.%s' % m for m in [
    'messagestream', "_ccallback_c", "_fpumode"]]
