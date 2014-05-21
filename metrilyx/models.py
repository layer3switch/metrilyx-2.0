
from django.db import models
import jsonfield

import metrilyx
from metrilyxconfig import config

from pprint import pprint


class HeatQuery(models.Model):
	"""
	Model for storing heat queries.  Queries are extracted from the
	heatmap and assembled into HeatQuerys.
	"""
	_id = models.CharField(max_length=256, primary_key=True)
	query = models.CharField(max_length=256)
	name = models.CharField(max_length=128, default="", blank=True)

	def save(self, *args, **kwargs):
		if self.name == "":
			self.name = self._id
		super(HeatQuery, self).save(*args, **kwargs)


class MapModel(models.Model):
	MODELTYPE_CHOICES = (
		("graph", "graph"),
		("heat", "heat")
	)

	_id = models.CharField(max_length=128,primary_key=True)
	name = models.CharField(max_length=128, default="", blank=True)
	layout = jsonfield.JSONField()
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
									if s.get('loading'): del s['loading']
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



