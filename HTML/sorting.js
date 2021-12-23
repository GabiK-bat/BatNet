

//called when user clicks on "Filename" column head
function on_sort_by_filename(e){
    var $col      = $(e.target);
    var direction = $col.hasClass('ascending')? 'descending' : 'ascending';
    _clear_sorted()
    $col.addClass(['sorted', direction]);

    var filenames = Object.keys(global.input_files).sort()
    if(direction=='descending')
        filenames = filenames.reverse()
    
    set_new_file_order(filenames)
}

//called when user clicks on "Detected Bats" column head
function on_sort_by_number(e){
    var $col      = $(e.target);
    var direction = $col.hasClass('ascending')? 'descending' : 'ascending';
    _clear_sorted()
    $col.addClass(['sorted', direction]);

    var filenames   = Object.keys(global.input_files)
    var labels      = filenames.map(f => get_selected_labels(f, 'none'))
    //sort by number of labels in each file
    var order       = arange(labels.length).sort( (a,b) => (labels[b].length - labels[a].length) )
    filenames       = order.map(i => filenames[i]);
    if(direction=='ascending')
        filenames = filenames.reverse()

    set_new_file_order(filenames)
}

//called when user clicks on "Flags" column head
function on_sort_by_confidence(e){
    var $col      = $(e.target);
    var direction = $col.hasClass('ascending')? 'descending' : 'ascending';
    _clear_sorted()
    $col.addClass(['sorted', direction]);

    var filenames   = Object.keys(global.input_files)
    var confidences = filenames.map(f => get_selected_labels(f, 'separate')).map( x => x.map(y => y[1]) )
    //lowest confidence level per filename
    var worstconf  = confidences.map( x => x.reduce( (x,carry) => Math.min(x, carry), 100*(x.length>0) ) )
    //sort by the lowest confidence
    var order       = arange(worstconf.length).sort( (a,b) => (worstconf[b] - worstconf[a]) )
    filenames       = order.map(i => filenames[i]);
    if(direction=='ascending')
        filenames = filenames.reverse()

    set_new_file_order(filenames)
}


function set_new_file_order(filenames){
    var rows = filenames.map( f => $(`#filetable tr[filename="${f}"]`) );
    $('#filetable tbody').append(rows);
    global.input_files = sortObject(global.input_files, filenames);
}


function _clear_sorted(){
    $('#filetable .sorted').removeClass(['sorted', 'ascending', 'descending']);
}
