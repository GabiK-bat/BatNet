import base.backend.cli as base_cli

import os, datetime, sys
from . import processing
from . import settings


class CLI(base_cli.CLI):

    #override
    @classmethod
    def create_parser(cls):
        parser = super().create_parser(
            description    = '🦇 DigIT! Bat Detector 🦇',
            default_output = 'detected_bats.csv',
        )
        parser.add_argument('--saveboxes',  action='store_const', const=True, default=False,
                            help='Include boxes of detected bats in the output')
        return parser

    #override
    @classmethod
    def write_results(cls, results:list, args):
        filename   = args.output.as_posix()
        outputfile = open(filename, 'w')
        outputfile.write(results_to_csv(results, args.saveboxes))



def results_to_csv(results, export_boxes=False):
    header = [
        'Filename', 'Date', 'Time', 'Flag', 'Multiple', 'Species', 'Code', 'Confidence level'
    ]
    if export_boxes:
        header.append('Box')

    species_codes = settings.parse_species_codes_file()
    csv_data      = []
    for r in results:
        filename       = os.path.basename(r['filename'])
        result         = r['result']

        selectedlabels = result['labels']
        datetime       = processing.load_exif_datetime(r['filename'])
        date,time      = datetime.split(' ')[:2] if datetime is not None and ' ' in datetime else ['',''] 
        date           = date.replace(':','.')

        n              = len(result['labels'])
        multiple       = 'multiple' if n>1 else 'empty' if n==0 else ''
    

        if n==0:
            csv_item   = [filename, date, time, '', multiple, '', '', ''] + ([''] if export_boxes else [])
            csv_data.append( csv_item )
        
        for i in range(len(selectedlabels)):
            label      = selectedlabels[i]
            confidence = result['per_class_scores'][i][label]
            code       = species_codes.get(label, '')
            unsure     = 'unsure' if confidence < 0.70 else ''                                                                  #TODO: custom threshold
            
            confidence_str = f'{confidence*100:.1f}'
            csv_item       = [filename, date, time, unsure, multiple, label, code, confidence_str]
            if export_boxes:
                box  = ' '.join( [ f'{x:.1f}' for x in result['boxes'][i] ] )
                csv_item.append(box)
            csv_data.append(csv_item)
        
        #sanity check
        all_ok = all( [len(item)==len(header) for item in csv_data ] )
        if not all_ok:
            print(f'[INTERNAL ERROR] inconsistent CSV data', file=sys.stderr)
            #return   #no return
        
    csv_data = [header] + csv_data
    csv_txt  = ''
    csv_txt  = ';\n'.join( [ ';'.join(x) for x in csv_data ] ) + ';\n'
    return csv_txt



