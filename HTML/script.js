
global = {
  input_files : {},      //{"banana.JPG": FILE}
  metadata    : {},

  cancel_requested : false,
  settings         : {},              //SETTINGS
  active_mode      : 'inference',     //'inference' or 'training'
};


const FILE = {name: '',
              file: undefined,    //javascript file object
              results: {},
              processed: false,
              magnifier: undefined, //inactive if undefined
              manual_flags: false,  //set by user click
};

const RESULT = { prediction: {},      //{label:score}
                 custom:     '',
                 selected:    0,      //index of the selected label in prediction, if -1 then custom
                 box:         [0,0,1,1],
};




const SETTINGS = {
  models               : [],
  active_model         : '',
  confidence_threshold : 75,
};
global.settings = deepcopy(SETTINGS);





//rebuilds the list of files, called when new files are selected
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
async function upload_file(file){
  await upload_file_to_flask('file_upload', file);
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
    //console.log(filename + ":"+index + ":" + $(this).parent().attr('index'));
  }});

  add_box_overlay_highlight_callback(resultbox);
  return resultbox;
}


//returns the label (maybe custom) that is has the corresponding checkbox set in the resultdetailsbox
function get_selected_label(result){
  return (result.selected>=0)? Object.keys(result.prediction)[result.selected] : result.custom;
}

//returns all selected labels for a file, filtering ''/nonbats
function get_selected_labels(filename, append_confidence=true){
  var results = global.input_files[filename].results;
  //var selectedlabels = Object.values(results).map(get_selected_label);
  //selectedlabels = selectedlabels.filter(Boolean);
  var selectedlabels = [];
  for(var r of Object.values(results)) {
    var label = get_selected_label(r);
    if(label!='' && append_confidence){
      var score = (r.selected>=0)? Math.round(100*r.prediction[label]) : 100;
      label = label + ` (${score}%)`;
      selectedlabels.push(label);
    }
  }
  return selectedlabels;
}

//refresh the gui for one file
function update_per_file_results(filename, main_table_only=false){
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

  update_flags(filename);
}


function compute_flags(filename){
  var flags   = []
  var results = global.input_files[filename].results;
  var lowconf = false;
  var amount   = 0;
  for(var r of Object.values(results) ){
    var _lowconf = (Object.values(sortObjectByValue(r.prediction))[0] <= global.settings.confidence_threshold/100);
    if( _lowconf ){
      lowconf = true;
    }
    if(! (r.prediction[''] > global.settings.confidence_threshold/100) ){
      amount += 1;
    }
  }
  lowconf = lowconf ^ global.input_files[filename].manual_flags;
  if(lowconf)
    flags.push('unsure');

  //var amount = Object.keys(results).length;
  if(amount==0 && global.input_files[filename].processed)
    flags.push('empty');
  else if(amount>1 && global.input_files[filename].processed)
    flags.push('multiple');
  
  return flags;
}

function update_flags(filename){
  var flags = compute_flags(filename);
  var $flag_icon = $(`.table-row[filename="${filename}"]`).find('.lowconf-flag');
  $flag_icon.css('visibility', flags.indexOf('unsure')!=-1? 'visible' : 'hidden')  //hide()/show() changes layout

  var empty      = flags.indexOf('empty')!=-1;
  var multiple   = flags.indexOf('multiple')!=-1;
  var $flag_icon = $(`.table-row[filename="${filename}"]`).find('.amounts-flag');
  $flag_icon.css('visibility', (empty||multiple)? 'visible' : 'hidden')
  if(empty){
    $flag_icon.addClass('outline');         //empty
    $flag_icon.removeClass('checkered');
    $flag_icon.attr('title', 'No detections');
  } else if(multiple) {
    $flag_icon.addClass('checkered');      //multiple
    $flag_icon.removeClass('outline');
    $flag_icon.attr('title', 'Multiple detections');
  }
}


//called when user clicks on a flag icons to remove them
function on_flag(e){
  e.stopPropagation();
  var filename = $(e.target).closest('[filename]').attr('filename');
  //toggle
  var flags_before = global.input_files[filename].manual_flags;
  global.input_files[filename].manual_flags = !flags_before;
  update_per_file_results(filename, true);
}


function remove_all_predictions_for_file(filename){
  for(var i in global.input_files[filename].results)
    remove_prediction(filename, i);
  set_processed(filename, false);
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


function set_predictions_for_file(filename, labels, boxes){
  remove_all_predictions_for_file(filename)
  for(var i in labels)
      add_new_prediction(filename, labels[i], boxes[i], i);
  set_processed(filename, true);
  //refresh gui
  update_per_file_results(filename);
}

function process_file(filename){
  upload_file(global.input_files[filename].file);
  set_processed(filename, false);
  //send a processing request to python, callback updates gui with the results
  return $.get(`/process_image/${filename}`).done(function(data){
      set_predictions_for_file(filename, data.labels, data.boxes);
      delete_image(filename);
    });
}

//sends request to the flask server to remove the image file from temporary folder
function delete_image(filename){
  return $.get(`/delete_image/${filename}`);
}


function _load_full_image(filename){
  var imgelement              = $(`.filelist-item-content[filename="${filename}"]`).find(`img`)[0];
  var file                    = global.input_files[filename].file;
  imgelement.src              = URL.createObjectURL(file);
}

function load_full_image(filename){
  const promise = new Promise((resolve, reject) => {
    var imgelement              = $(`.filelist-item-content[filename="${filename}"]`).find(`img`)[0];
    var file                    = global.input_files[filename].file;
    imgelement.onload           = (ev) => {
      resolve();
    }
    imgelement.src              = URL.createObjectURL(file);
  });
  return promise;
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
function add_custom_box(filename, box, labels={}, i=undefined){
  console.log('NEW BOX', filename, box);
  //var file = rename_file(global.input_files[filename].file, filename)
  var file = global.input_files[filename].file;
  upload_file(file);
  
  if(i==undefined)
      i = 1000+Math.max(0, Math.max(...Object.keys(global.input_files[filename].results)) +1);
  console.log('CUSTOM PATCH REQUEST', filename)
  return $.get(`/custom_patch/${filename}?box=[${box}]&index=${i}`).then(async function(){
    add_new_prediction(filename, labels, box, i)
    update_per_file_results(filename);
    console.log('DELETE FILE REQUEST', filename)
    await delete_image(filename);
  });
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



//called when user clicks the zoom icon in the top right corner of an image
function on_zoom_button(ev){
  var containerdiv = $(ev.target).closest(`[filename]`);
  var filename     = containerdiv.attr("filename");

  if(global.input_files[filename].magnifier == undefined){
    //magnifier is not yet active, activate
    var img          = containerdiv.find('.image-container').find('img');
    img.attr("data-magnify-src", img.attr("src"));
    var magnifier = img.magnify();
    global.input_files[filename].magnifier = magnifier;
    //add blue color to the icon to indicate that magnifier is active
    $(ev.target).addClass("blue");
  }
  else{
    //magnifier is already active, remove
    global.input_files[filename].magnifier.destroy();
    global.input_files[filename].magnifier = undefined;
    //remove blue color to the icon to indicate that magnifier is inactive
    $(ev.target).removeClass("blue");
  }
}