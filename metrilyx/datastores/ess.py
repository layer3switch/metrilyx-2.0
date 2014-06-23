
from elasticsearch import Elasticsearch
from metrilyx import BasicDataStructure
from ..dataserver.transforms import absoluteTime
	
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

	def getQuery(self, request):
		# 'and' queries passed to 'must' 
		andQueries = [ self.timestampQuery(request) ] + self.tagsQuery(request)
		return {"query":{"filtered":{"filter":{"bool":{		
					"must": andQueries,
					"should": [self.eventTypeQuery(et) for et in request['types']]
				}}}},
				"sort": "timestamp"
			}

class ElasticsearchDataStore(BasicDataStructure):
	def __init__(self, config):
		super(ElasticsearchDataStore, self).__init__(config)
		self.ds = Elasticsearch()
		self.queryBuilder = ElasticsearchAnnotationQueryBuilder()

	def add(self, item):
		return self.ds.index(index=self.index, 
				doc_type=item['eventType'], 
				id=item['_id'], 
				body=item)

	def search(self, query):
		return self.queryBuilder(query)