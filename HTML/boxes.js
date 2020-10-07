


function add_box_overlay(filename, box, index){
    var $overlay = $("#box-overlay-template").tmpl( [ {box:box, index:index} ] );
    $parent      = $(`div[filename="${filename}"]`).find('.image-container');
    $parent.append($overlay);    
}

function remove_box_overlay(filename, index){
    $overlay = $(`div[filename="${filename}"]`).find(`.box-overlay[index="${index}"]`);
    $overlay.remove();
}

//adds a callback to a result-details-box to highlight the corresponding box overlays on mouse hover
function add_box_overlay_highlight_callback($resultdetailsbox){
  var filename = $resultdetailsbox.attr('filename');
  var index    = $resultdetailsbox.attr('index');
  $resultdetailsbox.hover(
    function(){
       $(`div[filename="${filename}"]`).find(`.box-overlay[index=${index}]`).css('background-color', '#ffffff66'); },
    function(){ 
       $(`div[filename="${filename}"]`).find(`.box-overlay[index=${index}]`).css('background-color', '#ffffff00');});
}


function register_box_draw($container, on_box_callback) {
    var $selection = $('<div>').css({"background": "transparent", 
                                     "position":   "absolute", 
                                     "border":     "1px dotted #fff"});

    $container.on('mousedown', function(e) {
        var click_y = e.pageY - $container.offset().top;
        var click_x = e.pageX - $container.offset().left;

        $selection.css({
          'top':    click_y,  'left':   click_x,
          'width':  0,        'height': 0
        });
        $selection.appendTo($container);

        $container.on('mousemove', function(e) {
            var move_y = e.pageY - $container.offset().top,
                move_x = e.pageX - $container.offset().left,
                width  = Math.abs(move_x - click_x),
                height = Math.abs(move_y - click_y);

            var new_x = (move_x < click_x) ? (click_x - width)  : click_x;
            var new_y = (move_y < click_y) ? (click_y - height) : click_y;

            $selection.css({
              'width': width,  'height': height,
              'top':   new_y,  'left': new_x
            });
        }).on('mouseup', function(e) {
            $container.off('mousemove');
            $container.off('mouseup');

            var parent_box  = $container[0].getBoundingClientRect();
            var topleft     = $selection.position()
            var bottomright = [topleft.top + $selection.height(), topleft.left + $selection.width()];
            var bbox        = [topleft.top/parent_box.height,    topleft.left/parent_box.width,
                               bottomright[0]/parent_box.height, bottomright[1]/parent_box.width];
            
            console.log('>>>', bbox, e.target);
            $selection.remove();
            on_box_callback(bbox);
        });
    });
}
