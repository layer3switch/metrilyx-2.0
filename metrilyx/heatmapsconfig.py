
from celery.schedules import crontab

from pprint import pprint

from metrilyxconfig import config
import heatmap_tasks

CELERY_IMPORTS = config['celery']['tasks']
BROKER_URL = config['heatmaps']['transport']+"://%(host)s:%(port)s/%(database)s" %(config['heatmaps']['broker']) 
CELERY_RESULT_BACKEND = config['heatmaps']['transport']
CELERY_MONGODB_BACKEND_SETTINGS = config['heatmaps']['broker']
CELERY_ACCEPT_CONTENT = ['pickle', 'json']

## periodic tasks
CELERYBEAT_SCHEDULE = {
    'every-minute': {
        'task': 'metrilyx.heatmap_tasks.run_heat_queries',
        'schedule': crontab(minute='*/1'),
        #'args': (1,2),
        #'options': { 'task_id': '' }
    },
}
