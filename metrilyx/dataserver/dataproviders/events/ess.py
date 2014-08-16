
from elasticsearch import Elasticsearch

from ...transforms import absoluteTime
from ..events import BaseEventDataProvider

from metrilyx.datastores.ess import ElasticsearchAnnotationQueryBuilder

from pprint import pprint

class ElasticsearchEventDataProvider(BaseEventDataProvider):
	def __init__(self, config):
		super(ElasticsearchEventDataProvider, self).__init__(config)
		self.queryBuilder = ElasticsearchAnnotationQueryBuilder(**config)
		self.ds = Elasticsearch([{
			'host': self.host,
			'port': self.port,
			'use_ssl': self.use_ssl
			}])

	def add(self, item):
		'''
		used by django
		'''
		return self.ds.index(index=self.index, 
				doc_type=item['eventType'], 
				id=item['_id'], 
				body=item)

	def search(self, q):
		'''
		used by django
		'''
		return self.ds.search(index=self.index, body=q)

	def responseCallback(self, response):
		return [ h['_source'] for h in response['hits']['hits'] ]


	def getQuery(self, request, split=True):
		for (url, eventType, query) in self.queryBuilder.getQuery(request, split):
			yield (url, "GET", query)