import os
#restrict gpu usage
os.environ["CUDA_VISIBLE_DEVICES"]=""

import glob
import numpy as np
import itertools

import tensorflow as tf
import tensorflow.keras as keras
K = keras.backend
print('TensorFlow version: %s'%tf.__version__)
print('Keras version: %s'%keras.__version__)

import skimage.measure as skmeasure
import skimage.morphology as skmorph


RESIZE_FACTOR = 1/8  #TODO: hard-coded
PATCHSIZE     = 192
LABELS_LIST   =['', 'Barbastella barbastellus', 'Eptesicus serotinus',
                'Myotis bechsteinii', 'Myotis dasycneme', 'Myotis daubentonii',
                'Myotis emarginatus', 'Myotis myotis_Myotis blythii',
                'Myotis mystacinus_Myotis brandtii_Myotis alcathoe',
                'Myotis nattereri', 'Nyctalus noctula', 'Pipistrellus sp.',
                'Plecotus auritus_Plecotus austriacus','Rhinolophus ferrumequinum',
                'Rhinolophus sp.']


K.clear_session()
detection_model       = keras.models.load_model('models/20200117_11h0459s_028c_bat_detect_best_model.h5')
segmentation_model    = keras.models.load_model('models/20200118_12h1400s_028d_bat_patch_segment_best_model.h5')
batnotbat_model       = keras.models.load_model('models/20200122_14h0840s_028f_batnotbat_classify_best_model.h5')
classification_models = [ keras.models.load_model('models/20200122_12h5208s_028e_bat_segmented_classify_best_model.h5'),
                          keras.models.load_model('models/20200122_12h1123s_028e_bat_segmented_classify_best_model.h5'),
                          keras.models.load_model('models/20200122_10h1640s_028e_bat_segmented_classify_best_model.h5'),
                        ]



def load_image(path):
    return tf.io.decode_image( tf.io.read_file(path) )#[...,::-1]

def resize_image_for_detection(image, scale=RESIZE_FACTOR):
    return tf.image.resize(image, np.array(image.shape[:2])*RESIZE_FACTOR)

def encode_as_jpeg(x):
    return tf.io.encode_jpeg(x[0]*255).numpy()

def write_as_png(path,x):
    x = x[0] if len(x.shape)==4 else x
    x = x[...,tf.newaxis] if len(x.shape)==2 else x
    x = x*255 if tf.reduce_max(x)<=1 else x
    tf.io.write_file(path, tf.image.encode_png(  tf.cast(x, tf.uint8)  ))




def sanitize_patch_center(p, patchsize, imageshape):
    return np.minimum(np.maximum(p, patchsize/2), np.array(imageshape[:2])-patchsize/2)

def detect(image, model):
    seg    = model.predict( np.stack([image, image[:,::-1]],axis=0)*1.0 )
    seg[1] = seg[1,:,::-1]
    rawseg = seg.mean(axis=0).squeeze()
    seg    = rawseg > 0.1
    seg    = skmorph.binary_opening(seg, skmorph.disk(2))
    seg    = skmorph.dilation(seg, skmorph.disk(4))
    regs   = skmeasure.regionprops( skmeasure.label(seg).astype(np.uint8) )
    regcentroids = np.array([reg.centroid for reg in regs])
    return rawseg, regcentroids


def segment(bigimage, smallimage, model, center, glimpsesize):
    patch        = tf.image.extract_glimpse(smallimage[tf.newaxis], [glimpsesize,glimpsesize],
                                            [center], False, False)[0]
    segmentation = model.predict( tf.stack([patch, patch[:,::-1]],axis=0) )
    segmentation[1] = segmentation[1,:,::-1]
    segmentation = segmentation.mean(axis=0).squeeze()
    mask         = segmentation
    mask         = tf.image.resize(mask[...,tf.newaxis]*1, (np.array(mask.shape)/RESIZE_FACTOR).astype(int) ).numpy().squeeze()
    mask         = mask > 0.5

    top,left     = (center/RESIZE_FACTOR - np.array(mask.shape)/2).astype(int)
    imageshape   = bigimage.shape[:2]
    imagemask    = np.zeros(imageshape, np.float32)
    imagemask[top:, left:][:mask.shape[0], :mask.shape[1]] = mask
    return imagemask

def L2(a, b):
    '''L2 (euclidian) distance between parameters a and b'''
    return np.sum(( np.reshape(a, (-1,2)) - np.reshape(b, (-1,2)) )**2, axis=-1).squeeze()**0.5

def filter_close(points, extras, thresold=30):
    distance_matrix = np.array([L2(p,points) for p in points])
    ignore_idcs     = np.argwhere((distance_matrix + np.tri(len(points))*1e9) < 30)[:,-1]
    points          = [p for i,p in enumerate(points) if i not in ignore_idcs]
    extras          = [e for i,e in enumerate(extras) if i not in ignore_idcs]
    return points, extras


def extract_patchstack(bigimage, center, imagemask, patchsize, unscale_factor):
    imageshape   = bigimage.shape[:2]
    image        = bigimage
    image        = image * (imagemask>0)[...,np.newaxis]
    region       = skmeasure.regionprops(imagemask.astype(int))[0]
    glimpsesize  = min(region.bbox[2]-region.bbox[0], region.bbox[3]-region.bbox[1])
    center       = sanitize_patch_center(region.centroid, glimpsesize, imageshape)
    patch        = tf.image.extract_glimpse(tf.cast(image[tf.newaxis], tf.float32), (glimpsesize, glimpsesize), [center], False, False)[0]
    patch        = tf.image.resize(patch, (patchsize, patchsize))
    patchstack   = patch[tf.newaxis]
    if 1:
        glimpsesize  = int(glimpsesize*1.5)
        center       = sanitize_patch_center(region.centroid, glimpsesize, imageshape)
        patch        = tf.image.extract_glimpse(tf.cast(image[tf.newaxis], tf.float32), (glimpsesize, glimpsesize), [center], False, False)[0]
        patch        = tf.image.resize(patch, (PATCHSIZE, PATCHSIZE))                                            #FIXME: first resize then alpha-blending
        patchstack   = tf.concat( [patch[tf.newaxis], patchstack], axis=0 )

        glimpsesize  = int(glimpsesize*0.55)
        center       = sanitize_patch_center(region.centroid, glimpsesize, imageshape)
        patch        = tf.image.extract_glimpse(tf.cast(image[tf.newaxis], tf.float32), (glimpsesize, glimpsesize), [center], False, False)[0]
        patch        = tf.image.resize(patch, (PATCHSIZE, PATCHSIZE))                                            #FIXME: first resize then alpha-blending
        patchstack   = tf.concat( [patch[tf.newaxis], patchstack], axis=0 )
    return patchstack


def classify_patchstack(models, patchstack, batnotbat_model=None):
    if batnotbat_model is not None:
        if batnotbat_model.predict(patchstack).mean() < 0.5:
            return np.array([1])  #argmax = 0
    patchstack   = tf.concat([patchstack, patchstack[:,:,::-1]], axis=0)
    return np.mean( np.mean( [m.predict(patchstack) for m in models], axis=0 ), axis=0 )


class ProcessingResult:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

def process_image(image):
    bigimage                = image
    smallimage              = resize_image_for_detection(bigimage, RESIZE_FACTOR)

    detectionmap, centers   = detect(smallimage[...,::-1],  detection_model)
    centers                 = [sanitize_patch_center(c, PATCHSIZE, smallimage.shape) for c in centers]

    masks                   = [segment(bigimage, smallimage, segmentation_model, c, PATCHSIZE) for c in centers]
    centers                 = [np.argwhere(m).mean(0) * RESIZE_FACTOR for m in masks]
    centers,masks           = filter_close(centers, masks, 40)

    patchstacks             = [extract_patchstack(bigimage, c, m, PATCHSIZE, RESIZE_FACTOR) for c,m in zip(centers, masks)]
    logits                  = [classify_patchstack(classification_models, p, batnotbat_model) for p in patchstacks]
    labels                  = [LABELS_LIST[logit.argmax()] for logit in logits]

    patches = [pstack[1] for l,pstack in zip(labels, patchstacks) if l!='']
    labels  = [l for l in labels if l!='']
    return ProcessingResult(detectionmap = np.max(masks, axis=0) if len(masks) else detectionmap,
                            labels=labels,
                            patches=patches)




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
