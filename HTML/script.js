
global = {
  input_files : {},
  per_file_results : {},
};



function update_inputfiles_list(){
  $filestable = $('#filetable');
  $filestable.find('tbody').html('');
  for(f of Object.values(global.input_files))
      $("#filetable-item-template").tmpl([{filename:f.name}]).appendTo($filestable.find('tbody'));
}


function set_input_files(files){
  global.input_files = {};
  for(f of files)
    global.input_files[f.name] = f;
  update_inputfiles_list();
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
  $.ajax({
      url: 'file_upload',      type: 'POST',
      data: formData,          async: false,
      cache: false,            contentType: false,
      enctype: 'multipart/form-data',
      processData: false,
      success: function (response) {
        content = $("#filelist-item-content-template").tmpl([{filename:file.name}]);
        target  = $(`td.content[filename="${file.name}"]`);
        target.html('');
        content.appendTo(target);
        content.find('.ui.dimmer').dimmer({'closable':false}).dimmer('show');
      }
  });
}

function escapeSelector(s){  return s.replace( /(:|\.|\[|\])/g, "\\$1" ); }

function process_file(filename){
  return $.get(`/process_image/${filename}`).done(function(data){
      $(escapeSelector(`#segmented_${filename}`)).attr('src', "/images/segmented_"+filename);
      $(escapeSelector(`#dimmer_${filename}`)).dimmer('hide');
      contentdiv = $(escapeSelector(`#patches_${filename}`))
      for(i in data.labels){
        contentdiv.append(`<img class="ui image" src="/images/patch_${i}_${filename}" title='${data.labels[i]}'>`);
      }
      global.input_files[filename].processed=true;
      global.per_file_results[filename] = data.labels;
      $(escapeSelector(`#detected_${filename}`)).html(data.labels.length? data.labels.join() : '-');
      delete_image(filename);
    });
}

function delete_image(filename){
  $.get(`/delete_image/${filename}`);
}


function on_accordion_open(x){
  target     = this;
  contentdiv = this.find('.content')[0];
  if(contentdiv.innerHTML.trim())
    return;
  filename   = contentdiv.getAttribute('filename');
  file       = global.input_files[filename];
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
    if(j>=Object.values(global.input_files).length ){
      $button.html('<i class="play icon"></i>Process All Images');
      return;
    }

    f = Object.values(global.input_files)[j];
    if(!f.processed){
      upload_file(f);
      await process_file(f.name);
    }

    j+=1;
    $button.html(`${j}/${Object.values(global.input_files).length}`);
    setTimeout(loop_body, 1);
  }
  setTimeout(loop_body, 1);  //using timeout to refresh the html between iterations
}



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
  csvtxt = '';
  for(filename of Object.keys(global.per_file_results))
      csvtxt+= [filename].concat(global.per_file_results[filename]).join()+';\n'

  if(!!csvtxt)
    download('detected_bats.csv', csvtxt)
}









//
