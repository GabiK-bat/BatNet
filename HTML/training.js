



//called when user selected JSON files (in the 'File' menu)
async function on_training_json_select(input){
    console.log(input.target.files);
    $('#loading-json-modal').modal({closable: false, inverted:true}).modal('show');
    var promises = []
  
    for(var jsonfile of input.target.files){
      var jsonbasename = filebasename(jsonfile.name);
      for(inputfile of Object.values(global.input_files)){
        if(filebasename(inputfile.name) == jsonbasename){
          console.log('Matched json for input file ',inputfile.name);
          var p = load_json_annotation(jsonfile, inputfile.name);
          promises.push(p);
        }
      }
    }
  
    for(var p of promises){    await p;   };
    $('#loading-json-modal').modal('hide')
  }
  
  
  async function load_json_annotation(jsonfile, jpgfile){
    console.log('Loading JSON file: ',jsonfile.name);
    
    await load_full_image(jpgfile);  //needed for naturalHeight/Width
    var width  = global.input_files[jpgfile].size[0];
    var height = global.input_files[jpgfile].size[1];
    const promise = new Promise((resolve, reject) => {
      var freader = new FileReader();
      freader.onload = async (ev) => { 
        var jsondata = JSON.parse(ev.target.result); 
        var labels = [], boxes = [];
        var imgelement         = $(`.filelist-item-content[filename="${jpgfile}"]`).find(`img`)[0];
        remove_all_predictions_for_file(jpgfile);
        for(var i in jsondata.shapes){
          var shape = jsondata.shapes[i];
          labels.push( {[shape.label]:1} )
          boxes.push( [Math.min(shape.points[0][1], shape.points[1][1])/height,
                      Math.min(shape.points[0][0], shape.points[1][0])/width,
                      Math.max(shape.points[0][1], shape.points[1][1])/height,
                      Math.max(shape.points[0][0], shape.points[1][0])/width ] );
          
          await add_custom_box(jpgfile, boxes[boxes.length-1], labels[labels.length-1], Number(i)+1000);
        }
        set_processed(jpgfile, 'json');
        update_per_file_results(jpgfile);
        resolve();
      };
      freader.readAsText(jsonfile);
    });
    return promise;
  }
  
  
  //called when user pressed the "Retrain" button
  function on_retrain(){
    //collect files with predictions
    var files = Object.values(global.input_files).filter(x => x.processed);
    if(files.length==0){
      // show message that no files for training are available
      $('#retrain-button').popup({on       : 'manual',
                                  position : 'bottom center',
                                  delay    : {'show':0, 'hide':0}, duration:0,
                                  content  : 'No files or annotations loaded'}).popup('show');
      return;
    }
  
    //upload images and json files (generated from predictions)
    for(var f of files){
      var json = create_json_from_predictions(f.name);
      upload_textfile('/file_upload', filebasename(f.name)+'.json', JSON.stringify(json));
      upload_file(f.file);
    }
  
    var filenames = files.map(x => x.name);
    $.post('/start_training', {'filenames':filenames});
  
    //reset and show modal
    $('#training-modal').find('.label').text('Training Progress')
    $('#cancel-training-button').removeClass('disabled');
    $('#training-modal').find('.progress').progress({
      percent:0, showActivity: false, autoSuccess:false,
    });
    $('#training-modal').modal({
      closable: false, inverted:true, onDeny: on_cancel_training,
    }).modal('show');
  
    function progress_polling(){
      $.get(`/retraining_progress`, function(data) {
          if(data==null){
            //training finished
            $.get('/stop_training');
            $('#training-modal').modal('hide');
          }
          else{
            var progress_percent = Math.round(data*100);
            $('#training-modal').find('.progress').progress({
              percent:progress_percent, showActivity: false, autoSuccess:false
            });
            if(progress_percent==100){
              //exporting to onnx
              $('#training-modal').find('.label').text('Post-Processing. This can take a few minutes...');
              $('#cancel-training-button').addClass('disabled');
            }
            //continue polling
            setTimeout(progress_polling,1000);
          }
      });
    }
    global.cancel_requested = false;
    setTimeout(progress_polling, 1000);
  }
  
  function on_cancel_training(_){
    $.get('/stop_training');
    return false;
  }
  