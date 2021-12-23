
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


    var export_boxes = global.settings.export_boxes;
    var csvtxt = '';
    csvtxt += 'File_name;Date;Time;Flag;Multiple;Species;Code;Confidence_level;'
    if(export_boxes)
        csvtxt += 'Box;'
    csvtxt += '\n'

    for(var key of Object.keys(global.metadata)){
        csvtxt += '#'+key+':'+global.metadata[key].replace(/\n/g,'\n#')+'\n';
    }

    for(var filename of Object.keys(global.input_files)){
        var selectedlabels = get_selected_labels(filename, 'separate');

        var flags    = compute_flags(filename);
        var multiple = flags.indexOf('multiple')!=-1? 'multiple' : flags.indexOf('empty')!=-1? 'empty' : '';
        var unsures  = compute_flags(filename, true);
        var datetime = global.input_files[filename].datetime;
        datetime     = datetime? datetime : "";
        var date     = datetime.substring(0,10).replace(':','.').replace(':','.');
        var time     = datetime.substring(11);

        if(selectedlabels.length==0){
                             //fname, date,time,unsure,multi,species,code
            csvtxt       += [filename, date, time, '', multiple, '', ''].join(';')+';'
            if(export_boxes)
                csvtxt   += ';'
            csvtxt       += '\n'
            continue;
        }
        for(var i in selectedlabels){
            var label     = selectedlabels[i][0];
            var conf      = (selectedlabels[i][1]/100).toFixed(2);
            var code      = (label in SPECIES_CODES)? SPECIES_CODES[label] : '';
            csvtxt       += [filename, date, time, unsures[i], multiple, label, code, conf].join(';')+';'
            if(export_boxes){
                var box  = Object.values(global.input_files[filename].results)[i].box;  //ugly
                csvtxt   += `${box[1].toFixed(5)} ${box[0].toFixed(5)} ${box[3].toFixed(5)} ${box[2].toFixed(5)};`
            }
            csvtxt       += '\n';
        }
    }

    if(!!csvtxt)
        download('detected_bats.csv', csvtxt)
}

const SPECIES_CODES = {
    'Barbastella barbastellus' :            'Bbar',
    'Eptesicus serotinus':                  'Eser',
    'Myotis mystacinus/Myotis brandtii/Myotis alcathoe' : 'Mbart',
    'Myotis bechsteinii':                   'Mbec',
    'Myotis dasycneme':                     'Mdas',
    'Myotis daubentonii':                   'Mdau',
    'Myotis emarginatus':                   'Mema',
    'Myotis myotis/Myotis blythii':         'Mmyo',
    'Myotis nattereri':                     'Mnat',
    'Nyctalus noctula':                     'Nnoc',
    'Plecotus auritus/Plecotus austriacus': 'Paur',
    'Pipistrellus sp.':                     'Pip',
    'Rhinolophus ferrumequinum':            'Rfer',
    'Rhinolophus sp.':                      'Rsp',
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
    var width  = global.input_files[filename].size[0];
    var height = global.input_files[filename].size[1];
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

