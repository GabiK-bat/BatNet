

BatSorting = class extends BaseSorting {
    static on_table_header(event){
        const column_index = super.on_table_header(event)
        if(column_index==1)
            this.on_sort_by_number(event)
        if(column_index==2)
            this.on_sort_by_confidence(event)
    }
    
    //called when user clicks on "Flags" column head
    static on_sort_by_confidence(event){
        const $col      = $(event.target);
        const direction = $col.hasClass('ascending')? 'descending' : 'ascending';
        this._clear_sorted()
        $col.addClass(['sorted', direction]);
        
        let   filenames   = Object.keys(GLOBAL.files)
        const predictions = filenames.map(f => GLOBAL.files[f].results.predictions)
        const confidences = predictions.map(  P => P.map(  p => Object.values(p).reduce( (r,c) => Math.max(r,c) )  )  )  //ugh
        //lowest confidence level per filename
        let   worstconf   = confidences.map( x => x.reduce( (x,carry) => Math.min(x, carry), 100 ) )
        
        //sort by the lowest confidence
        const order       = arange(worstconf.length).sort( (a,b) => (worstconf[b] - worstconf[a]) )
        filenames         = order.map(i => filenames[i]);
        if(direction == 'ascending')
            filenames = filenames.reverse()
        
        this.set_new_file_order(filenames)
    }
    
    //called when user clicks on "Detected Bats" column head
    static on_sort_by_number(event){
        const $col       = $(event.target);
        const direction  = $col.hasClass('ascending')? 'descending' : 'ascending';
        this._clear_sorted()
        $col.addClass(['sorted', direction]);
        
        let   filenames   = Object.keys(GLOBAL.files)
        const labels      = filenames.map(f => GLOBAL.files[f].results.labels)
        const order       = argsort_string_arrays(labels)
        filenames         = order.map(i => filenames[i]);
        if(direction=='ascending')
            filenames = filenames.reverse()
        
        this.set_new_file_order(filenames)
    }
}



/** Sort indices for string[][], primarily by array length, secondarily alphabetically,
 *  order-independent within an array. */
function argsort_string_arrays(arrays) {
    return arrays
      .map((x, i) => [x, i])
      .sort(([a], [b]) => {
        if(a.length !== b.length)
            return b.length - a.length;
        return [...a].sort().join("\0").localeCompare([...b].sort().join("\0"));
      })
      .map(([, i]) => i);
}
    
  