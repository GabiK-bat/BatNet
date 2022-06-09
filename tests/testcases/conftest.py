import os
os.environ['TESTS_TO_SKIP'] = (
    '''test_download_basic'''               #single item download disabled
    '''test_download_all'''                 #json files, replaced by TestBatDownload.test_download_all
    '''test_overlay_side_by_side_switch'''  #side-by-side disabled in this ui
    '''test_load_results'''                 #result files different, #TODO: replace
)


from tests.mockmodels import bat_model
from base.backend.app import get_models_path

models_path = os.path.join(get_models_path(), 'detection')
os.makedirs(models_path, exist_ok=True)
for i in range(3):
    bat_model.BatMockModel().save( os.path.join(models_path, f'model_{i}') )
