

BatDownload = class extends ObjectDetectionDownload{
    //override
    static build_annotation_jsonfile(filename, results){
        return super.build_annotation_jsonfile(filename, results, "Not-A-Bat")
    }


    //callback Download -> Download CSV
    static on_download_csv(event){
        //give warning if no files loaded
        if(Object.keys(GLOBAL.files).length==0){
            //FIXME: toast
            $('body').toast({
                message: 'Nothing to download',
                class:   'warning'
            });
            /*$('.download-all.item').popup({on       : 'manual',
                                            position : 'top center',
                                            delay    : {'show':0, 'hide':0}, duration:0,
                                            content  : 'Nothing to download'}).popup('show');
            */
            return;
        }
            
        if(GLOBAL.metadata==undefined && !$('.download-all.item').popup('is visible')){
            $('.download-all.item').popup({
                on       : 'manual',
                position : 'top center',
                target   : '#metadata-button',
                title    : 'Missing Metadata',
                delay    : {'show':0, 'hide':0},
                duration : 0,
                content  : 'Click again to download anyway'
            }).popup('show');
            return;
        }

        const filenames = Object.keys(GLOBAL.files)
        const csv       = this.csv_data_for_files(filenames)
        if(!!csv)
            download_text('detected_bats.csv', csv)
    }

    static csv_data_for_files(filenames){
        const export_boxes = GLOBAL.settings.export_boxes;
        let header = [
            'Filename', 'Date', 'Time', 'Flag', 'Multiple', 'Species', 'Code', 'Confidence level'
        ]
        if(export_boxes)
            header.push('Box')

        let all_csv_data = []
        for(const i in filenames){
            const single_file_csv = this.csv_data_for_file(filenames[i], export_boxes)
            if(single_file_csv!=undefined)
                all_csv_data = all_csv_data.concat(single_file_csv);
        }
        if(all_csv_data.length > 0){
            //sanity check
            const lengths_ok = all_csv_data.every(x => (x.length == header.length) )
            if(!lengths_ok){
                console.error('CSV data length mismatch:', header, all_csv_data)
                $('body').toast({message:'CSV data length mismatch', class:'error'})
                throw Error();
            }

            let csv_txt = ''
            if(GLOBAL.metadata)
                for(const [key, value] of Object.entries(GLOBAL.metadata))
                    csv_txt += '#'+key+':'+value.replace(/\n/g,'\n#')+'\n';
            
            csv_txt += [header].concat(all_csv_data).map( x => x.join(';') ).join(';\n')+';\n'
            return csv_txt
        }
    }

    static csv_data_for_file(filename, export_boxes=false){
        const results        = GLOBAL.files[filename].results;
        if(!results)
            return undefined;
        
        const selectedlabels = results.labels;

        const flags    = results.compute_flags(filename);
        const multiple = flags.includes('multiple') ? 'multiple' : flags.includes('empty')? 'empty' : '';
        const unsures  = results.compute_flags(filename, true);       //per-result
        const datetime = results.datetime ?? "";
        const date     = datetime.substring(0,10).replace(/:/g,'.');
        const time     = datetime.substring(11);

        
        if(selectedlabels.length==0){
                            //fname, date,time,unsure,multi,species,code,conf
            let csv_data = [filename, date, time, '', multiple, '', '', '']
            if(export_boxes)
                csv_data.push('')
            return [csv_data];
        }

        let csv_data = []
        for(const i in selectedlabels){
            const label      = selectedlabels[i];
            const confidence = (results.predictions[i][label] ?? 1.0).toFixed(2);
            const code       = GLOBAL.species_codes[label] ?? '';
            
            let csv_item     = [filename, date, time, unsures[i], multiple, label, code, confidence]
            if(export_boxes){
                const box  = results.boxes[i].map( x => x.toFixed(1) ).join(' ');
                csv_item.push(box)
            }
            csv_data.push(csv_item)
        }
        return csv_data
    }
}


