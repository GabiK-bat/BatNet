import numpy as np

def box_center(box):
    '''Calcualtes the center of a box'''
    box = np.array(box)
    return (box[..., :2] + box[..., 2:])*0.5

def box_area(box):
    '''Calculate the area of a rectangle (x0,y0,x1,y1)'''
    return abs(box[2] - box[0]) * abs(box[3] - box[1])


def intersection(box0, box1):
    '''Returns a new box which is the intersection between box0 and box1'''
    x0 = max( box0[0], box1[0] )
    x1 = max( min( box0[2], box1[2] ), x0 )
    y0 = max( box0[1], box1[1] )
    y1 = max( min( box0[3], box1[3] ), y0 )
    return [x0,y0,x1,y1]


def IoU(box0, box1):
    '''Calculates the Intersection over Union of box0 and box1'''
    intersection_area = box_area( intersection( box0, box1 ) )
    return intersection_area / (box_area(box0) + box_area(box1) - intersection_area)


def occlusion_level(box0, box1):
    '''Computes how much box1 is occluded by box0 (range 0 to 1)'''
    return box_area(intersection(box0, box1))/box_area(box1)


def filter_occluded_boxes(boxes, threshold):
    '''Removes boxes that are occluded by other boxes larger than the threshold (returns new array)'''
    boxlist = sorted(list(boxes), key=box_area)[::-1]
    nboxes  = len(boxes)
    for i in range(nboxes):
        if i+1>=nboxes:
            continue
        for j in np.arange(len(boxlist), i+1, -1)-1:
            if occlusion_level(boxlist[i],boxlist[j]) > threshold:
                del boxlist[j]
            elif occlusion_level(boxlist[j],boxlist[i]) > threshold:
                del boxlist[i]
    return np.array(boxlist)
