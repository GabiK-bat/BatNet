import backend.cli
import PIL.Image, numpy as np
import os, tempfile


def test_results_to_csv():
    tmpdir   = tempfile.TemporaryDirectory()
    imgpath0 = os.path.join(tmpdir.name, 'image0.jpg')
    imgpath1 = os.path.join(tmpdir.name, 'image1.jpg')
    PIL.Image.fromarray(np.ones([256,256,3], 'uint8')).save(imgpath0)
    PIL.Image.fromarray(np.ones([256,256,3], 'uint8')).save(imgpath1)

    results = [
        { 
            'filename': imgpath0,
            'result': {
                'boxes'            : [],
                'box_scores'       : [],
                'cls_scores'       : [],
                'per_class_scores' : [],
                'labels'           : [],
            }
        },
        { 
            'filename': imgpath1,
            'result': {
                'boxes'            : np.array([[100,100,200,200]]),
                'box_scores'       : np.array([0.65]),
                'cls_scores'       : np.array([0.65]),
                'per_class_scores' : [ {'Dracula': 0.65} ],
                'labels'           : [ 'Dracula' ],
            }
        }
    ]
    csv = backend.cli.results_to_csv(results, export_boxes=True)

    lines = [l for l in csv.split('\n') if l.strip()]
    assert len(lines) == len(results)+1
    assert lines[1].split(';')[4] == 'empty'
    assert 'Box' in lines[0]

