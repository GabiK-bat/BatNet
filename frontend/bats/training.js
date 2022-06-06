

BatTraining = class extends ObjectDetectionTraining {
    
    //dummy override: all files selected
    static get_selected_files(){
        return Object.keys(GLOBAL.files)
    }

    static collect_class_counts(){
        return super.collect_class_counts('Not-A-Bat')
    }

}

