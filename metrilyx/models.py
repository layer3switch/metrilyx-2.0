
import ujson as json
import requests

from django.db import models
import jsonfield

import metrilyx
from metrilyxconfig import config

from pprint import pprint


class EventType(models.Model):
	name = models.CharField(max_length=32)
	_id = models.CharField(max_length=32, primary_key=True)
	metadata = jsonfield.JSONField(default={},null=True,blank=True)

	def __createElasticsearchMapping(self):
		mapping = { self.name: config['annotations']['dataprovider']['default_mapping'] }
		mappingUrl = "http://%s:%d/%s/%s/_mapping" % (
						config['annotations']['dataprovider']['host'],
						config['annotations']['dataprovider']['port'],
						config['annotations']['dataprovider']['index'],
						self.name)
		return requests.put(mappingUrl, data=json.dumps(mapping))


	def save(self, *args, **kwargs):
		self._id = self.name.lower()

		resp = self.__createElasticsearchMapping()
		if resp.status_code >= 200 and resp.status_code <= 304:
			super(EventType, self).save(*args, **kwargs)
			return {"status": "Event type created: %s" % (self._id)}
		else:
			return resp.json()


class MapModel(models.Model):
	MODELTYPE_CHOICES = (("graph", "graph"),)

	_id = models.CharField(max_length=128,primary_key=True)
	name = models.CharField(max_length=128, default="", blank=True)
	layout = layout = jsonfield.JSONField(default=[], null=True, blank=True)
	user = models.ForeignKey('auth.User', related_name='mapmodels')
	group = models.ForeignKey('auth.Group', related_name='mapmodels', null=True, blank=True)
	tags = jsonfield.JSONField(default=[], null=True, blank=True)
	model_type = models.CharField(max_length=16, choices=MODELTYPE_CHOICES)

	def __sanitize_layout(self):
		for row in self.layout:
			for col in row:
				for pod in col:
					if pod.get('graphs'):
						for graph in pod['graphs']:
							if not graph.get('_id') or graph.get('_id') == "":
								graph['_id'] = metrilyx.new_uuid()
							if graph.get('series'):
								for s in graph['series']:
									if s.get('status'): del s['status']
									if s.get('data'): del s['data']

	def __get_heat_query(self, serie_query, name=""):
		if serie_query.get('rate'):
			qbase = "%(aggregator)s:rate:%(metric)s" %(serie_query)
		else:
			qbase = "%(aggregator)s:%(metric)s" %(serie_query)
		tags = ",".join([ "%s=%s" %(k,v) for k,v in serie_query['tags'].items() ])
		return {
			"_id": "%s{%s}" %(qbase, tags),
			"query": "%s{%s}" %(qbase, tags),
			"name": name
			}

	def __extract_heat_queries(self):
		for row in self.layout:
			for col in row:
				for pod in col:
					for graph in pod['graphs']:
						for serie in graph['series']:
							yield self.__get_heat_query(serie['query'], pod['name'])

	def __sanitize_id(self):
		self._id = self._id.replace(".", "_")
		self._id = self._id.replace(" ", "_")
		self._id = self._id.replace("/", "_")
		self._id = self._id.replace("\\", "_")

	def save(self, *args, **kwargs):
		if self.name == "":
			self.name = self._id
		self.__sanitize_id()
		self.__sanitize_layout()
		## extract and save heat queries before saving the heatmap
		if self.model_type == "heat":
			for hq in self.__extract_heat_queries():
				hq_obj = HeatQuery.objects.filter(_id=hq['_id'])
				if hq_obj == None or len(hq_obj) < 1:
					hq_obj = HeatQuery(**hq)
					hq_obj.save()

		super(MapModel, self).save(*args, **kwargs)



