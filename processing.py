import os
#restrict gpu usage
os.environ["CUDA_VISIBLE_DEVICES"]=""

import glob
import dill
import numpy as np
import itertools
import util

import tensorflow as tf
import tensorflow.keras as keras
K = keras.backend
print('TensorFlow version: %s'%tf.__version__)
print('Keras version: %s'%keras.__version__)

import skimage.measure as skmeasure
import skimage.morphology as skmorph

batdetector = None

def init():
    global batdetector
    batdetector = dill.load(open('models/batdetector.dill', 'rb'))
    #load_settings()

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





if __name__=='__main__':
    fname = '/home/AD.IGD.FRAUNHOFER.DE/gillert/Desktop/Projects/Bats/SEGMENTED/Myotis dasycneme_segment/P1000221.JPG'
    bigimage                = load_image(fname)
    result                  = process_image(bigimage)
    print(result.labels)
    print(result.patches[0].shape)

    tf.io.write_file('y.jpg', tf.io.encode_jpeg(result.detectionmap[...,tf.newaxis]*255))
    #tf.io.write_file('ym.jpg', tf.io.encode_jpeg(masks[0][...,tf.newaxis]*255))
    tf.io.write_file('yp.jpg', tf.io.encode_jpeg(result.patches[0].numpy().astype(np.uint8)))


    #tf.io.write_file('y.jpg', tf.io.encode_jpeg(y[0]*255))
