
import json
import logging

from pprint import pprint

logger = logging.getLogger(__name__)

class BaseDataProvider(object):
	def __init__(self, config):
		for k,v in config.items():
			setattr(self, k, v)

	def graph_metadata(self, request, serie):
		"""
		Return: Graph metadata for a given request
		"""
		obj = dict([ (k,v) for k,v in request.items() if k != "series" ])
		obj['series'] = [serie]
		return obj

	def get_query_url(self, request, query_obj):
		"""
		Override in subclass (required).
		This must call self.time_window() to get time range.
		"""
		pass

	def get_queries(self, request):
		"""
		yield url, metadata
		"""
		request = self.__apply_globaltags(request)
		for s in request['series']:
			url = self.get_query_url(request, s['query'])
			meta_obj = self.graph_metadata(request, s)
			yield (url, meta_obj)

	def response_callback(self, response):
		"""
		Override in subclass if data needs to be transformed to 
		metrilyx understandable format (optional).
		"""
		return response

	def response_errback(self, error, graph_meta=None):
		#for k,v in error.__dict__.items():
		#	print k,v

		try:
			err_obj = json.loads(error.value.response)['error']
		except Exception,e:
			err_obj = {'message': str(error.value.response)}
		
		graph_meta['series'][0]['data'] = {"error": err_obj['message'][:100]}
		logger.error("BaseDataProvider.response_errback: %s %s" %(
			str(graph_meta['series'][0]['query']), err_obj['message']))
		return graph_meta

	def time_window(self, request):
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

	def __apply_globaltags(self, request):
		for serie in request['series']:
			for k,v in request['tags'].items():
				serie['query']['tags'][k] = v
		return request

class TSDBDataProvider(BaseDataProvider):

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
		# all custom dataproviders need to call time_window.
		# this should not be manually set for performance reasons
		time_range = self.time_window(request)
		base_url += "&".join(["%s=%s" %(k,v) for k,v in time_range.items()])

		url = "%s%s" %(base_url, self.__get_serie_query(query_obj))
		return str(url)
