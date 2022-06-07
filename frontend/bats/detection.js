BatDetection = class extends BaseDetection {

    //override
    static async set_results(filename, results){
        const clear = (results == undefined)
        this.hide_dimmer(filename)

        GLOBAL.files[filename].results = undefined;
        GLOBAL.App.Boxes.clear_box_overlays(filename)
        
        if(!clear){
            console.log(`Setting results for ${filename}:`, results)
            const batresults            = new BatResults(results['labels'], results['boxes'])
            GLOBAL.files[filename].results = batresults
            GLOBAL.App.Boxes.refresh_boxes(filename)
            
            $(`.table-row[filename="${filename}"] td:nth-of-type(2)`).html( this.format_results_for_table(batresults) )
            this.update_flags(filename)
        }

        this.set_processed(filename, clear)
    }

    static format_results_for_table(batresults){
        const hiconf_threshold = 0.75                                                                                                //FIXME hardcoded threshold
        const n     = batresults.labels.length;
        let   texts = []
        for (let i = 0; i < n; i++) {
            let   label      = batresults.labels[i];
            const confidence = Object.values(batresults.predictions[i])[0]
            if(!label || (label.toLowerCase()=='not-a-bat')){
                if(confidence > hiconf_threshold)
                    //filter high-confidence non-bat
                    continue;
                else
                    label = 'Not-A-Bat'
            }
            
            let   text       = `${label}(${(confidence*100).toFixed(0)}%)`
            if(confidence > hiconf_threshold)
                  text       = `<b>${text}</b>`
            texts = texts.concat(text)
        }
        const full_text = texts.join(', ') || '-'
        return full_text
    }

    //TODO: move to BatResults class
    static compute_flags(filename, return_per_result=false){
        const hiconf_threshold = 0.75                                                                                                //FIXME hardcoded threshold
        let lowconfs = [];
        let amount   = 0;
        let flags    = []
      
        const batresults = GLOBAL.files[filename]?.results;
        if(!batresults)
          return [];

        const n     = batresults.labels.length;
        for (let i = 0; i < n; i++) {
            const confidence = Object.values(sort_object_by_value(batresults.predictions)[i])[0]
            const _lowconf   = (confidence <= hiconf_threshold);
            lowconfs.push(_lowconf)
            const label      = batresults.labels[i];
            //if(! (r.prediction[''] > hiconf_threshold) ){
            if( !(!label || (label.toLowerCase()=='not-a-bat')) ){                                                                    //TODO: plus confidence high ????
                amount += 1;
            }
        }
        
        const manual_flags = $(`[filename="${filename}"] td.flags-cell`).hasClass('manual-flag')
        const lowconf = lowconfs.includes(true) ^ manual_flags;
        if(lowconf)
          flags.push('unsure');
      
        if(return_per_result)
          if(manual_flags)
            return lowconfs.map(x => {return lowconf? 'unsure' : ''});
          else
            return lowconfs.map(x => {return x? 'unsure' : ''});
      
        if(amount==0 && batresults)
          flags.push('empty');
        else if(amount>1 && batresults)
          flags.push('multiple');
        
        return flags
    }

    static update_flags(filename){
      const flags      = this.compute_flags(filename)

      let   $flag_icon = $(`.table-row[filename="${filename}"]`).find('.lowconf-flag');
      $flag_icon.css('visibility', flags.includes('unsure')? 'visible' : 'hidden')  //hide()/show() changes layout

      const empty      = flags.includes('empty');
      const multiple   = flags.includes('multiple');
            $flag_icon = $(`.table-row[filename="${filename}"]`).find('.amounts-flag');
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

    static on_flag(event){
      event.stopPropagation();
      const $cell   = $(event.target).closest('td')
      //const flagged = $cell.attr('manual-flag')
      //console.warn($cell[0], flagged)
      //$cell.attr('manual-flag', !flagged)
      $cell.toggleClass('manual-flag')

      const filename = $cell.closest('[filename]').attr('filename')
      this.update_flags(filename)
    }
}

