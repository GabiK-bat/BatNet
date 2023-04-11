
BatSettings = class extends BaseSettings{
    //override
    static apply_settings_from_modal(){
        super.apply_settings_from_modal()
        
        GLOBAL.settings['confidence_threshold'] = Number($("#settings-confidence-threshold-input")[0].value);
        GLOBAL.settings['flag_negatives']       = $("#settings-flag-negatives").checkbox('is checked');
        GLOBAL.settings['export_boxes']         = $("#settings-export-boxes").checkbox('is checked');

        GLOBAL.App.Detection.update_all_flags()
    }

    //override
    static update_settings_modal(models){
        super.update_settings_modal(models)

        const settings = GLOBAL.settings;

        $("#settings-confidence-threshold-input")[0].value = settings.confidence_threshold
        $("#settings-flag-negatives").checkbox(settings.flag_negatives? 'check' : 'uncheck');
        $("#settings-export-boxes").checkbox(settings.export_boxes? 'check' : 'uncheck');
    }

    //override
    static async load_settings(){
        const data           = await super.load_settings()
        GLOBAL.species_codes = data.species_codes;
        return data
    }
}

