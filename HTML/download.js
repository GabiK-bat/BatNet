
function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
  
function on_download_csv(){
    if(Object.keys(global.input_files).length==0){
        $('#download-csv-button').popup({on       : 'manual',
                                        position : 'bottom center',
                                        delay    : {'show':0, 'hide':0}, duration:0,
                                        content  : 'Nothing to download'}).popup('show');
        return;
    }
        
    if(Object.keys(global.metadata).length==0 && !$('#download-csv-button').popup('is visible')){
        $('#download-csv-button').popup({on       : 'manual',
                                            position : 'left center',
                                            target   : '#metadata-button',
                                            title    : 'Missing Metadata',
                                            delay    : {'show':0, 'hide':0}, duration:0,
                                            content  : 'Click again to download anyway'}).popup('show');
        return;
    }


    csvtxt = '';
    for(key of Object.keys(global.metadata)){
        csvtxt += '#'+key+':'+global.metadata[key].replace(/\n/g,'\n#')+'\n';
    }
    for(filename of Object.keys(global.input_files)){
        selectedlabels = get_selected_labels(filename);
        flagged  = global.input_files[filename].flag.length>0? 'flagged' : '       ';
        datetime = global.input_files[filename].datetime;
        datetime = datetime? datetime : "                   ";
        csvtxt+= [filename, datetime, flagged].concat(selectedlabels).join(', ')+';\n'
        }

    if(!!csvtxt)
        download('detected_bats.csv', csvtxt)
}




labelme_template = {
    //version: "3.16.2",
    flags: {},
    shapes: [    ],
    lineColor: [ 0, 255, 0, 128 ],
    fillColor: [255,  0, 0, 128 ],
    imagePath: "",
    imageData: null,
    imageHeight: 3456,
    imageWidth : 4608,
}

labelme_shape_template = {
    label: "Myotis bechstenii",
    line_color: null,
    fill_color: null,
    points: [ [ 2297.6377952755906, 2039.3700787401574 ],
              [ 3204.7244094488187, 2317.3228346456694 ] ],
    shape_type: "rectangle",
    flags: {}
}


function create_json_from_predictions(filename){
    var f        = global.input_files[filename];
    var jsondata = deepcopy(labelme_template);
    jsondata.imagePath = filename;
    var height   = EXIF.getTag(f.file, "PixelYDimension");
    var width    = EXIF.getTag(f.file, "PixelXDimension");
    jsondata.imageHeight = height;
    jsondata.imageWidth  = width;

    for(r of Object.values(f.results)){
        var jsonshape    = deepcopy(labelme_shape_template);
        jsonshape.label  = get_selected_label(r);
        if(jsonshape.label=="")
            continue;
        jsonshape.points = [ [r.box[1]*width, r.box[0]*height], [r.box[3]*width, r.box[2]*height] ];
        jsondata.shapes.push(jsonshape);
    }
    return jsondata;
}


async function on_download_labelme(){
    for(filename of Object.keys(global.input_files)){
        var jsondata     = create_json_from_predictions(filename);
        var jsonfilename = filebasename(filename)+'.json';
        download(jsonfilename, JSON.stringify(jsondata, null, 2));
        //sleep for a few milliseconds because browsers do not allow more than 10 simulataneous downloads
        await sleep(250);
    }
}

