//TODO: unify


BatFileInput = class extends BaseFileInput{

    //override
    static set_input_files(files){
        GLOBAL.metadata = undefined;
        return super.set_input_files(files)
    }

    //override
    static match_resultfile_to_inputfile(inputfilename, resultfilename){
        var basename          = file_basename(resultfilename)
        const no_ext_filename = remove_file_extension(inputfilename)
        const candidate_names = [
            inputfilename+'.json', no_ext_filename+'.json',
        ]
        return (candidate_names.indexOf(basename) != -1)
    }
    
    //override
    static async load_result(filename, resultfiles){
        const _this = this;
        const promise = new Promise(async (resolve, reject) => {
            const reader  = new FileReader();
            reader.onload = async function(){
                const text = reader.result;
                const data = JSON.parse(text);

                const predictions = get_or_infer_predictions_from_labelme(data)

                let results = Object.assign(data, {labels:[], boxes:[]})
                for(const i in data.shapes){
                    //results.labels.push( {[data.shapes[i].label]:1.0} )
                    results.labels.push(predictions[i])
                    let box = data.shapes[i].points.flat()
                        box = [
                            Math.min(box[0], box[2]), 
                            Math.min(box[1], box[3]), 
                            Math.max(box[0], box[2]), 
                            Math.max(box[1], box[3]), 
                    ]
                    results.boxes.push( box )
                }
                if(!results.datetime) {
                    //earlier version which did not save datetime
                    //have to do a roundtrip to the backend to read exif
                    results.datetime = await _this.fetch_exif_datetime_via_backend(filename)
                }
                
                GLOBAL.App.Detection.set_results(filename, results)
                resolve()
            };
            const resultfile = resultfiles[0]
            const blob       = await(resultfile.async? resultfile.async('blob') : resultfile)
            reader.readAsText(blob);
        })
        return promise;
    }

    static async fetch_exif_datetime_via_backend(filename) {
        const file = GLOBAL.files[filename]
        await upload_file_to_flask(file)
        const response = await $.get('read_exif_datetime', {filename:filename})
        $.get(`delete_image/${filename}`)
        return response['datetime']
    }
}




// type PartialLabelMeObject = {
//     shapes: {
//         label: string
//     }[],
//     predictions: Record<string, number>[],
// }

/** Return Record<string, number>[] label-to-probability mappings from 
 *  either `.predictions` if present in the object and valid, 
 *  or construct an artificial one from `shapes::label` with 1.0 probability */
function get_or_infer_predictions_from_labelme(labelme_object/*:PartialLabelMeObject*/) {
    const predictions = labelme_object.predictions

    const predictions_are_valid =
        Array.isArray(predictions) &&
        predictions.every(
            (prediction) =>
                prediction &&
                typeof prediction === "object" &&
                !Array.isArray(prediction) &&
                Object.values(prediction).every(
                    (probability) =>
                        typeof probability === "number" &&
                        Number.isFinite(probability) &&
                        probability >= 0 &&
                        probability <= 1
                )
        )

    if(predictions_are_valid)
        return predictions
    
    //else
    return (labelme_object?.shapes ?? []).map((shape) => ({[shape.label]: 1.0}))
}
