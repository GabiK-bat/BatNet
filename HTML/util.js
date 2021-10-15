


deepcopy = function(x){return JSON.parse(JSON.stringify(x))};
sleep    = function(ms) { return new Promise(resolve => setTimeout(resolve, ms));  } //XXX: await sleep(x)


function escapeSelector(s){  return s.replace( /(:|\.|\[|\])/g, "\\$1" ); }


//returns the name of a file without its ending
filebasename = (filename) => filename.split('.').slice(0, -1).join('.');
//returns the file ending
file_ending  = (filename) => '.'+filename.split('.').slice(-1).join('.');


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


function rename_file(file, newname){
    return new File([file], newname, {type: file.type});
}


async function crop_image(image, relbox, square=false){
    var H = image.naturalHeight;
    var W = image.naturalWidth;
    var y = Math.floor(relbox[0]*H);
    var x = Math.floor(relbox[1]*W);
    var h = Math.ceil(relbox[2]*H - y);
    var w = Math.ceil(relbox[3]*W - x);
    if(square){
        //make it square but keep original aspect ratio
        var cy = y + h/2;
        var cx = x + w/2; //center
        h = Math.max(h,w);
        w = Math.max(h,w);
        y = Math.max(cy - h/2, 0);
        x = Math.max(cx - w/2, 0);
    }

    var canvas  = $(`<canvas width="${w}" height="${h}">`)[0];
    var ctx     = canvas.getContext('2d');
    ctx.drawImage(image, x,y,w,h, 0,0,w,h);

    var blob = await (await fetch(canvas.toDataURL())).blob()
    var url  = URL.createObjectURL(blob);
    var crop = $('<img>')[0];
    crop.src = url;
    return crop;
}
