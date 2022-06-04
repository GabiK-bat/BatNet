from base.backend.app import App as BaseApp, get_models_path
#import backend.processing
#import backend.training

import os
import flask


class App(BaseApp):
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)

