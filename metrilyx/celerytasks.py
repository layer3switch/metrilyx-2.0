
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'metrilyx.settings')

import requests

from celery.decorators import task
from celery.schedules import crontab


from metrilyxconfig import config
from metrilyx.datastores.mongodb import MetricCacheDatastore
from metrilyx.models import HeatQuery
from httpclients import OpenTSDBClient

CACHE_QUERY_PARAMS = "max=16000000"
CACHE_QUERY_TYPES = ('metrics', 'tagk', 'tagv')
CACHE_ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


@task
def heatmap(query, top=10):
	"""
		Query TSDB and get the max for that time range
		Return:
			A list of maxes including timestamp, value, tags and metric
	"""
	otsdb = OpenTSDBClient(**config['dataprovider'])
	result = otsdb.query(str(query))

	if result.error:
		return { "error": result.error }
	out = []
	for d in result.data:
		dmax = {
			"tags": d['tags'],
			"metric": d['metric'],
			"timestamp": 0,
			"value": 0
			}
		for p in d['dps']:
			#print p[1]
			if p[1] >= dmax['value']:
				dmax['value'] = p[1]
				dmax['timestamp'] = p[0]
		out.append(dmax)
	out = sorted(out, key=lambda val: val['value'], reverse=True)
	return out[:top]

@task
def run_heat_queries(top=10):
	hqueries = HeatQuery.objects.all()
	for hq in hqueries:
		querystr = "start=%s&m=%s" %(config['heatmaps']['analysis_interval'], hq.query)
		heatmap.apply_async((querystr,top), task_id=hq._id)
	return { "message": "Submitted %d queries" %(len(hqueries)) }


@task
def cacheTSMetaByTypeForAlpha(qtype, alphabet):
	r = requests.get(str("%s%s?type=%s&q=%s&%s" %(config['dataprovider']['uri'], 
										config['dataprovider']['search_endpoint'], 
										qtype, alphabet, CACHE_QUERY_PARAMS)))
	metricList = r.json()
	if qtype == 'metrics':
		newList = [{'_id': "metric:%s" %(m), 
				'name': m,
				'type': 'metric'
				} for m in metricList ]
	else:
		newList = [{'_id': "%s:%s" %(qtype, m), 
				'name': m,
				'type': qtype
				} for m in metricList ]
	
	if len(newList) < 1:
		return {
			'status': 'No metrics',
			'query': alphabet,
			'type': qtype
			}
	mcd = MetricCacheDatastore(**dict([(k,v) for k,v in config['cache']['datastore']['mongodb'].items()] +
									[('retention_period',config['cache']['retention_period']*60)]))
	resp = mcd.bulkCache(newList)
	mcd.close()
	return {
		'status': "refreshed %d" %(len(newList)), 
		'query': alphabet,
		'type': qtype,
		'response': resp
		}

@task
def cache_metrics():
	'''
	Submit 1 query per alphabet per type.
	Total queries 26 * 2 * 3 (alphabets *  upper/lower case * types)
	'''
	queryUrl = str("%(uri)s%(search_endpoint)s") %(config['dataprovider'])
	for qtype in CACHE_QUERY_TYPES:
		for a in CACHE_ALPHABETS:
			cacheTSMetaByTypeForAlpha.apply_async((qtype, a))
			cacheTSMetaByTypeForAlpha.apply_async((qtype, a.lower()))
			break
		break
	return {'status': 'submitted %d' %((len(CACHE_ALPHABETS)*2)*len(CACHE_QUERY_TYPES))}

@task
def expire_metrics_cache():
	mcd = MetricCacheDatastore(**dict([(k,v) for k,v in config['cache']['datastore']['mongodb'].items()] +
									[('retention_period',config['cache']['retention_period']*60)]))
	return mcd.expireCache()
