
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'metrilyx.settings')

import json

from metrilyxconfig import config
from celery.decorators import task
from celery.schedules import crontab

from metrilyx.models import HeatQuery

from httpclients import OpenTSDBClient



"""
def get_heatmap_jobs(cfg):
	heat_cfg = json.load(open(cfg, "rb"))
	jobs = {}
	for q in heat_cfg.keys():
		query_str = "start=%s&m=%s" %(config['heatmaps']['analysis_interval'], q)
		jobs[q] = query_str
	return jobs

def heatmaps_schedule(cfg, task_str):
	sched = {}
	jobs = get_heatmap_jobs(cfg)
	#pprint(jobs)
	for k,v in jobs.items():
		sched[k] = {
			"task": task_str,
			"schedule": crontab(minute='*/1'),
			"options": { "task_id": k },
			"args": (v,)
			}
	return sched
"""

@task
def heatmap(query, top=10):
	"""
		Query TSDB and get the max for that time range
		Return:
			A list of maxes including timestamp, value, tags and metric
	"""
	otsdb = OpenTSDBClient(config['tsdb']['uri'], config['tsdb']['port'])
	result = otsdb.query(query)

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
		#print querystr
		#heatmap.delay(querystr,top)
		heatmap.apply_async((querystr,top), task_id=hq._id)
	#return []
	return { "message": "Submitted %d queries" %(len(hqueries)) }


