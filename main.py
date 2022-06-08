from backend.app import App
from backend.cli import CLI

if __name__ == '__main__':
    ok = CLI.run()

    if not ok:
        #start UI
        App().run()

