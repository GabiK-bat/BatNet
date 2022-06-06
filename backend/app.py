from base.backend.app import App as BaseApp, get_models_path
#import backend.processing
#import backend.training

import os
import flask
import numpy as np


class App(BaseApp):
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)


    #TODO: unify
    #override
    def process_image(self, imagename):
        full_path = os.path.join(self.cache_path, imagename)
        if not os.path.exists(full_path):
            flask.abort(404)
        
        print(f'Processing image with model {self.settings.active_models["detection"]}')
        model  = self.settings.models['detection']
        result = model.process_image(full_path)

        labels = [ dict(zip( model.class_list, p )) for p in result.probabilities.tolist() ]      #TODO: move into models src
        return flask.jsonify({
            'labels':    labels,
            'boxes':     np.array(result.boxes).tolist()
            #'datetime':  processing.load_exif_datetime(fullpath),                                #TODO
        })
