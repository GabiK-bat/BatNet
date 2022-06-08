
BatSettings = class extends BaseSettings{
    //override
    static apply_settings_from_modal(){
        super.apply_settings_from_modal()
        
        GLOBAL.settings['confidence_threshold'] = Number($("#settings-confidence-threshold-input")[0].value);
        GLOBAL.settings['export_boxes']         = $("#settings-export-boxes").checkbox('is checked');
    }

    //override
    static update_settings_modal(models){
        super.update_settings_modal(models)

        const settings = GLOBAL.settings;

        $("#settings-confidence-threshold-input")[0].value = settings.confidence_threshold
        $("#settings-export-boxes").checkbox(settings.export_boxes? 'check' : 'uncheck');
    }
}

