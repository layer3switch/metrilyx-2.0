
from elasticsearch import Elasticsearch
from metrilyx import BaseClassWithConfig
from ..dataserver.transforms import absoluteTime
	
from pprint import pprint

DEFAULT_EVENT_RESULT_SIZE = 10000000

class ElasticsearchAnnotationQueryBuilder(object):

	def __init__(self, **config):
		for k,v in config.items():
			setattr(self, k, v)
	
	def timestampQuery(self, request):
		if request.has_key('end'):
			return {'range':{'timestamp':{
				'gte': absoluteTime(request['start']), 
				'lte': absoluteTime(request['end'])
				}}}
		else:
			return {'range':{'timestamp':{
				'gte': absoluteTime(request['start'])
				}}}

	def tagsQuery(self, request):
		return [ {'term':{k:v}} for k,v in request['tags'].items() ]

	def eventTypeQuery(self, eventType):
		return {'term': {'eventType': str(eventType).lower()}}

	def resultSize(self):
		return {"from": 0, "size": DEFAULT_EVENT_RESULT_SIZE}

	def getQuery(self, request, split=True):
		'''
		Args:
			split: splits query by type (i.e. 1 for each type)
		'''
		if self.use_ssl:
			url = str("https://%s:%d/%s/%s" %(self.host, self.port, 
									self.index, self.search_endpoint))
		else:
			url = str("http://%s:%d/%s/%s" %(self.host, self.port,
									self.index, self.search_endpoint))
		
		# 'and' queries passed to 'must' 
		andQueries = [ self.timestampQuery(request) ] + self.tagsQuery(request)
		if split:
			for eventType in request['eventTypes']:
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
						"should": [self.eventTypeQuery(et) for et in request['eventTypes']]
					}}}},
					"sort": "timestamp"
				}
			q.update(self.resultSize())
			yield (url, request['eventTypes'], q)



class ElasticsearchDatastore(BaseClassWithConfig):
	def __init__(self, config):
		super(ElasticsearchDatastore, self).__init__(config)
		self.ds = Elasticsearch([{
			'host': self.host,
			'port': self.port,
			'use_ssl': self.use_ssl
			}])

		self.queryBuilder = ElasticsearchAnnotationQueryBuilder(**config)

	def add(self, item):
		return self.ds.index(index=self.index, 
				doc_type=item['eventType'], 
				id=item['_id'], 
				body=item)

	def search(self, q):
		return self.ds.search(index=self.index, body=q)
