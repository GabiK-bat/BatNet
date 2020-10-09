
global = {
  input_files : {},      //{"banana.JPG": FILE}
  //per_file_results : {}, //{0:{prediction:['Mnat':1.0], custom:'', selected:0},...}
  metadata    : {},

  cancel_requested : false,
  settings         : {},
  active_mode      : 'inference',     //'inference' or 'training'
};


const FILE = {name: '',
              file: undefined,    //javascript file object
              flag: [],           //['lowconf', 'multiple', 'empty']
              results: {},
              processed: false,
};

const RESULT = { prediction: {},      //{label:score}
                 custom:     '',
                 selected:    0,      //index of the selected label in prediction, if -1 then custom
                 box:         [0,0,1,1],
};










function update_inputfiles_list(){
  $filestable = $('#filetable');
  $filestable.find('tbody').html('');
  for(f of Object.values(global.input_files)){
      $("#filetable-item-template").tmpl([{filename:f.name}]).appendTo($filestable.find('tbody'));
      update_per_file_results(f.name);
  }
}


function set_input_files(files){
  global.input_files = {};
  global.metadata    = {};
  //global.per_file_results = {};
  for(f of files)
    global.input_files[f.name] = Object.assign({}, deepcopy(FILE), {name: f.name, file: f});
  update_inputfiles_list();

  for(f of files){
      EXIF.getData(f, function() {
        global.input_files[this.name].datetime = EXIF.getTag(this, "DateTime");
    });
  }
}

function on_inputfiles_select(input){
  set_input_files(input.target.files);
}

function on_inputfolder_select(input){
  files = [];
  for(f of input.files)
    if(f.type.startsWith('image'))
        files.push(f);
  set_input_files(files);
}


//uploads the image file to the flask server and creates the ui element in the accordion
function upload_file(file){
  return upload_file_to_flask('file_upload', file);
}


function sortObjectByValue(o) {
    return Object.keys(o).sort(function(a,b){return o[b]-o[a]}).reduce((r, k) => (r[k] = o[k], r), {});
}

function build_result_details(filename, result, index){
  var label_probabilities = result.prediction;
  var resultbox = $("#result-details-template").tmpl([{filename:filename,
                                                   label:JSON.stringify(label_probabilities),
                                                   time:new Date().getTime(),
                                                   index:index}]);
  console.log(label_probabilities);
  var keys=Object.keys(label_probabilities);
  for(i in keys){
    lbl = keys[i];
    cbx = $("#checkbox-confidence-template").tmpl([{label: lbl? lbl : "Not A Bat",
                                                    index: i}]);
    cbx.find(".progress").progress({percent: label_probabilities[lbl]*100,
                                    showActivity: false, autoSuccess:false});
    cbx.removeClass('active');
    cbx.appendTo(resultbox.find(`table`));
  }
  //set the custom label
  resultbox.find('input[name="new-label"]')[0].value = result.custom;
  //check the checkbox that is marked as selected in the result
  resultbox.find(`.checkbox[index="${result.selected}"]`).checkbox('set checked');

  //callback that makes sure that only one checkbox in the table is active
  resultbox.find('.checkbox').checkbox({onChange:function(){
    $(this).closest('table').find('.checkbox').checkbox('set unchecked');
    $(this).parent().checkbox('set checked');
    global.input_files[filename].results[index].selected = $(this).parent().attr('index');
    update_per_file_results(filename, true);
    console.log(filename + ":"+index + ":" + $(this).parent().attr('index'));
  }});

  add_box_overlay_highlight_callback(resultbox);
  return resultbox;
}


//returns the label (maybe custom) that is has the corresponding checkbox set in the resultdetailsbox
function get_selected_label(result){
  return (result.selected>=0)? Object.keys(result.prediction)[result.selected] : result.custom;
}

//returns all selected labels for a file, filtering ''/nonbats
function get_selected_labels(filename){
  results = global.input_files[filename].results;
  selectedlabels = Object.values(results).map(get_selected_label);
  selectedlabels = selectedlabels.filter(Boolean);
  return selectedlabels;
}

function update_per_file_results(filename, main_table_only=false){
  //refresh the gui for one file
  results = global.input_files[filename].results;

  if(!main_table_only){
    var contentdiv    = $(`.filelist-item-content[filename="${filename}"]`).find('.patches');
    var newcontentdiv = contentdiv.clone();
    newcontentdiv.html('');
    for(i in results)
      build_result_details(filename, results[i], i).appendTo(newcontentdiv);
    contentdiv.replaceWith(newcontentdiv);
  }

  //display only the labels marked as selected in the main table
  selectedlabels = get_selected_labels(filename);
  $(`.table-row[filename="${filename}"]`).find(`.table-cell-detected`).html(selectedlabels.join(', '));

  set_flag(filename, global.input_files[filename].flag)
}


function remove_all_predictions_for_file(filename){
  for(var i in global.input_files[filename].results)
    remove_prediction(filename, i);
  //global.input_files[filename].processed = false;
  set_processed(filename, false);
  set_flag(filename, false);
  //TODO: file icon
}

function remove_prediction(filename, index){
  //remove prediction from global data
  delete global.input_files[filename].results[index];
  //remove all result-details boxes (individually and not with update_per_file_results for speed)
  $(`.result-details[filename="${filename}"][index="${index}"]`).detach();
  //update the detected pollen in the filelist table
  update_per_file_results(filename, true);
  remove_box_overlay(filename, index);
}

//callback when the user clicks on the remove button in a result box
function on_remove_prediction(e){
  //get the corresponding result details box
  $resultdetailbox = $(e.target).closest('.result-details')
  //get the filename
  filename = $resultdetailbox.attr('filename');
  //get the index of prediction within the file
  index = $resultdetailbox.attr('index');

  remove_prediction(filename, index);
}



//callback when the user enters into the custom label input in a result box
function on_custom_label_input(e){
  //get the filename
  filename = $(e.target).closest('[filename]').attr('filename');
  //get the index of prediction within the file
  index = $(e.target).closest('.result-details').attr('index');
  //set the checkbox (in case it isnt yet)
  $resultdetailbox = $(`.result-details[filename="${filename}"][index="${index}"]`);
  $resultdetailbox.find('.checkbox[index="-1"]').click();
  e.target.focus();
  //update global state
  global.input_files[filename].results[index].custom = e.target.value;
  //update gui
  update_per_file_results(filename, true);
}

function add_new_prediction(filename, prediction, box, i){
  //sort labels by probability
  prediction = sortObjectByValue(prediction);
  selection  = Object.keys(prediction).length>0? 0 : -1;
  global.input_files[filename].results[i] =  {prediction:prediction, custom:'', selected:selection, box:box};

  //add box overlay
  add_box_overlay(filename, box, i);
}

function set_flag(filename, value){
  if(value==true)  value=['lowconf'];  //legacy
  if(value==false) value=[];
  global.input_files[filename].flag = value;

  //show or hide flag
  var $flag_icon = $(`.table-row[filename="${filename}"]`).find('.flag.icon');
  if(value.indexOf('empty')>=0)
    $flag_icon.addClass('outline');
  if(value.indexOf('multiple')>=0)
    $flag_icon.addClass('checkered');
  
  if(value.length>0) $flag_icon.show();
  else               $flag_icon.hide();
}


function set_predictions_for_file(filename, labels, boxes, flag){
  remove_all_predictions_for_file(filename)
  for(var i in labels)
      add_new_prediction(filename, labels[i], boxes[i], i);
  set_flag(filename, flag);
  //refresh gui
  update_per_file_results(filename);
  //global.input_files[filename].processed=true;
  set_processed(filename, true);
}

function process_file(filename){
  upload_file(global.input_files[filename].file);
  //send a processing request to python, callback updates gui with the results
  return $.get(`/process_image/${filename}`).done(function(data){
      set_predictions_for_file(filename, data.labels, data.boxes, data.flag);
      delete_image(filename);
    });
}

//sends request to the flask server to remove the image file from temporary folder
function delete_image(filename){
  $.get(`/delete_image/${filename}`);
}


function load_full_image(filename){
  var imgelement              = $(`.filelist-item-content[filename="${filename}"]`).find(`img`)[0];
  var file                    = global.input_files[filename].file;
  imgelement.src              = URL.createObjectURL(file);
}

//sets src of the main image in an accordion content on click to avoid loading all images at once
function on_accordion_open(x){
  var contentdiv              = this.find('.content');
  var filename                = contentdiv.attr('filename');
  load_full_image(filename);
}


function on_process_image(e){
  var filename = $(e.target).closest('[filename]').attr('filename');
  process_file(filename);
}

function process_all(){
  $button = $('#process-all-button')

  j=0;
  async function loop_body(){
    if(j>=Object.values(global.input_files).length || global.cancel_requested ){
      $button.html('<i class="play icon"></i>Process All Images');
      $('#cancel-processing-button').hide();
      return;
    }
    $('#cancel-processing-button').show();
    $button.html(`Processing ${j}/${Object.values(global.input_files).length}`);

    var f = Object.values(global.input_files)[j];
    //if(!f.processed)  //re-processing anyway, the model may have been retrained
      await process_file(f.name);

    j+=1;
    setTimeout(loop_body, 1);
  }
  global.cancel_requested = false;
  setTimeout(loop_body, 1);  //using timeout to refresh the html between iterations
}

//called when user clicks on the cancel button
//can mean cancel processing or cancel retraining
function cancel_processing(){
  global.cancel_requested = true;
}







function on_flag(e){
  e.stopPropagation();
  filename = $(e.target).closest('[filename]').attr('filename');
  //toggle
  if(global.input_files[filename].flag.length==0) set_flag(filename, ['lowconf']);
  else                                            set_flag(filename, []);
  update_per_file_results(filename, true);
}



//callback from the plus-icon in the upper right corner of an image
function on_add_custom_box_button(e){
  $etarget = $(e.target)
  var $image_container = $etarget.closest('.filelist-item-content').find('.image-container')
  var filename         = $etarget.closest('[filename]').attr('filename');

  $etarget.toggleClass('active');
  if($etarget.hasClass('active')){
    $etarget.addClass('blue');
    register_box_draw($image_container, function(box){add_custom_box(filename, box)});
    $image_container.find('img').css({'cursor':'crosshair'})
  }else{
    $etarget.removeClass('blue');
    $image_container.off('mousedown');
    $image_container.off('mouseup');
    $image_container.find('img').css({'cursor':'default'})
  }
  e.stopPropagation();
}


//called after drawing a new box; sends request to flask to crop a patch
function add_custom_box(filename, box, labels={}){
  console.log('NEW BOX', filename, box);
  upload_file(global.input_files[filename].file);
  
  var i = 1000+Math.max(0, Math.max(...Object.keys(global.input_files[filename].results)) +1);
  $.get(`/custom_patch/${filename}?box=[${box}]&index=${i}`).done(function(){
    console.log('custom_patch done');
    add_new_prediction(filename, labels, box, i)
    update_per_file_results(filename);
    delete_image(filename);
  });
}




//called when user selected JSON files (in the 'File' menu)
function on_training_json_select(input){
  console.log(input.target.files);
  for(jsonfile of input.target.files){
    var jsonbasename = filebasename(jsonfile.name);
    for(inputfile of Object.values(global.input_files)){
      if(filebasename(inputfile.name) == jsonbasename){
        console.log('Matched json for input file ',inputfile.name);

        //indicate in the file table that a mask is available
        //var $tablerow = $(`.ui.title[filename="${inputfile.name}"]`)
        //$tablerow.find('.has-mask-indicator').show();
        //$tablerow.find('.image.icon').attr('class', 'image violet icon');

        load_json_annotation(jsonfile, inputfile.name);
      }
    }
  }
}


async function load_json_annotation(jsonfile, jpgfile){
  console.log('Loading JSON file: ',jsonfile.name);
  
  await load_full_image(jpgfile);  //needed for naturalHeight/Width
  var freader = new FileReader();
  freader.onload = (ev) => { 
    var jsondata = JSON.parse(ev.target.result); 
    var labels = [], boxes = [];
    var imgelement         = $(`.filelist-item-content[filename="${jpgfile}"]`).find(`img`)[0];
    remove_all_predictions_for_file(jpgfile);
    for(var shape of jsondata.shapes){
      labels.push( {[shape.label]:1} )
      boxes.push( [Math.min(shape.points[0][1], shape.points[1][1])/imgelement.naturalHeight,
                   Math.min(shape.points[0][0], shape.points[1][0])/imgelement.naturalWidth,
                   Math.max(shape.points[0][1], shape.points[1][1])/imgelement.naturalHeight,
                   Math.max(shape.points[0][0], shape.points[1][0])/imgelement.naturalWidth ] );
      add_custom_box(jpgfile, boxes[boxes.length-1], labels[labels.length-1]);
    }
    set_processed(jpgfile, 'json');
    //set_predictions_for_file(jpgfile, labels, boxes, false);
  };
  freader.readAsText(jsonfile);
}


//called when user pressed the "Retrain" button
function on_retrain(){
  //collect files with predictions
  var files = Object.values(global.input_files).filter(x => x.processed);
  if(files.length==0)
    return;  //TODO: show message that no files for training are available

  //upload images and json files (generated from predictions)
  for(var f of files){
    var json = create_json_from_predictions(f.name);
    upload_textfile('/file_upload', filebasename(f.name)+'.json', JSON.stringify(json));
    upload_file(f.file);
  }

  var filenames = files.map(x => x.name);
  $.post('/start_training', {'filenames':filenames});
  //show cancel button
  $('#cancel-processing-button').show();

  function progress_polling(){
    $.get(`/retraining_progress`, function(data) {
        
        $retrain_button = $(`#retrain-button`);
        $retrain_button.html(`<div class="ui active tiny inline loader"></div> Retraining...${Math.round(data*100)}%`);
        if(data<1 && !global.cancel_requested)
          setTimeout(progress_polling,1000);
        else{
          $.get('/stop_training');
          $retrain_button.html('<i class="redo alternate icon"></i>Retrain')
          $('#cancel-processing-button').hide();
        }
    });
  }
  global.cancel_requested = false;
  setTimeout(progress_polling,1000);
}


function set_processed(filename, value){
  var $tablerow = $(`.ui.title[filename="${filename}"]`);
  var $icon     = $tablerow.find('.image.icon');
  if(!value){
    $icon.attr('class', 'image outline icon');
    $icon.attr('title', 'File not yet processed');
  }
  else if(value=='json'){
    $icon.attr('class', 'image violet icon');
    $icon.attr('title', 'Labels loaded from JSON file');
  }
  else if(!!value){
    $icon.attr('class', 'image icon');
    $icon.attr('title', 'File processed');
  }
  global.input_files[filename].processed = !!value;
}