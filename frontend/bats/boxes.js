

BatBoxes = class extends BaseBoxes {
    //override
    static NEGATIVE_CLASS_NAME = 'Not-A-Bat'

    //TODO: unify
    //override
    static get_set_of_all_labels() {
        let all_labels = []
        for(const f of Object.values(GLOBAL.files)){
            all_labels = all_labels.concat(f.results.labels)
        }
        let uniques = new Set(all_labels)
            uniques.delete('')
            uniques.delete(this.NEGATIVE_CLASS_NAME)
        return [this.NEGATIVE_CLASS_NAME].concat([...uniques].sort())
    }
}
