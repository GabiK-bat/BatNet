


function set_training_mode(x){
    if(x){
      global.active_mode = 'training';
      //$('#process-all-button').hide();
      $('#retrain-button').show();
    } else {
      global.active_mode = 'inference';
      //$('#process-all-button').show();
      $('#retrain-button').hide();
    }
  }
  
  
  function save_settings(_){
    global.settings.active_model = $('#settings-active-model').dropdown('get value');
    $('#settings-ok-button').addClass('loading');
    $.post(`/settings`,{active_model:global.settings.active_model}).done( (x)=>{
      $('#settings-dialog').modal('hide');
      $('#settings-ok-button').removeClass('loading');
      console.log('Settings:',x)
    } );
    set_training_mode($('#settings-enable-retraining').checkbox('is checked'));
    return false;
  }
  
  function on_settings(){
    load_settings();
    $('#settings-dialog').modal({onApprove: save_settings}).modal('show');
  }
  
  function load_settings(){
    $.get('/settings').done( function(settings){
      console.log(settings)
      global.settings.models       = settings.models;
      global.settings.active_model = settings.active_model;
      
      var models_list = []
      for(var modelname of global.settings.models)
        models_list.push({name:modelname, value:modelname, selected:(modelname==global.settings.active_model)})
      if(settings.active_model=='')
        models_list.push({name:'[UNSAVED MODEL]', value:'', selected:true})
      $('.ui.dropdown#settings-active-model').dropdown({values: models_list, showOnFocus:false });
  
      var $new_name_elements = $("#settings-new-modelname-field");
      (settings.active_model=='')? $new_name_elements.show(): $new_name_elements.hide();
    } );
  }
  
  //called when user clicks on the save button in settings to save a retrained model
  function on_save_model(){
    var newname = $('#settings-new-modelname')[0].value
    if(newname.length==0){
      console.log('Name too short!')
      return;
    }
    $.get('/save_model', {newname:newname}).done(load_settings);
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
  