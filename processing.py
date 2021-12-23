import os
#restrict gpu usage
os.environ["CUDA_VISIBLE_DEVICES"]=""

import glob, datetime, json
import numpy as np

import cloudpickle

import PIL.Image
import exif
import torch, torchvision
import torchvision.models.detection.anchor_utils
import onnxruntime as ort

import sys
sys.modules['tensorflow'] = 'dummy'


batdetector = None

class SETTINGS:
    active_model:str         = None
    confidence_threshold:str = 75    #percent (gui-only)
    export_boxes:bool        = False #(gui-only)

class STATE:
    training_progress:float   = None   #percentage or None (=no training)
    stop_requested:bool       = False

class CONSTANTS:
    N_EPOCHS = 10



def init(model=None):
    load_settings()
    model = model or SETTINGS.active_model
    load_model(model)

def load_model(name):
    global batdetector
    path                  = os.path.join('models', name+'.cpkl')
    print('Loading model ',path)
    batdetector = torch.load( open(path, 'rb'), map_location=torch.device('cpu') )
    print('Finished loading')
    SETTINGS.active_model = name

def load_image(path):
    return batdetector.load_image(path)

def process_image(image):
    prediction = batdetector.process_image(image)
    for i in range(len(prediction.boxes)):
        probs      =  prediction.probabilities[i]
        labels     = dict(
            (batdetector.LABELS_LIST[i].replace('_','/'), float(probs[i]) ) for i in np.argsort(probs)[::-1] if probs[i]>0.1
        )
        prediction.labels[i] = labels
        prediction.boxes[i] /= (image.size+image.size)  #normalization
    return prediction

def extract_patch(image, box):
    #image = PIL.Image.fromarray( (image*255).astype('uint8') )
    box   = np.array(box)[[1,0,3,2]]
    box   = box * np.concatenate([image.size]*2)
    crop  = image.crop(box)
    return np.array(crop) / np.float32(255)


def write_as_png(path,x):
    x = x[...,tf.newaxis] if len(x.shape)==2 else x
    x = x*255 if tf.reduce_max(x)<=1 else x
    tf.io.write_file(path, tf.image.encode_png(  tf.cast(x, tf.uint8)  ))

def write_as_jpeg(path,x):
    x = x[...,np.newaxis] if len(x.shape)==2 else x
    x = x*255 if np.max(x)<=1 else x
    x = x.astype('uint8')
    PIL.Image.fromarray(x).save(path)




def on_training_progres(p):
    STATE.training_progress = p

def training_progress():
    return STATE.training_progress

def stop_training():
    STATE.stop_requested = True
    batdetector.stop_training()

def retrain(imagefiles, jsonfiles):
    STATE.training_progress = 0
    STATE.stop_requested    = False

    batdetector.train_detector(
        imagefiles, jsonfiles, epochs=CONSTANTS.N_EPOCHS, callback=on_training_progres, num_workers=0,
    )
    batdetector.zero_grad()
    if not STATE.stop_requested:
        SETTINGS.active_model = ''
    elif SETTINGS.active_model != '':
        #reload model
        print('Training canceled. Reloading previous model.')
        load_model(SETTINGS.active_model)
    STATE.training_progress = None



def load_settings():
    settings = json.load(open('settings.json', 'r'))
    for k,v in settings.items():
        setattr(SETTINGS, k, v)

def get_settings():
    #load_settings()
    modelfiles = glob.glob('models/*.cpkl')
    modelnames = [os.path.splitext(os.path.basename(fname))[0] for fname in modelfiles]
    return {
        'models':                modelnames,
        'active_model':          SETTINGS.active_model, 
        'confidence_threshold':  SETTINGS.confidence_threshold,
        'export_boxes':          SETTINGS.export_boxes,
    }

def set_settings(newsettings):
    print('New settings: ',newsettings)
    if SETTINGS.active_model != newsettings['active_model']:
        load_model(newsettings['active_model'])
    SETTINGS.confidence_threshold = newsettings.get('confidence_threshold', 75)
    SETTINGS.export_boxes         = bool(newsettings.get('export_boxes', False))
    
    active_model = SETTINGS.active_model
    if active_model == '':
        active_model = json.load(open('settings.json')).get('active_model')
    json.dump({
        'active_model':          active_model, 
        'confidence_threshold':  SETTINGS.confidence_threshold,
        'export_boxes':          SETTINGS.export_boxes,
    }, open('settings.json','w'), indent=4)

def save_model(newname):
    batdetector.save(f'models/{newname}.cpkl')
    SETTINGS.active_model = newname


def load_exif_datetime(filename):
    with open(filename, 'rb') as f:
        exif_f = exif.Image(f)
        if exif_f.has_exif and 'datetime' in exif_f.list_all():
            return exif_f.datetime



#retraining test
if __name__ == '__main__':
    import sys
    sys.modules['tensorflow'] = 'dummy'
    model = torch.load('models/043_full.cpkl', map_location='cpu')
    

    import glob,os
    HOME = os.path.expanduser('~')
    jpgfiles  = sorted(glob.glob(HOME+'/MOUNT/nemo1/home/mag/Alexander/DATA/Bats/DATA_20200708/BOSSOW/*/*.JPG'))[:32]
    jsonfiles = sorted(glob.glob(HOME+'/MOUNT/nemo1/home/mag/Alexander/DATA/Bats/DATA_20200708/BOSSOW/*/*.json'))[:32]
    
    model.train_detector(model, jpgfiles, jsonfiles, epochs=3, callback= lambda x:print('progress:',x))

    model.init_onnx(re_export=True)

    print('***Done***')

