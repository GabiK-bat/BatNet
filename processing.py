import os
#restrict gpu usage
os.environ["CUDA_VISIBLE_DEVICES"]=""

import glob, datetime
import dill
import numpy as np
import util

import tensorflow as tf
import tensorflow.keras as keras
K = keras.backend
print('TensorFlow version: %s'%tf.__version__)
print('Keras version: %s'%keras.__version__)

import skimage.measure as skmeasure
import skimage.morphology as skmorph

batdetector = None

class SETTINGS:
    active_model = None

class STATE:
    current_training_epoch = -1

class CONSTANTS:
    N_EPOCHS = 100                                           #XXX: 5 epochs for testing only



def init():
    load_model('batdetector')
    #load_settings()

def load_model(name):
    global batdetector
    path                  = os.path.join('models', name+'.dill')
    print('Loading model ',path)
    batdetector           = dill.load(open(path, 'rb'))
    print('Finished loading')
    SETTINGS.active_model = name

def load_image(path):
    return batdetector.load_image(path)

def process_image(image):
    result = batdetector.process_image(image)
    return result

def extract_patch(image, box):
    return batdetector.extract_box(image, box)


def write_as_png(path,x):
    x = x[...,tf.newaxis] if len(x.shape)==2 else x
    x = x*255 if tf.reduce_max(x)<=1 else x
    tf.io.write_file(path, tf.image.encode_png(  tf.cast(x, tf.uint8)  ))

def write_as_jpeg(path,x):
    x = x[...,tf.newaxis] if len(x.shape)==2 else x
    x = x*255 if tf.reduce_max(x)<=1 else x
    tf.io.write_file(path, tf.image.encode_jpeg(  tf.cast(x, tf.uint8)  ))

def on_train_epoch(e):
    STATE.current_training_epoch = e

def training_progress():
    return (STATE.current_training_epoch+1)/CONSTANTS.N_EPOCHS

def stop_training():
    batdetector.stop_training()

def retrain(imagefiles, jsonfiles):
    STATE.current_training_epoch = 0
    batdetector.retrain_object_detector(imagefiles, jsonfiles, 
                                        epochs=CONSTANTS.N_EPOCHS,
                                        callback=on_train_epoch)
    SETTINGS.active_model = ''

def get_settings():
    modelfiles = glob.glob('models/*.dill')
    modelnames = [os.path.splitext(os.path.basename(fname))[0] for fname in modelfiles]
    return dict(models=modelnames, active_model=SETTINGS.active_model)

def set_settings(newsettings):
    print('New settings: ',newsettings)
    if SETTINGS.active_model!=newsettings['active_model']:
        load_model(newsettings['active_model'])

def save_model(newname):
    open(f'models/{newname}.dill', 'wb').write(dill.dumps(batdetector))
    SETTINGS.active_model = newname



if __name__=='__main__':
    import tempfile, sys, glob
    import skimage.transform as sktransform, skimage.util as skimgutil

    imgs = sorted(glob.glob('/home/AD.IGD.FRAUNHOFER.DE/gillert/Desktop/Projects/Bats/TRAINING_DATA_20191121/*/*.JPG'))[:64]
    json = sorted(glob.glob('/home/AD.IGD.FRAUNHOFER.DE/gillert/Desktop/Projects/Bats/TRAINING_DATA_20191121/*/*.json'))[:64]

    init()
    
    batdetector.retrain_object_detector(imgs, json, epochs=5)

    #tf.io.write_file('y.jpg', tf.io.encode_jpeg(y[0]*255))
