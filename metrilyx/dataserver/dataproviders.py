
import re
import json
import logging

from metrilyx import BasicDataStructure
from ..httpclients import AsyncHttpJsonRequest
from transforms import absoluteTime
from ..datastores.ess import ElasticsearchAnnotationQueryBuilder 
from pprint import pprint

logger = logging.getLogger(__name__)

re_504 = re.compile("(504 gateway time.+out)", re.IGNORECASE)

class PerformanceDataProvider(BasicDataStructure):

	def graphMetadata(self, request, serie):
		"""
		Return: Graph metadata for a given request
		"""
		obj = dict([ (k,v) for k,v in request.items() if k != "series" ])
		obj['series'] = [serie]
		return obj

	def get_query_url(self, request, query_obj):
		"""
		Override in subclass (required).
		This must call self.timeWindow() to get time range.
		"""
		pass

	def getQueries(self, request):
		"""
		yield url, metadata
		"""
		request = self.__applyGlobalTags(request)
		for s in request['series']:
			url = self.get_query_url(request, s['query'])
			meta_obj = self.graphMetadata(request, s)
			yield (url, meta_obj)

	def response_callback(self, response):
		"""
		Override in subclass if data needs to be transformed to 
		metrilyx understandable format (optional).
		By default it understands data in the format tsdb returns it.
		"""
		return response

	def response_errback(self, error, graph_meta=None):
		#for k,v in error.__dict__.items():
		#	print k,v
		logger.error(str(error))
		try:
			err_obj = json.loads(error.value.response)['error']
		except Exception,e:
			err_obj = {'message': str(error.value.response)}
		
		m = re_504.search(err_obj['message'])
		if m != None:
			graph_meta['series'][0]['data'] = {"error": m.group(1)}
		else:
			graph_meta['series'][0]['data'] = {"error": err_obj['message'][:100]}
		logger.error("BaseDataProvider.response_errback: %s %s" %(
			str(graph_meta['series'][0]['query']), err_obj['message']))
		return graph_meta

	def timeWindow(self, request):
		time_win = {}
		if request.get('end'):
			if request['graphType'] == 'pie':
				time_win = {
					'start': request['end']-300,
					'end': request['end']
					}
			else:
				time_win = {
					'start': request['start'],
					'end': request['end']
					}
		else:
			if request['graphType'] == 'pie':
				time_win = { 'start': '5m-ago' }
			else:
				time_win = { 'start': request['start'] }
		return time_win

	def __applyGlobalTags(self, request):
		for serie in request['series']:
			for k,v in request['tags'].items():
				serie['query']['tags'][k] = v
		return request

class TSDBDataProvider(PerformanceDataProvider):

	def __get_serie_query(self, obj):
		if obj.get('rate'):
			query = "&m=%(aggregator)s:rate:%(metric)s" %(obj)
		else:
			query = "&m=%(aggregator)s:%(metric)s" %(obj)
		tagstr = ",".join([ "%s=%s"%(k,v) for k,v in obj['tags'].items() ])
		if tagstr != "":
			return query + "{" + tagstr + "}"
		return query

	def get_query_url(self, request, query_obj):
		base_url = "%s%s?" %(self.uri, self.query_endpoint)
		# all custom dataproviders need to call timeWindow().
		# this should not be manually set for performance reasons
		time_range = self.timeWindow(request)
		base_url += "&".join(["%s=%s" %(k,v) for k,v in time_range.items()])

		url = "%s%s" %(base_url, self.__get_serie_query(query_obj))
		return str(url)

class AnnoEventDataProvider(ElasticsearchAnnotationQueryBuilder):
	def getQueries(self, request, split=True):
		'''
		Args:
			split: splits query by type (i.e. 1 for each type)
		'''
		url = str("%s/%s/%s" %(self.uri, self.index, self.search_endpoint))
		# 'and' queries passed to 'must' 
		andQueries = [ self.timestampQuery(request) ] + self.tagsQuery(request)
		if split:
			for eventType in request['types']:
				q = {"query":{"filtered":{"filter":{"bool":{		
						"must": andQueries + [ self.eventTypeQuery(eventType) ]
					}}}},
					"sort": "timestamp",
				}
				q.update(self.resultSize())
				yield (url, eventType, q)
		else:
			q = {"query":{"filtered":{"filter":{"bool":{		
						"must": andQueries,
						"should": [self.eventTypeQuery(et) for et in request['types']]
					}}}},
					"sort": "timestamp"
				}
			q.update(self.resultSize())
			yield (url, request['types'], q)
