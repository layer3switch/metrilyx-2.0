
from ...transforms import absoluteTime
from ..events import BaseEventDataProvider

from pprint import pprint

class ElasticsearchEventDataProvider(BaseEventDataProvider):

	def responseCallback(self, response):
		return [ h['_source'] for h in response['hits']['hits'] ]

	def __timestampQuery(self, request):
		if request.has_key('end'):
			return {'range':{'timestamp':{
				'gte': absoluteTime(request['start']), 
				'lte': absoluteTime(request['end'])
				}}}
		else:
			return {'range':{'timestamp':{
				'gte': absoluteTime(request['start'])
				}}}

	def __tagsQuery(self, request):
		return [ {'term':{k:v}} for k,v in request['tags'].items() ]

	def __eventTypeQuery(self, eventType):
		return {'term': {'eventType': str(eventType).lower()}}

	def getQuery(self, request):
		if self.use_ssl:
			url = str("https://%s:%d/%s/%s" %(self.host, self.port, 
									self.index, self.search_endpoint))
		else:
			url = str("http://%s:%d/%s/%s" %(self.host, self.port,
									self.index, self.search_endpoint))
		# 'and' queries passed to 'must' 
		andQueries = [ self.__timestampQuery(request) ] + self.__tagsQuery(request)
		q = {
				"query":{"filtered":{"filter":{"bool":{		
					"must": andQueries,
					"should": [self.__eventTypeQuery(et) for et in request['eventTypes']]
				}}}},
				"sort": "timestamp",
				"from": 0,
				"size": self.result_size
			}
		return (url, 'GET', q)
