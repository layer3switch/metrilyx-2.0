
from celery.schedules import crontab

from pprint import pprint

from metrilyxconfig import config
import celerytasks

CELERY_IMPORTS = config['celery']['tasks']
BROKER_URL = config['heatmaps']['transport']+"://%(host)s:%(port)s/%(database)s" %(config['heatmaps']['broker']) 
CELERY_RESULT_BACKEND = config['heatmaps']['transport']
CELERY_MONGODB_BACKEND_SETTINGS = config['heatmaps']['broker']
CELERY_ACCEPT_CONTENT = ['pickle', 'json']

## periodic tasks
CELERYBEAT_SCHEDULE = {
    'heat-queries': {
        'task': 'metrilyx.celerytasks.run_heat_queries',
        'schedule': crontab(minute='*/1'),
        #'args': (1,2),
        #'options': { 'task_id': '' }
    },
    'metric-cacher': {
    	'task': 'metrilyx.celerytasks.cache_metrics',
    	'schedule': crontab(minute=str("*/%d" %(config['cache']['interval'])))
    },
    'metric-cache-expirer': {
        'task': 'metrilyx.celerytasks.expire_metrics_cache',
        'schedule': crontab(minute=str("*/%d" %(config['cache']['retention_period'])))
    }
}
