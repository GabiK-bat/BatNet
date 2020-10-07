import webbrowser, os, tempfile, io, sys
import json
import flask
from flask import Flask, escape, request

import processing

#need to import all the packages here in the main file because of dill-ed ipython model
import tensorflow as tf
import tensorflow.keras as keras

import numpy as np
arange = np.arange
import skimage.io              as skio
import skimage.draw            as skdraw
import skimage.transform       as sktransform
import skimage.measure         as skmeasure
import skimage.morphology      as skmorph
import sklearn.svm             as sksvm
import sklearn.model_selection as skms
import sklearn.utils           as skutils
import skimage.util            as skimgutil
import util





app        = Flask('Bat Detector', static_folder=os.path.abspath('./HTML'))
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

TEMPFOLDER = tempfile.TemporaryDirectory(prefix='bat_detector_')
print('Temporary Directory: %s'%TEMPFOLDER.name)





@app.route('/')
def root():
    return app.send_static_file('index.html')

@app.route('/static/<x>')
def staticfiles(x):
    return app.send_static_file(x)

@app.route('/file_upload', methods=['POST'])
def file_upload():
    files = request.files.getlist("files")
    for f in files:
        print('Upload: %s'%f.filename)
        fullpath = os.path.join(TEMPFOLDER.name, os.path.basename(f.filename) )
        f.save(fullpath)
    return 'OK'

@app.route('/images/<imgname>')
def images(imgname):
    print('Download: %s'%os.path.join(TEMPFOLDER.name, imgname))
    return flask.send_from_directory(TEMPFOLDER.name, imgname)

@app.route('/process_image/<imgname>')
def process_image(imgname):
    fullpath     = os.path.join(TEMPFOLDER.name, imgname)
    image        = processing.load_image(fullpath)
    result       = processing.process_image(image)

    for i,patch in enumerate(result.blended_patches):
        processing.write_as_jpeg(os.path.join(TEMPFOLDER.name, 'patch_%i_%s'%(i,imgname)), patch)
    return flask.jsonify({'labels':result.labels, 'flag':result.flag, 'boxes':np.array(result.boxes).tolist() })


@app.route('/delete_image/<imgname>')
def delete_image(imgname):
    fullpath = os.path.join(TEMPFOLDER.name, imgname)
    print('DELETE: %s'%fullpath)
    if os.path.exists(fullpath):
        os.remove(fullpath)
    return 'OK'

@app.route('/custom_patch/<imgname>')
def custom_patch(imgname):
    box      = json.loads(request.args.get('box'))
    index    = int(request.args.get('index'))
    print(f'CUSTOM PATCH: {imgname} @box={box}')
    fullpath = os.path.join(TEMPFOLDER.name, imgname)
    image    = processing.load_image(fullpath)
    patch    = processing.extract_patch(image, box)
    processing.write_as_jpeg(os.path.join(TEMPFOLDER.name, 'patch_%i_%s'%(index,imgname)), patch)
    return 'OK'

@app.route('/start_training', methods=['POST'])
def start_training():
    imagefiles = dict(request.form.lists())['filenames[]']
    imagefiles = [os.path.join(TEMPFOLDER.name, fname) for fname in imagefiles]
    imagefiles = [fname for fname in imagefiles if os.path.exists(fname)]
    jsonfiles  = [os.path.splitext(fname)[0]+'.json'   for fname in imagefiles]
    imagefiles = [imgf  for imgf,jsonf in zip(imagefiles, jsonfiles) if os.path.exists(jsonf)]
    jsonfiles  = [jsonf for jsonf      in jsonfiles                  if os.path.exists(jsonf)]
    if len(imagefiles)>0:
        processing.retrain(imagefiles, jsonfiles)
        return 'OK'
    else:
        flask.abort(404)

@app.route('/settings', methods=['GET', 'POST'])
def settings():
    if request.method=='POST':
        processing.set_settings(dict(request.form))
        return 'OK'
    elif request.method=='GET':
        return flask.jsonify(processing.get_settings())



@app.after_request
def add_header(r):
    r.headers["Cache-Control"]  = "no-cache, no-store, must-revalidate, public, max-age=0"
    r.headers["Pragma"]         = "no-cache"
    r.headers["Expires"]        = "0"
    return r


is_debug = sys.argv[0].endswith('.py')
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not is_debug:  #to avoid flask starting twice
    with app.app_context():
        processing.init()
        if not is_debug:
        	print('Flask started')
        	webbrowser.open('http://localhost:5000', new=2)

app.run(host='127.0.0.1',port=5000, debug=is_debug)
