from base.backend.settings import Settings as BaseSettings

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


def parse_species_codes_file(path='./species_codes.txt'):
    lines         = open(path).read().strip().split('\n')
    species2codes = dict([ map(str.strip, line.split(':')) for line in lines])
    return species2codes

