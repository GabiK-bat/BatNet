

BatDownload = class extends ObjectDetectionDownload{
    //override
    static build_annotation_jsonfile(filename, results){
        return super.build_annotation_jsonfile(filename, results, "Not-A-Bat")
    }
}
