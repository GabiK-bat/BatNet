from base.backend.settings import Settings as BaseSettings

class Settings(BaseSettings):
    
    #override
    @classmethod
    def get_defaults(cls):
        d = super().get_defaults()
        d.update({
            'confidence_threshold'     : 75,
            'export_boxes'             : False,
        })
        return d



