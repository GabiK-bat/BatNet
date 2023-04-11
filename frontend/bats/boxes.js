

BatBoxes = class extends BaseBoxes {
    //override
    static NEGATIVE_CLASS_NAME = 'Not-A-Bat'

    //TODO: unify
    //override
    static get_set_of_all_labels() {
        let all_labels = this.get_known_classes_of_active_model()
        for(const f of Object.values(GLOBAL.files)){
            all_labels = all_labels.concat(f.results?.labels)
        }
        let uniques = new Set(all_labels)
            uniques.delete('')
            uniques.delete(this.NEGATIVE_CLASS_NAME)
        return [this.NEGATIVE_CLASS_NAME].concat([...uniques].sort())
    }

    static get_known_classes_of_active_model() {
        const modelname  = GLOBAL.settings.active_models.detection;
        const modelprops = GLOBAL.available_models.detection.filter(
            (m) => (m.name == modelname)
        )[0]?.properties
        
        return modelprops?.known_classes ?? []
    }
}
