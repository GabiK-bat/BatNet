import torch, torchvision
import numpy as np
import PIL.Image, PIL.ImageOps
import glob, json, os


def load_image(path:str) -> PIL.Image:
    '''Load image, rotate according to EXIF orientation'''
    image = PIL.Image.open(path).convert('RGB')
    image = PIL.ImageOps.exif_transpose(image)
    return image


try:
    #tensorflow for faster jpeg loading
    #CAUTION: can cause issues with image orientation
    import tensorflow as tf
    assert [] == tf.config.list_physical_devices('GPU')
except ImportError:
    #print('Could not import TensorFlow. Classifier training might be slow.')
    tf = None

def guess_encoding(x:bytes) -> str:
    try:
        return x.decode('utf8')
    except UnicodeDecodeError:
        return x.decode('cp1250')

def read_json_until_imagedata(jsonfile):
    '''LabelMe JSON are rather large because they contain the whole image additionally to the labels.
       This function reads a jsonfile only up to the imagedata attribute (ignoring everything afterwards) to reduce the loading time.
       Returns a valid JSON string'''
    f = open(jsonfile, 'rb')
    f.seek(0,2); n=f.tell(); f.seek(0,0)
    buffer = b''
    while b'imageData' not in buffer and len(buffer)<n:
        data      = f.read(1024*16)
        buffer   += data
        if len(data)==0:
            return buffer
    buffer   = buffer[:buffer.index(b'imageData')]
    buffer   = buffer[:buffer.rindex(b',')]
    buffer   = buffer+b'}'
    return guess_encoding(buffer)

def get_boxes_from_jsonfile(jsonfile, flip_axes=False, normalize=False):
    '''Reads bounding boxes from a LabeLMe json file and returns them as a (Nx4) array'''
    jsondata = json.loads(read_json_until_imagedata(jsonfile))
    boxes    = [shape['points'] for shape in jsondata['shapes']]
    boxes    = [[min(box[0],box[2]),min(box[1],box[3]),
                 max(box[0],box[2]),max(box[1],box[3])] for box in np.reshape(boxes, (-1,4))]
    boxes    = np.array(boxes)
    boxes    = (boxes.reshape(-1,2) / get_imagesize_from_jsonfile(jsonfile)[::-1]).reshape(-1,4) if normalize else boxes
    boxes    = boxes[:,[1,0,3,2]] if flip_axes else boxes
    return boxes.reshape(-1,4)

def get_polygons_from_jsonfile(jsonfile):
    '''Reads shapes from a LabeLMe json file and returns them as a list of arrays'''
    jsondata = json.loads(read_json_until_imagedata(jsonfile))
    return     [np.array(shape['points']).reshape(-1,2) for shape in jsondata['shapes']]

def get_labels_from_jsonfile(jsonfile):
    '''Reads a list of labels in a json LabelMe file.'''
    return [ s['label'] for s in json.loads( read_json_until_imagedata(jsonfile) )['shapes'] ]

def get_imagesize_from_jsonfile(jsonfile):
    f        = open(jsonfile, 'rb')
    #skip to the last n bytes
    filesize = f.seek(0,2)
    n        = min(192, filesize)
    f.seek(-n, 2)
    buffer   = f.read()
    idx      = buffer.rfind(b"imageHeight")
    if idx<0:
        raise ValueError(f'Cannot get image size: {jsonfile} does not contain image size information')
    jsondata = json.loads( b'{'+buffer[idx-1:] )
    return np.array([jsondata['imageHeight'], jsondata['imageWidth']])




def create_dataloader(dataset, batch_size, shuffle=False, num_workers='auto'):
    if num_workers == 'auto':
        num_workers = os.cpu_count()
    return torch.utils.data.DataLoader(dataset, batch_size, shuffle, collate_fn=getattr(dataset, 'collate_fn', None),
                                       num_workers=num_workers, pin_memory=True,
                                       worker_init_fn=lambda x: np.random.seed(torch.randint(0,1000,(1,))[0].item()+x) )


#class Dataset(torch.utils.data.Dataset):  #inheriting gives errors on unpickling
class Dataset:
    def __init__(self, jpgfiles, jsonfiles, augment=False):
        self.augment   = augment
        self.jsonfiles = jsonfiles
        self.jpgfiles  = jpgfiles
        self.transform = torchvision.transforms.Compose([torchvision.transforms.ToTensor()])
        if self.augment:
            self.transform.transforms += [
                torchvision.transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.02)
            ]
    
    def __len__(self):
        return len(self.jpgfiles)
    
    def __getitem__(self, i):
        image, target = self.get_item(i)
        image = self.transform(image)
        return image, target

class DetectionDataset(Dataset):
    #IGNORE = set(['Bat_hanging'])
    #SIZE   = 320 #px
    
    def __init__(self, jpgfiles, jsonfiles, augment:bool, negative_classes:list, image_size:int=320):
        super().__init__(jpgfiles, jsonfiles, augment)
        self.negative_classes = negative_classes
        self.image_size       = image_size
    
    def get_item(self, i):
        jsonfile = self.jsonfiles[i]
        jpgfile  = self.jpgfiles[i]
    
        image    = load_image(jpgfile)
        #load normalized boxes: 0...1
        boxes    = get_boxes_from_jsonfile(jsonfile, flip_axes=0, normalize=0)
        #bat species labels
        labels   = get_labels_from_jsonfile(jsonfile)
        #remove hanging bats
        boxes    = [box for box,label in zip(boxes, labels) if label not in self.negative_classes]
        boxes    = np.array(boxes).reshape(-1,4)
        if self.augment and np.random.random()<0.5:
            image  = image.transpose(PIL.Image.FLIP_LEFT_RIGHT)
            boxes  = self.flip_boxes(boxes, image.size)
        if self.augment and np.random.random()<0.1:
            image, boxes = self.random_pad(image, boxes)
        #resize boxes to imagesize
        boxes    = self.scale_boxes(boxes, image.size, [self.image_size]*2)
        boxes    = torch.as_tensor(boxes)
        image    = image.resize([self.image_size]*2)
        #object detector does not need to know the bat species, set all labels to 1
        labels   = torch.ones(len(boxes)).long()
        return image, {'boxes':boxes, 'labels':labels}
    
    @staticmethod
    def flip_boxes(boxes, image_size):
        W,H            = image_size
        boxes          = np.array(boxes).reshape(-1,4)
        boxes[:,(0,2)] = W - boxes[:,(2,0)]
        return boxes
    
    @staticmethod
    def scale_boxes(boxes, image_size, target_size):
        W,H            = image_size
        boxes          = np.array(boxes).reshape(-1,4)
        boxes          = boxes / (W,H,W,H)
        W,H            = target_size
        boxes          = boxes * (W,H,W,H)
        return boxes
    
    @staticmethod
    def random_pad(image, boxes, pad_rel_range=0.8):
        pad_max   = int(max(image.size) * pad_rel_range)
        padding   = np.random.randint(1, pad_max, 2)
        new_size  = image.size + padding
        offset    = np.random.randint(0, min(padding), 2)
        new_image = PIL.Image.new('RGB', tuple(new_size), color=tuple(np.random.randint(0,255,3)))
        new_image.paste(image, tuple(offset))
        boxes     = boxes + np.concatenate([offset]*2)[np.newaxis]
        return new_image, boxes
    
    @staticmethod
    def collate_fn(batchlist):
        images    = [x[0] for x in batchlist]
        images    = torch.stack(images)
        targets   = [x[1] for x in batchlist]
        return images, targets

class OOD_DetectionDataset(DetectionDataset):
    '''Augments the bats dataset with out-of-distribution images'''
    def __init__(self, *args, ood_files, n_ood, **kwargs):
        super().__init__(*args, **kwargs)
        self.ood_files = ood_files
        self.n_ood     = n_ood
    
    def __len__(self):
        return super().__len__()+self.n_ood
    
    def get_item(self, i):
        if i < super().__len__():
            return super().get_item(i)
        i      = np.random.randint(len(self.ood_files))
        image  = load_image(self.ood_files[i]).resize([self.SIZE]*2)
        return image, {'boxes':torch.as_tensor([]).reshape(-1,4), 'labels':torch.as_tensor([]).long()}


def should_ignore_file(json_file='', ignore_list=[]):
    labels = get_labels_from_jsonfile(json_file) if os.path.exists(json_file) else []
    return any([(l in ignore_list) for l in labels])

def augment_box(box, scale=25, min_size=8):
    new_box  = box + np.random.normal(scale=scale, size=4)
    box_size = new_box[2:] - new_box[:2]
    if any(box_size < min_size):
        new_box = box
    return new_box

class SegmentationDataset(Dataset):
    SIZE = 256
    
    def get_item(self, i):
        jsonfile = self.jsonfiles[i]
        polygons = get_polygons_from_jsonfile(jsonfile)
        #for simplicity, take only one polygon, ignore others
        polygon  = polygons[np.random.randint(len(polygons))]
        
        jpgfile  = self.jpgfiles[i]
        image    = load_image(jpgfile)
        
        box      = np.r_[polygon.min(0), polygon.max(0)]
        if self.augment:
            box  = augment_box(box)
        mask     = self.draw_mask(polygon, image.size)
        mask     = mask.crop(box).resize([self.SIZE]*2)
        image    = image.crop(box).resize([self.SIZE]*2)
        if self.augment and np.random.random()<0.5:
            image = image.transpose(PIL.Image.FLIP_LEFT_RIGHT)
            mask  = mask.transpose(PIL.Image.FLIP_LEFT_RIGHT)
        return image, (mask / np.float32(255))[None]

    def draw_mask(self, polygon, image_size):
        mask    = PIL.Image.new('L', image_size)
        draw    = PIL.ImageDraw.Draw(mask)
        #PIL requires a list of tuples for some reason
        polygon = [tuple(p) for p in polygon]
        draw.polygon(polygon, fill=255)
        return mask



class ClassificationDataset(Dataset):
    SIZE        = 256
    LABELS_LIST = [
     '',  #negative class
     'Barbastella barbastellus',
     'Eptesicus serotinus',
     'Myotis bechsteinii',
     'Myotis dasycneme',
     'Myotis daubentonii',
     'Myotis emarginatus',
     'Myotis myotis_Myotis blythii',
     'Myotis mystacinus_Myotis brandtii_Myotis alcathoe',
     'Myotis nattereri',
     'Nyctalus noctula',
     'Pipistrellus sp.',
     'Plecotus auritus_Plecotus austriacus',
    # 'Rhinolophus ferrumequinum',
     'Rhinolophus sp.'
    ]
    NEGATIVES = ['Bat_hanging']  #counts as own class (not-a-bat)
    LOWCONFS  = ['Bat_unknown']  #tries to reduce confidence
    
    def __init__(
            self, 
            jpgfiles:list,
            jsonfiles:list, 
            detected_boxes:'list | None', #boxes from detector (incl false positives), GT is used if None
            classes_of_interest:list,
            classes_negative:list     = ['Bat_hanging'], #count as own class (not-a-bat)
            classes_lowconf:list      = ['Bat_unknown'], #try to reduce confidence
            augment:bool              = False, 
            image_size:int            = 256,
            use_tf_loading:bool       = False,  #faster, but make sure that there are no EXIF-rotated images
    ):
        super().__init__(jpgfiles, jsonfiles, augment)
        self.class_list       = list(classes_of_interest) #[l.lower() for l in classes_of_interest]
        self.classes_negative = list(classes_negative)    #[l.lower() for l in classes_negative]
        self.classes_lowconf  = list(classes_lowconf)     #[l.lower() for l in classes_lowconf]
        self.use_tf_loading   = use_tf_loading
        
        detected_boxes = detected_boxes or [ np.zeros([0,4]) ]*len(self.jpgfiles)
        self.jpgfiles, self.labels, self.boxes = [],[],[]
        for jpgfile, jsonfile, boxes in zip(jpgfiles, jsonfiles, detected_boxes):
            labels = get_labels_from_jsonfile(jsonfile)
            
            gt_labels     = get_labels_from_jsonfile(jsonfile)
            gt_boxes      = get_boxes_from_jsonfile(jsonfile)
            boxes, labels = self.match_boxes_labels(boxes, gt_boxes, gt_labels)
            
            for l,b in zip(labels, boxes):
                idx = self.label2idx(l)
                if idx is None:
                    raise RuntimeError('Encountered unspecified class:', l)
                self.jpgfiles.append(jpgfile)
                self.labels.append(idx)
                self.boxes.append(b)
        self.image_size = image_size
        self.transform.transforms.append(torchvision.transforms.Resize([image_size]*2))
    
    def get_item(self, i):
        imagefile, label, box = self.jpgfiles[i], self.labels[i], self.boxes[i]
        if self.augment:
            box  = augment_box(box)
        try:
            image = self.load_and_crop_jpeg(imagefile, box) / np.float32(255)
        except:
            print('Failed to load image:', imagefile, box)
            raise
        if self.augment and np.random.random()<0.5:
            image = np.fliplr(image).copy()
        return image, label
    
    #@classmethod
    def label2idx(self, l):
        #l = l.lower()
        return   0   if l in self.classes_negative        \
         else   -1   if l in self.classes_lowconf         \
         else   None if l not in self.class_list          \
         else   self.class_list.index(l)

    @staticmethod
    def match_boxes_labels(detected_boxes, gt_boxes, gt_labels, positive_threshold=0.4, negative_threshold=0.1):
        '''Matches predicted to ground truth boxes. Returns predicted if above IoU threshold, ground truth otherwise'''
        ious    = torchvision.ops.box_iou(torch.as_tensor(detected_boxes), torch.as_tensor(gt_boxes) ).numpy()
        boxes, labels = [],[]
        for i in range(len(detected_boxes)):
            if len(gt_boxes)==0 or ious[i].max() < negative_threshold:
                boxes  += [detected_boxes[i]]
                labels += ['']
            elif ious[i].max() >= positive_threshold:
                boxes  += [detected_boxes[i]]
                labels += [gt_labels[ious[i].argmax()]]
        for j in range(len(gt_boxes)):
            if len(detected_boxes)==0 or ious[:,j].max() < positive_threshold:
                boxes  += [gt_boxes[j]]
                labels += [gt_labels[j]]
        return np.array(boxes), np.array(labels)
    
    def load_and_crop_jpeg(self, jpegfile, box):
        if tf is None or not self.use_tf_loading:
            #slow failback
            return np.array(load_image(jpegfile).crop(box))
        else:
            #fast (but causes issues with EXIF-rotated images)
            jpgdata = open(jpegfile, 'rb').read()
            shape   = tf.io.extract_jpeg_shape(jpgdata)
            #box sanity checks
            box_x   = np.clip(box[0::2], 0, shape[1])
            box_y   = np.clip(box[1::2], 0, shape[0])
            window  = [box_y[0], box_x[0], max(8,box_y[1]-box_y[0]), max(8,box_x[1]-box_x[0])]
            window  = tf.cast(window, dtype='int32')
            try:
                return tf.io.decode_and_crop_jpeg(jpgdata, window).numpy()
            except:
                print(f'Cropping failed! {jpegfile} Shape:{shape}, Box:',box, box_y, box_x, window, window.shape)


def random_wrong_box(imagesize, true_boxes, n=15, max_iou=0.1):
    '''Tries to find a box that does not overlap with other `true_boxes`'''
    for i in range(n):
        center = np.random.random(2)*imagesize
        size   = np.random.uniform(0.05, 0.50, size=2)*imagesize
        box    = np.concatenate([center-size/2, center+size/2])
        ious   = torchvision.ops.box_iou(torch.as_tensor(true_boxes), torch.as_tensor(box)[None] ).numpy()
        if true_boxes is None or ious.max() < max_iou:
            return box
    else:
        return None

class OOD_ClassificationDataset(ClassificationDataset):
    '''Augments the bats dataset with wrong boxes and out-of-distribution images'''
    def __init__(self, *args, ood_files, n_ood, **kwargs):
        super().__init__(*args, **kwargs)
        self.ood_files = ood_files
        self.n_ood     = n_ood
    
    def __len__(self):
        return super().__len__()+self.n_ood
    
    def get_item(self, i):
        if i < super().__len__():
            return super().get_item(i)
        if np.random.random()<0.5:
            i      = np.random.randint(len(self.ood_files))
            image  = load_image(self.ood_files[i]).resize([self.SIZE]*2)
            image  = np.asarray(image) / np.float32(255)
        else:
            i         = np.random.randint(len(self.jpgfiles))
            imagefile, box = self.jpgfiles[i], self.boxes[i]
            image     = load_image(imagefile)
            #XXX: might be incorrect if there are multiple boxes in the file
            wrong_box = random_wrong_box(image.size, [box])
            image     = self.load_and_crop_jpeg(imagefile, wrong_box) / np.float32(255)
        return image, 0
