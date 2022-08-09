from base.backend.settings import Settings as BaseSettings
from base.backend.app import path_to_main_module
import os

class Settings(BaseSettings):
    
    #override
    @classmethod
    def get_defaults(cls):
        d = super().get_defaults()
        d.update({
            'confidence_threshold'     : 70,
            'export_boxes'             : False,
        })
        return d

    #override
    def get_settings_as_dict(self):
        s = super().get_settings_as_dict()
        s['species_codes'] = parse_species_codes_file()
        return s


DEFAULT_SPECIES_FILE = os.path.join(path_to_main_module(), 'species_codes.txt')

def parse_species_codes_file(path=DEFAULT_SPECIES_FILE):
    lines         = open(path).read().strip().split('\n')
    species2codes = dict([ map(str.strip, line.split(':')) for line in lines])
    return species2codes

