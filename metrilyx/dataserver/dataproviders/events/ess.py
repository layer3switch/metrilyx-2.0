
from ...transforms import absoluteTime
from ..events import BaseEventDataProvider

from metrilyx.datastores.ess import ElasticsearchAnnotationQueryBuilder

from pprint import pprint

class ElasticsearchEventDataProvider(BaseEventDataProvider):
	def __init__(self, config):
		super(ElasticsearchEventDataProvider, self).__init__(config)
		self.queryBuilder = ElasticsearchAnnotationQueryBuilder(**config)

	def responseCallback(self, response):
		return [ h['_source'] for h in response['hits']['hits'] ]


	def getQuery(self, request, split=True):
		for (url, eventType, query) in self.queryBuilder.getQuery(request, split):
			yield (url, "GET", query)