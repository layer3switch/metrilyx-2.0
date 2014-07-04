
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'metrilyx.settings')

import json

from twisted.internet import reactor
from twisted.web.client import getPage

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
def cache_metrics():
	global COUNTERS, DSTORE
	COUNTERS = {
		'metrics': 0,
		'tagv': 0,
		'tagk': 0
	}
	DSTORE = MetricCacheDatastore(**config['cache']['datastore'])

	def updateCounter(queryType):
		global COUNTERS, DSTORE
		COUNTERS[queryType] += 1	
		#print " * metrics: %(metrics)d  tagkeys: %(tagk)d  tagvals: %(tagv)d  / 52" %(COUNTERS)
		if COUNTERS['metrics'] == 52 and COUNTERS['tagk'] == 52 and COUNTERS['tagv'] == 52:
			DSTORE.close()
			reactor.stop()

	def cacheErrback(error, query, qType):
		print "-- ERROR", error
		updateCounter(qType)

	def callback(result, query, qType):
		global DSTORE
		if qType == 'metrics':
			queryType = 'metric'
		else:
			queryType = qType

		try:
			metricList = json.loads(result)
		except Exception,e:
			updateCounter(qType)
			return

		newList = [{'_id': "%s:%s" %(queryType, m), 
					'name': m,
					'type': queryType} for m in metricList ]
		if len(newList) < 1:
			updateCounter(qType)
			return
		rslt = DSTORE.bulkCache(newList)
		updateCounter(qType)

	for qType in CACHE_QUERY_TYPES:
		for a in CACHE_ALPHABETS:
			## uppercase
			d = getPage(str("%s%s?type=%s&q=%s&%s" %(config['dataprovider']['uri'], 
					config['dataprovider']['search_endpoint'], qType, a, CACHE_QUERY_PARAMS)))
			d.addCallback(callback, a, qType)
			d.addErrback(cacheErrback, a, qType)
			## lowercase
			d = getPage(str("%s%s?type=%s&q=%s&%s" %(config['dataprovider']['uri'], 
					config['dataprovider']['search_endpoint'], qType, a.lower(), CACHE_QUERY_PARAMS)))
			d.addCallback(callback, a.lower(), qType)
			d.addErrback(cacheErrback, a.lower(), qType)

	reactor.run()
	return {'status': 'Caching complete'}
