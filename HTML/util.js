


deepcopy = function(x){return JSON.parse(JSON.stringify(x))};
sleep    = function(ms) { return new Promise(resolve => setTimeout(resolve, ms));  } //XXX: await sleep(x)


function escapeSelector(s){  return s.replace( /(:|\.|\[|\])/g, "\\$1" ); }


//returns the name of a file without its ending
filebasename = (filename) => filename.split('.').slice(0, -1).join('.');



function upload_file_to_flask(url, file){
    var formData = new FormData();
    formData.append('files', file);
    return $.ajax({
        url: url, type: 'POST',
        data: formData,
        processData: false, cache: false,
        contentType: false, async: false,
        enctype: 'multipart/form-data'
    });
}


function upload_textfile(url, filename, text){
    var file = new File([new Blob([text])], filename);
    return upload_file_to_flask(url, file);
}


  