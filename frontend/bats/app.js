
BatApp = class extends BaseApp {
   static FileInput     = BatFileInput;
   static Detection     = BatDetection;
   static Boxes         = BatBoxes;
   static Sorting       = BatSorting;
   static Download      = BatDownload;
   static Training      = BatTraining;
}


//override
GLOBAL.App = BatApp

BatResults = class {
    predictions = []                 // [{'species' : confidence}, ...]
    boxes       = []                 // [[y0,x0,y1,x1], ...]
    labels      = [];                // ['selected species', ...]

    constructor(predictions, boxes){
        this.boxes       = boxes
        this.predictions = predictions.map(sort_object_by_value)
        this.labels      = this.predictions.map(p => Object.keys(p)[0])
    }
}
