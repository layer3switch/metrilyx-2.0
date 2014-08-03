
import time
from pprint import pprint

class GraphEventRequest(object):
	REQUIRED_GRAPH_KEYS = ('start', '_id',)
	REQUIRED_EVENT_KEYS = ('eventTypes', 'tags')

	def __init__(self, request):
		self.__checkRequest(request)
		self.request = request
		#self.__applyGlobalTagsToEvents()

	def __applyGlobalTagsToEvents(self):
		'''
			Applies global tags to events.  For now, this takes precendence over
			other tags specified.
		'''
		for k,v in self.request['tags'].items():
			self.request['annoEvents']['tags'][k] = v

	def __checkRequest(self, request):
		for k in self.REQUIRED_EVENT_KEYS:
			if not request['annoEvents'].has_key(k):
				raise NameError('Missing key: %s' %(k))
		for k in self.REQUIRED_GRAPH_KEYS:
			if not request.has_key(k):
				raise NameError('Missing key: %s' %(k))

		if len(request['annoEvents']['eventTypes']) < 1 or \
					len(request['annoEvents']['tags'].keys()) < 1:
			raise NameError('Must specify atleast 1 event type and a pair of tags')

	def split(self):
		for etype in self.request['annoEvents']['eventTypes']:
			erequest = {
				'start': self.request['start']*1000000,
				'tags': self.request['annoEvents']['tags'],
				'eventTypes': [etype]
			}
			if self.request.has_key('end'):
				erequest['end'] = self.request['end']*1000000
			yield erequest

class GraphRequest(object):
	REQUIRED_REQUEST_KEYS = ('_id', 'start', 'graphType', 'series',)

	def __init__(self, request):
		self.__checkRequest(request)
		self.__cleanRequest(request)
		self.request = request
		self.__applyGlobalTagsToSeries()
		self.__adjustTimeWindow()

	def split(self):
		'''
			Return: Broken up graph request - 1 per metric with graph metadata
		'''
		for serie in self.request['series']:
			obj = dict([ (k,v) for k,v in self.request.items() if k != "series" ])
			obj['series'] = [serie]
			yield obj

	def __cleanRequest(self, request):
		if request.has_key('series'):
			for s in request['series']:
				if s.has_key('$$hashKey'):
					del s['$$hashKey']

	def __checkRequest(self, request):
		for k in self.REQUIRED_REQUEST_KEYS:
			if not request.has_key(k):
				raise NameError('Missing key: %s' %(k))

	def __applyGlobalTagsToSeries(self):
		for serie in self.request['series']:
			for k,v in self.request['tags'].items():
				serie['query']['tags'][k] = v

	def __adjustTimeWindow(self):
		'''
		Change query to last 5 min if pie graph
		'''
		if self.request.get('end'):
			if self.request['graphType'] == 'pie':
				self.request['start'] = self.request['end']-300
		else:
			if self.request['graphType'] == 'pie':
				self.request['start'] = int(time.time()-300)

