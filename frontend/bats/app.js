
BatApp = class extends BaseApp {
   static FileInput     = BatFileInput;
   static Detection     = BatDetection;
   static Boxes         = BatBoxes;
   static Sorting       = BatSorting;
   static Download      = BatDownload;
   static Training      = BatTraining;
   static Settings      = BatSettings;

   static NEGATIVE_CLASS = 'Not-A-Bat'

    //called on click on "Metadata" button
    static on_metadata(){
        $('#metadata-dialog').modal({onApprove: function(){
            const meta = {
                'Site Name':            $('#input_site_name').val(),
                'Site Location':        $('#input_site_location').val(),
                'Site Responsible':     $('#input_site_responsible').val(),
                'Country':              $('#input_country').val(),
                'Latitude':             $('#input_latitude').val(),
                'Longitude':            $('#input_longitude').val(),
                'Camera ID':            $('#input_camera_id').val(),
                'Other':                $('#input_other').val(),
            };
            console.log("Metadata: "+JSON.stringify(meta));
            GLOBAL.metadata = meta;
        }}).modal('show')
    }
}


//override
GLOBAL.App      = BatApp;
GLOBAL.metadata = undefined;
GLOBAL.species_codes = {};    //'species': 'code';   loaded via settings

BatResults = class {
    predictions = []                 // [{'species' : confidence}, ...]
    boxes       = []                 // [[y0,x0,y1,x1], ...]
    labels      = [];                // ['selected species', ...]
    datetime    = null;              // string

    constructor(raw_results){
        this.boxes       = raw_results['boxes']
        this.predictions = raw_results['labels'].map(sort_object_by_value)
        this.labels      = this.predictions.map(p => Object.keys(p)[0])
        this.datetime    = raw_results['datetime']
    }

    is_negative(label){
        return !label || (label.toLowerCase() == GLOBAL.App.NEGATIVE_CLASS.toLowerCase());
    }

    /** Low-confidence flags for one file.
     *  - return_per_result=false: file-level flags, e.g. ['unsure', 'multiple']
     *  - return_per_result=true:  'unsure'/'' per detection, aligned with this.labels
     *                             (and thus with the rows csv_data_for_file() writes)   */
    compute_flags(filename, return_per_result=false){
        const hiconf_threshold = (GLOBAL.settings.confidence_threshold ?? 70) / 100;

        //one entry per detection; detections exempt from flagging get `false`
        const lowconfs = this.labels.map( (label, i) => {
            const confidence = Object.values(this.predictions[i])[0];
            const flaggable  = !this.is_negative(label) || GLOBAL.settings['flag_negatives'];
            return flaggable && (confidence <= hiconf_threshold);
        })

        const manually_flagged = $(`[filename="${filename}"] td.flags-cell`).hasClass('manual-flag');
        const unsure           = (lowconfs.includes(true) != manually_flagged);

        if(return_per_result){
            if(manually_flagged)
                return lowconfs.map( _ => unsure? 'unsure' : '' );
            return lowconfs.map( lowconf => lowconf? 'unsure' : '' );
        }

        const flags = [];
        if(unsure)
            flags.push('unsure');

        const n_bats = this.labels.filter( label => !this.is_negative(label) ).length;
        if(n_bats == 0)
            flags.push('empty');
        else if(n_bats > 1)
            flags.push('multiple');

        return flags;
    }
}
