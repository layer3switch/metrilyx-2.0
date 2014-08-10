
import time

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
		self.collection = self.db[kwargs['collection']]
		# in seconds
		if not kwargs.has_key('retention_period'):
			self.retention_period = 300
		else:
			self.retention_period = kwargs['retention_period']

	def cache(self, cache_dict):
		if cache_dict['type'] not in self.METATYPES:
			raise NameError('Invalid type: %(type)s' %(cache_dict))
		#cache_dict['lastupdated'] = time.time()
		return self.collection.update({'_id': "%(type)s:%(name)s" %(cache_dict)},
													cache_dict, upsert=True)

	def bulkCache(self, metalist):
		'''
		rslts = []
		for m in metalist:
			try:
				rslts.append(self.cache(m))
			except Exception,e:
				print "ERROR", e
				rslts.append(dict([(k,v) for k,v in m.items()]+[('error',str(e))]))
		
		return { "status": "updated", "results": rslts }
		'''
		for m in metalist:
			if m['type'] not in self.METATYPES:
				raise NameError('Invalid type: %(type)s' %(cache_dict))
			m['lastupdated'] = time.time()
		try:
			return self.collection.insert(metalist, continue_on_error=True)
		except DuplicateKeyError,e:
			return {'status': 'already exists'}
		except Exception,e:
			return {'error': e}

	def expireCache(self):
		return self.collection.remove({
				'lastupdated': {'$lt': time.time()-self.retention_period }
				})

	def search(self, query, limit=-1):
		if limit == -1:
			return [ r['name'] for r in self.collection.find({'type': query['type'], 
									'name':{'$regex': query['query']}}) ]
		else:
			return [ r['name'] for r in self.collection.find({'type': query['type'], 
						'name':{'$regex': query['query']}}).limit(limit) ]