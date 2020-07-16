
global = {
  input_files : {},      //{"banana.JPG": FILE}
  //per_file_results : {}, //{0:{prediction:['Mnat':1.0], custom:'', selected:0},...}
  metadata    : {},

  cancel_requested : false,
  
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








deepcopy = function(x){return JSON.parse(JSON.stringify(x))};


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


function upload_file(file){
  var formData = new FormData();
  formData.append('files', file );
  result = $.ajax({
      url: 'file_upload',      type: 'POST',
      data: formData,          async: false,
      cache: false,            contentType: false,
      enctype: 'multipart/form-data',
      processData: false,
  }).done(function (response) {
    target  = $(`td.content[filename="${file.name}"]`);
    if(target.html().trim().length>0)
      //only do this once
      return;

    target.html('');
    content = $("#filelist-item-content-template").tmpl([{filename:file.name}]);
    content.appendTo(target);
    content.find('.ui.dimmer').dimmer({'closable':false}).dimmer('show');
  });
  return result;
}

function escapeSelector(s){  return s.replace( /(:|\.|\[|\])/g, "\\$1" ); }

function sortObjectByValue(o) {
    return Object.keys(o).sort(function(a,b){return o[b]-o[a]}).reduce((r, k) => (r[k] = o[k], r), {});
}

function build_result_details(filename, result, index){
  label_probabilities = result.prediction;
  resultbox = $("#result-details-template").tmpl([{filename:filename,
                                                   label:JSON.stringify(label_probabilities),
                                                   time:new Date().getTime(),
                                                   index:index}]);
  console.log(label_probabilities);
  keys=Object.keys(label_probabilities);
  for(i in keys){
    lbl = keys[i];
    cbx = $("#checkbox-confidence-template").tmpl([{label: lbl? lbl : "Not A Bat",
                                                    index: i}]);
    cbx.find(".progress").progress({percent: label_probabilities[lbl]*100,
                                    showActivity: false, autoSuccess:false});
    cbx.removeClass('active');
    cbx.appendTo(resultbox.find(`table`));
  }
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
function get_selected_label(x){
  return (x.selected>=0)? Object.keys(x.prediction)[x.selected] : x.custom;
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
    contentdiv = $(escapeSelector(`#patches_${filename}`));
    newcontentdiv = contentdiv.clone();
    newcontentdiv.html('');
    for(i in results)
      build_result_details(filename, results[i], i).appendTo(newcontentdiv);
    contentdiv.replaceWith(newcontentdiv);
  }

  //display only the labels marked as selected in the main table
  selectedlabels = get_selected_labels(filename);
  $(escapeSelector(`#detected_${filename}`)).html(selectedlabels.join(', '));

  set_flag(filename, global.input_files[filename].flag)
}


function remove_prediction(filename, index){
  //remove prediction from global data
  delete global.input_files[filename].results[index];
  //remove all result-details boxes (one in the filelist and maybe one in low-confidence list)
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
  if(value==true)  value=['lowconf'];
  if(value==false) value=[];
  global.input_files[filename].flag = value;

  //show or hide flag
  var $flag_icon = $(`[id="flag_${filename}"]`);
  if(value.indexOf('empty')>=0)
    $flag_icon.addClass('outline');
  if(value.indexOf('multiple')>=0)
    $flag_icon.addClass('checkered');
  
  if(value.length>0) $flag_icon.show();
  else               $flag_icon.hide();
}

function process_file(filename){
  upload_file(global.input_files[filename].file);
  //send a processing request to python, callback updates gui with the results
  return $.get(`/process_image/${filename}`).done(function(data){
      $(escapeSelector(`#segmented_${filename}`)).attr('src', "/images/segmented_"+filename);
      $(escapeSelector(`#dimmer_${filename}`)).dimmer('hide');

      for(i in data.labels)
          add_new_prediction(filename, data.labels[i], data.boxes[i], i);
      set_flag(filename, data.flag);
      //refresh gui
      update_per_file_results(filename);

      global.input_files[filename].processed=true;
      delete_image(filename);
    });
}

function delete_image(filename){
  $.get(`/delete_image/${filename}`);
}


function on_accordion_open(x){
  target     = this;
  contentdiv = this.find('.content');
  if(contentdiv[0].innerHTML.trim())
    return;
  filename   = contentdiv.attr('filename');
  file       = global.input_files[filename].file;
  upload_file(file);
}


function on_process_image(e){
  filename = e.target.attributes['filename'].value;
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

    f = Object.values(global.input_files)[j];
    if(!f.processed)
      await process_file(f.name);

    j+=1;
    setTimeout(loop_body, 1);
  }
  global.cancel_requested = false;
  setTimeout(loop_body, 1);  //using timeout to refresh the html between iterations
}

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






function save_settings(_){
  flag_confidence = $('#settings_flag_confidence').val();
  flag_no_preds   = $('#settings_flag_no_predictions').val();
  flag_multiple   = $('#settings_flag_many_predictions').val();
  
  
  $.post(`/settings?flag_confidence=${flag_confidence}`);
}

function on_settings(){
  $('#settings-dialog').modal({onApprove: save_settings}).modal('show');
}

function load_settings(){
  $.get('/settings').done( function(settings){
    settings = JSON.parse(settings);
    $('#settings_magnification').val(settings.magnification);
  } );
}



function save_metadata(_){
  meta = {'Site Name':            $('#input_site_name').val(),
          'Site Location':        $('#input_site_location').val(),
          'Site Responsible':     $('#input_site_responsible').val(),
          'Country':              $('#input_country').val(),
          'Latitude':             $('#input_latitude').val(),
          'Longitude':            $('#input_longitude').val(),
          'Camera ID':            $('#input_camera_id').val(),
          'Other':                $('#input_other').val(),};
  console.log("Metadata: "+JSON.stringify(meta));
  global.metadata = meta;
}

function on_metadata(){
  $('#metadata-dialog').modal({onApprove: save_metadata}).modal('show');
}


//callback from the plus-icon in the upper right corner of an image
function on_add_custom_box_button(e){
  $etarget = $(e.target)
  var $image_container = $etarget.closest('.dimmable').find('.image-container')
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


//called after drawing a new box
function add_custom_box(filename, box){
  console.log('NEW BOX', filename, box);
  upload_file(global.input_files[filename].file);
  
  i = 1000+Math.max(0, Math.max(...Object.keys(global.input_files[filename].results)) +1);
  $.get(`/custom_patch/${filename}?box=[${box}]&index=${i}`).done(function(){
    console.log('custom_patch done');
    add_new_prediction(filename, {}, box, i)
    update_per_file_results(filename);
    delete_image(filename);
  });
}

//
