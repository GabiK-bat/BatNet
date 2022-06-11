import torch, torchvision
from torchvision.models._utils import IntermediateLayerGetter
import PIL.Image
import onnxruntime
import numpy as np
import scipy.optimize

import typing as tp
import io, warnings, sys, time, importlib
warnings.simplefilter('ignore') #pytorch is too noisy


if "__torch_package__" in dir():
    #inside a torch package
    import torch_package_importer
    import_func = torch_package_importer.import_module 
else:
    #normal
    import importlib
    import_func = lambda m: importlib.reload(importlib.import_module(m))

#internal modules
MODULES = ['datasets', 'traininglib']
[datasets, traininglib] = [import_func(m) for m in MODULES]



class BatDetector(torch.nn.Module):
    def __init__(self, classes_of_interest):
        super().__init__()
        self.class_list         = classes_of_interest
        self.detector           = Detector()
        self.segmentation_model = UNet()
        self.classifier         = Ensemble([
            Classifier(self.segmentation_model, self.class_list, name) for name in ['mobilenet_v3_large', 'mobilenet_v2', 'shufflenet_v2_x1_0']
        ])
        self._device_indicator  = torch.nn.Parameter(torch.zeros(0)) #dummy parameter
    
    def forward(self, x, temperature:float=0.75):
        results:tp.List[Prediction] = []
        device           = self._device_indicator.device
        x                = x.to(device)
        
        detector_outputs = self.detector(x)
        if torch.jit.is_scripting():
            detector_outputs = self.detector(x)[1]
        
        for o in detector_outputs:
            boxes            = o['boxes']
            _boxes           = torch.cat([torch.zeros_like(boxes[:,:1]), boxes], -1)
            cropsize         = self.classifier.image_size
            crops            = torchvision.ops.roi_align(x, _boxes, cropsize, sampling_ratio=1)
            if torch.onnx.is_in_onnx_export():
                #pad to batch dimension of at least one
                crops = torch.jit.script(pad_if_needed)(crops)
            if crops.shape[0] > 0:
                probabilities    = self.classifier(crops, T=temperature)
                probabilities    = probabilities[:boxes.shape[0]] #to counter-act padding in onnx
            else:
                probabilities    = torch.zeros([0,len(self.class_list)])
            
            results.append( Prediction(
                boxes          = boxes,
                box_scores     = o['scores'],
                probabilities  = probabilities,
                labels         = [self.class_list[p.argmax(-1)] for p in probabilities],
                crops          = crops,
            ) )
        return results
    
    @staticmethod
    def load_image(filename, to_tensor=False):
        image =  PIL.Image.open(filename)
        if to_tensor:
            image = torchvision.transforms.functional.to_tensor(image)
        return image
    
    def process_image(self, image, use_onnx=False):
        if isinstance(image, str):
            image = self.load_image(image)
        x = torchvision.transforms.functional.to_tensor(image)
        with torch.no_grad():
            output = self.eval().forward(x[np.newaxis])[0]
        
        output = output.numpy()
        return {
            'boxes'            : output.boxes,
            'box_scores'       : output.box_scores,
            'cls_scores'       : output.probabilities,
            'per_class_scores' : [ dict(zip( self.class_list, p )) for p in output.probabilities.tolist() ],
            'labels'           : output.labels,
        }
    
    def start_training_detector(
            self, 
            imagefiles_train,          jsonfiles_train,
            imagefiles_test   = None,  jsonfiles_test = None, ood_files = [], 
            negative_classes  = [],    lr             = 1e-3,
            epochs            = 10,    callback       = None,
            num_workers       = 'auto',
    ):
        n_ood   = min(len(imagefiles_train) // 20, len(ood_files) )
        ds_type = datasets.DetectionDataset if (n_ood==0) else datasets.OOD_DetectionDataset
        ood_kw  = {}                        if (n_ood==0) else {'ood_files':ood_files, 'n_ood':n_ood}
        
        ds_train = ds_type(imagefiles_train, jsonfiles_train, augment=True, negative_classes=negative_classes, **ood_kw)
        ld_train = datasets.create_dataloader(ds_train, batch_size=8, shuffle=True, num_workers=num_workers)
        
        ld_test  = None
        if imagefiles_test is not None:
            ds_test  = datasets.DetectionDataset(imagefiles_test, jsonfiles_test, augment=False, negative_classes=negative_classes)
            ld_test  = datasets.create_dataloader(ds_test, batch_size=8, shuffle=False, num_workers=num_workers)
        
        task = traininglib.DetectionTask(self.detector, callback=callback, lr=lr)
        ret  = task.fit(ld_train, ld_test, epochs=epochs)
        return (not task.stop_requested and not ret)
        
    def start_training_segmentation_model(self, imagefiles, jsonfiles, epochs=15):
        task     = SegmentationTask(self.segmentation_model)
        ds_train = datasets.SegmentationDataset(imagefiles, jsonfiles, augment=True)
        ld_train = datasets.create_dataloader(ds_train, batch_size=32, shuffle=True)
        task.fit(epochs, ld_train)
        return (not task.stop_requested)
    
    def start_training_classifier(
            self,
            imagefiles_train,           targetfiles_train,
            imagefiles_valid    = None, targetfiles_valid = None,
            classes_of_interest = None, classes_negatives = [], 
            classes_ignore      = [],   classes_lowconf   = [],
            epochs              = 10,   lr                = 1e-3,
            callback            = None, num_workers       = 'auto',  batch_size = 8,
            ds_kwargs           = {},   task_kwargs       = {}
    ):
        classes_of_interest = classes_of_interest or self.class_list
        classes_of_interest = self.classifier.set_classes(classes_of_interest) #new ordering
        self.class_list     = classes_of_interest
        
        ds_train = datasets.ClassificationDataset(
            imagefiles_train,    targetfiles_train, None,
            classes_of_interest, classes_negatives, classes_lowconf,
            image_size     = self.classifier.image_size,
            augment        = True, **ds_kwargs)
        ld_train = datasets.create_dataloader(ds_train, batch_size=batch_size, shuffle=True, num_workers=num_workers)
        
        ld_test  = None
        if imagefiles_valid is not None:
            ds_test = datasets.ClassificationDataset(
                imagefiles_valid, targetfiles_valid, None,
                classes_of_interest, classes_negatives, classes_lowconf,
                image_size     = self.classifier.image_size,
                augment        = False, **ds_kwargs)
            ld_test = datasets.create_dataloader(ds_test, batch_size=batch_size, shuffle=False, num_workers=num_workers)
        
        for i,clf in enumerate(self.classifier.classifiers):
            cb = lambda x: callback( (i+x) / len(self.classifier.classifiers)) if callback else None
            task = traininglib.ClassificationTask(clf, epochs=epochs, lr=lr, callback=cb, **task_kwargs)
            ret  = task.fit(ld_train, ld_test, epochs=epochs)
            if task.stop_requested or ret:
                break
        return (not task.stop_requested and not ret)
    
    def stop_training(self):
        traininglib.TrainingTask.request_stop()
    
    def save(self, destination):
        if isinstance(destination, str):
            destination = time.strftime(destination)
            if not destination.endswith('.pt.zip'):
                destination += '.pt.zip'
        try:
            import torch_package_importer as imp
            #re-export
            importer = (imp, torch.package.sys_importer)
        except ImportError as e:
            #first export
            importer = (torch.package.sys_importer,)
        with torch.package.PackageExporter(destination, importer) as pe:
            interns = [__name__.split('.')[-1]]+MODULES
            pe.intern(interns)
            pe.extern('**', exclude=['torchvision.**'])
            externs = ['torchvision.ops.**', 'torchvision.datasets.**', 'torchvision.io.**', 'torchvision.models.*']
            pe.intern('torchvision.**', exclude=externs)
            pe.extern(externs, exclude='torchvision.models.detection.**')
            pe.intern('torchvision.models.detection.**')
            
            #force inclusion of internal modules + re-save if importlib.reload'ed
            for inmod in interns:
                if inmod in sys.modules:
                    pe.save_source_file(inmod, sys.modules[inmod].__file__, dependencies=True)
                else:
                    pe.save_source_string(inmod, importer[0].get_source(inmod))
            
            pe.save_pickle('model', 'model.pkl', self)
            pe.save_text('model', 'class_list.txt', '\n'.join(self.class_list))
        return destination
    
    


#@torch.jit.script  #commented out to make the module cloudpickleable, scripted on the fly
def pad_if_needed(x):
    #pad to batch dimension of at least one
    paddings = [0,0, 0,0, 0,0, 0, max(0, 1 - x.shape[0])]
    x        = torch.nn.functional.pad(x, paddings)
    return x



class Prediction(tp.NamedTuple):
    boxes:           torch.Tensor
    box_scores:      torch.Tensor
    probabilities:   torch.Tensor
    labels:          tp.List[str]
    crops:           torch.Tensor
    
    
    
    def numpy(self):
        return Prediction(*[x.cpu().numpy() if torch.is_tensor(x) else x for x in self])





def normalize(x):
    if len(x)==0:
        return x
    if x.ndim==3:
        x = x[None]
    xmax = x.max(1,True)[0].max(2,True)[0].max(3,True)[0]
    return x / torch.clamp_min(xmax, 1e-6)  #range 0...1

class Detector(torch.nn.Module):
    def __init__(self, image_size=320):
        super().__init__()
        self.basemodel = torchvision.models.detection.fasterrcnn_resnet50_fpn(pretrained=True, progress=False, min_size=image_size, box_score_thresh=0.5, box_nms_thresh=0.4)
        self.resize     = torchvision.transforms.Resize([image_size]*2)
        self.image_size = image_size
        self._device_indicator  = torch.nn.Parameter(torch.zeros(0)) #dummy parameter
    
    def forward(self, x, targets:tp.Optional[tp.List[tp.Dict[str, torch.Tensor]]]=None):
        size0 = [x.shape[-2], x.shape[-1]]
        x     = self.resize(x)
        size1 = [x.shape[-2], x.shape[-1]]
        x     = normalize(x)
        out   = self.basemodel(list(x), targets)
        if torch.jit.is_scripting():
            self.resize_boxes(out[1], size1, size0)
        elif not self.training:
            self.resize_boxes(out, size1, size0)
        return out

    def resize_boxes(self, inference_output:tp.List[tp.Dict[str, torch.Tensor]], from_size:tp.List[int], to_size:tp.List[int]):
        for o in inference_output:
            o['boxes'] = torchvision.models.detection.transform.resize_boxes(o['boxes'], from_size, to_size)



class UNet(torch.nn.Module):
    '''Backboned U-Net'''
    class UpBlock(torch.nn.Module):
        def __init__(self, in_c, out_c, inter_c=None):
            torch.nn.Module.__init__(self)
            inter_c        = inter_c or out_c
            self.conv1x1   = torch.nn.Conv2d(in_c, inter_c, 1)
            self.convblock = torch.nn.Sequential(
                torch.nn.Conv2d(inter_c, out_c, 3, padding=1, bias=0),
                torch.nn.BatchNorm2d(out_c),
                torch.nn.ReLU(),
            )
        def forward(self, x, skip_x):
            x = torch.nn.functional.interpolate(x, skip_x.shape[2:])
            x = torch.cat([x, skip_x], dim=1)
            x = self.conv1x1(x)
            x = self.convblock(x)
            return x
    
    def __init__(self):
        torch.nn.Module.__init__(self)
        return_layers = dict(relu='out0', layer1='out1', layer2='out2', layer3='out3', layer4='out4')
        resnet        = torchvision.models.resnet18(pretrained=True, progress=False)
        self.backbone = IntermediateLayerGetter(resnet, return_layers )
        
        C = 512  #resnet18
        self.up0 = self.UpBlock(C    + C//2,  C//2)
        self.up1 = self.UpBlock(C//2 + C//4,  C//4)
        self.up2 = self.UpBlock(C//4 + C//8,  C//8)
        self.up3 = self.UpBlock(C//8 + C//8,   64)
        self.up4 = self.UpBlock(  64 +    3,   32)
        self.cls = torch.nn.Conv2d(32, 1, 3, padding=1)
    
    
    def forward(self, x):
        x = normalize(x)
        X = self.backbone(x)
        X = ([x] + [X[f'out{i}'] for i in range(5)])[::-1]
        x = X.pop(0)
        x = self.up0(x, X[0])
        x = self.up1(x, X[1])
        x = self.up2(x, X[2])
        x = self.up3(x, X[3])
        x = self.up4(x, X[4])
        x = self.cls(x)
        return x
    
    def remove_background(self, x):
        mask = self(x)
        return x * (mask > 0).float()


    
class Classifier(torch.nn.Module):
    def __init__(self, segmentation_model, class_list, modelname='mobilenet_v3_large', dropout_p=0.4):
        torch.nn.Module.__init__(self)
        self.segmentation_model = segmentation_model
        self.class_list         = class_list
        #disable gradient computation and thus training for the segmentation model  #FIXME: only during training
        #for p in self.segmentation_model.parameters():
        #    p.requires_grad = False
        self.basemodel         = getattr(torchvision.models, modelname)(pretrained=True, progress=False)
        if 'shufflenet' in modelname.lower():
            layers  = list(self.basemodel.children())[:-1] 
            layers += [torch.nn.AdaptiveAvgPool2d((1,1)), torch.nn.Flatten()]
            layers += [torch.nn.Dropout(p = dropout_p) ]
            layers += [list(self.basemodel.children())[-1] ]
            self.basemodel = torch.nn.Sequential(*layers)
        else:
            #modify dropout percentage
            self.basemodel.classifier[-2].p = dropout_p
    
    def forward(self, x, remove_bg:bool=True):
        if remove_bg:
            x    = self.segmentation_model.remove_background(x).detach()
        x    = normalize(x)
        return self.basemodel(x)[:, :len(self.class_list)]
    
    def set_classes(self, new_classes):
        #new_classes = set([c.lower() for c in new_classes]).difference(['not-a-bat','other'])
        #new_classes = ['not-a-bat'] + sorted( new_classes ) + ['other']
        #old_classes = [c.lower() for c in self.class_list]
        new_classes = set([c for c in new_classes]).difference(['Not-A-Bat','Other'])
        new_classes = ['Not-A-Bat'] + sorted( new_classes ) + ['Other']
        old_classes = [c for c in self.class_list]
        try:    old_linear  = self.basemodel.classifier[-1]
        except: old_linear  = self.basemodel[-1]
        new_linear  = torch.nn.Linear(old_linear.weight.shape[1], len(new_classes)).requires_grad_(False)
        for i,c in enumerate(new_classes):
            if c in old_classes:
                j = old_classes.index(c)
                new_linear.weight.data[i] = old_linear.weight[j]
                new_linear.bias.data[i]   = old_linear.bias[j]
        try:      self.basemodel.classifier[-1]  = new_linear
        except:   self.basemodel[-1]             = new_linear
        self.class_list = new_classes
        return self.class_list


class Ensemble(torch.nn.Module):
    def __init__(self, classifiers, image_size=256):
        torch.nn.Module.__init__(self)
        self.classifiers        = torch.nn.ModuleList(classifiers)
        self.segmentation_model = classifiers[0].segmentation_model
        self.image_size         = image_size
    
    def forward(self, x, T:float=1.0):
        x  = self.segmentation_model.remove_background(x).detach()
        Y  = [C(x, remove_bg=False) for C in self.classifiers]
        Y += [C(torch.flip(x, dims=[-1]), False) for C in self.classifiers] #tta
        y  = torch.softmax( torch.stack(Y) / T, -1 ).mean(0)
        return y
    
    def set_classes(self, new_classes):
        for clf in self.classifiers:
            self.class_list = clf.set_classes(new_classes)
        return self.class_list



