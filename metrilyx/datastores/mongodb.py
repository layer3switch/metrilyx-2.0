
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from pprint import pprint

class BaseMongoDatastore(object):
	def __init__(self, **kwargs):
		self.client = MongoClient(kwargs['host'],kwargs['port'])
		self.db = self.client[kwargs['database']]

	def close(self):
		self.client.close()

class MetricCacheDatastore(BaseMongoDatastore):
	METATYPES = ('metric','tagk','tagv')

	def __init__(self, **kwargs):
		super(MetricCacheDatastore,self).__init__(**kwargs)
		#self.__collection_name = kwargs['collection']
		self.collection = self.db[kwargs['collection']]

	def cache(self, metaName, metaType):
		if metaType not in self.METATYPES:
			raise NameError('Invalid type: %s' %(metaType))
		return self.collection.update({'_id': "%s:%s" %(metaType, metaName)},
										{'name': metaName,'type': metaType}, 
										upsert=True)

	def bulkCache(self, metalist):
		for m in metalist:
			if m['type'] not in self.METATYPES:
				raise NameError('Invalid type: %(type)s %(name)s' %(m))
		try:
			return self.collection.insert(metalist, continue_on_error=True)
		except DuplicateKeyError,e:
			return {'warning': e}
		except Exception,e:
			return {'error': e}

	def search(self, query, limit=-1):
		if limit == -1:
			return [ r['name'] for r in self.collection.find({'type': query['type'], 
									'name':{'$regex': query['query']}}) ]
		else:
			return [ r['name'] for r in self.collection.find({'type': query['type'], 
						'name':{'$regex': query['query']}}).limit(limit) ]