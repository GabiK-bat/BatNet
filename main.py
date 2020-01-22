import webbrowser, os, tempfile, io, sys
import flask
from flask import Flask, escape, request

import processing




app        = Flask('Bat Detector', static_folder=os.path.abspath('./HTML'))
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

    processing.write_as_png(os.path.join(TEMPFOLDER.name, 'segmented_'+imgname), result.detectionmap)
    for i,patch in enumerate(result.patches):
        processing.write_as_png(os.path.join(TEMPFOLDER.name, 'patch_%i_%s'%(i,imgname)), patch)
    return flask.jsonify({'labels':result.labels})


@app.route('/delete_image/<imgname>')
def delete_image(imgname):
    fullpath = os.path.join(TEMPFOLDER.name, imgname)
    print('DELETE: %s'%fullpath)
    if os.path.exists(fullpath):
        os.remove(fullpath)
    return 'OK'



is_debug = sys.argv[0].endswith('.py')
if not is_debug:
    with app.app_context():
    	print('Flask started')
    	webbrowser.open('http://localhost:5000', new=2)

app.run(host='127.0.0.1',port=5000, debug=is_debug)
