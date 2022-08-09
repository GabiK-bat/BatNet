

BatTraining = class extends ObjectDetectionTraining {
    
    //dummy override: all files (with results) selected
    static get_selected_files(){
        return Object.entries(GLOBAL.files)
                .filter(([k,v]) => v.results!=undefined)
                .map(   ([k,v]) => k)
    }

    static collect_class_counts(){
        return super.collect_class_counts('Not-A-Bat')
    }

}

