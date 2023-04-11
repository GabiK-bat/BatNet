from base.backend import GLOBALS

import exif


#TODO: unify
def process_image(imagepath, settings):
    with GLOBALS.processing_lock:
        model    = settings.models['detection']
        result   = model.process_image(imagepath)
    return result


def load_exif_datetime(filename:str) -> str:
    with open(filename, 'rb') as f:
        try:
            exif_f = exif.Image(f)
        except:
            #can fail for some weird exif formats
            print('Could not load exif')
            return
        
        if exif_f.has_exif :
            if 'datetime_original' in exif_f.list_all():
                return exif_f.datetime_original
            elif 'datetime' in exif_f.list_all():
                return exif_f.datetime
