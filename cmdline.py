import glob, sys, os
import numpy as np

import processing


def process_from_args(args):
    inputfiles = sorted(glob.glob(args.input.as_posix(), recursive=True))
    if len(inputfiles) == 0:
        print('Could not find any files')
        return
    
    print(f'Processing {len(inputfiles)} files')

    model = None
    if args.model is not None:
        model = os.path.basename(args.model.name).replace('.cpkl','')
    processing.init(model)

    results = []
    for i,f in enumerate(inputfiles):
        print(f'[{i:4d} / {len(inputfiles)}] {f}')
        try:
            image        = processing.load_image(f)
            result       = processing.process_image(image)
        except Exception as e:
            print(f'[ERROR]: {e}', file=sys.stderr)
            continue
        results += [{'filename':f, 'result':result}]
    
    outputfile = open(args.output.as_posix(), 'w')
    outputfile.write(results_to_csv(results, args.saveboxes))


def results_to_csv(results, boxes=False):
    csvlines = []
    csvlines+= [f'File_name;Date;Time;Flag;Multiple;Species;Code;Confidence_level;']
    if boxes:
        csvlines[-1] += 'Box;'
    for r in results:
        fname    = os.path.basename(r['filename'])
        datetime = processing.load_exif_datetime(r['filename'])
        date,time = datetime.split(' ')[:2] if datetime is not None and ' ' in datetime else ['',''] 
        date      = date.replace(':','.')

        n        = len(r['result'].labels)
        multiple = 'multiple' if n>1 else 'empty' if n==0 else ''
        if n==0:
            csvlines   += [f'{fname};{date};{time};;{multiple};;;;' + (';' if boxes else '')]
        for i,label_conf in enumerate(r['result'].labels):
            label_conf  = list(label_conf.items())
            argmax      = np.argmax([c for l,c in label_conf])
            label, conf = label_conf[argmax]
            flag        = 'unsure' if conf<0.70 else ''  #TODO: custom threshold
            code        = SPECIES_CODES.get(label,'')
            csvlines   += [f'{fname};{date};{time};{flag};{multiple};{label};{code};{conf:.2f};']
            if boxes:
                box = ' '.join([f'{b:.5f}' for b in np.array(r['result'].boxes[i])])
                csvlines[-1] += f"{box};"
    csvtext = '\n'.join(csvlines)
    return csvtext




SPECIES_CODES = {
    'Barbastella barbastellus' :            'Bbar',
    'Eptesicus serotinus':                  'Eser',
    'Myotis mystacinus/Myotis brandtii/Myotis alcathoe' : 'Mbart',
    'Myotis bechsteinii':                   'Mbec',
    'Myotis dasycneme':                     'Mdas',
    'Myotis daubentonii':                   'Mdau',
    'Myotis emarginatus':                   'Mema',
    'Myotis myotis/Myotis blythii':         'Mmyo',
    'Myotis nattereri':                     'Mnat',
    'Nyctalus noctula':                     'Nnoc',
    'Plecotus auritus/Plecotus austriacus': 'Paur',
    'Pipistrellus sp.':                     'Pip',
    'Rhinolophus ferrumequinum':            'Rfer',
    'Rhinolophus sp.':                      'Rsp',
}

