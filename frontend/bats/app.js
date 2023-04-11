
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

    compute_flags(filename, return_per_result=false){
        const hiconf_threshold = GLOBAL.settings.confidence_threshold/100 ?? 0.70
        let lowconfs = [];
        let amount   = 0;
        let flags    = []

        const n     = this.labels.length;
        for (let i = 0; i < n; i++) {
            const confidence = Object.values(sort_object_by_value(this.predictions)[i])[0]
            const _lowconf   = (confidence <= hiconf_threshold);

            const label      = this.labels[i];
            const is_negative 
              = (label.toLowerCase()==GLOBAL.App.NEGATIVE_CLASS.toLowerCase()) || !label
            
            if(!is_negative || GLOBAL.settings['flag_negatives']) {
              lowconfs.push(_lowconf)
            }
            
            if(!is_negative){
              amount += 1;
            }
        }
        
        const manual_flags = $(`[filename="${filename}"] td.flags-cell`).hasClass('manual-flag')
        const lowconf = lowconfs.includes(true) ^ manual_flags;
        if(lowconf)
          flags.push('unsure');
      
        if(return_per_result)
          if(manual_flags)
            return lowconfs.map(x => {return lowconf? 'unsure' : ''});
          else
            return lowconfs.map(x => {return x? 'unsure' : ''});
      
        if(amount==0)
          flags.push('empty');
        else if(amount>1)
          flags.push('multiple');
        
        return flags
    }
}
