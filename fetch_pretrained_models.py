import urllib.request, os

URLS = {
    'https://github.com/GabiK-bat/BatNet/releases/download/assets.basemodel.2022-12-13/basemodel.zip'        : 'models/detection/basemodel.pt.zip',
}

for url, destination in URLS.items():
    print(f'Downloading {url} ...')
    with urllib.request.urlopen(url) as f:
        os.makedirs( os.path.dirname(destination), exist_ok=True )
        open(destination, 'wb').write(f.read())

