
import logging
import json
from pprint import pprint 

from twisted.internet import reactor
from twisted.web.client import getPage, HTTPClientFactory, _makeGetterFactory

from autobahn.twisted.websocket import WebSocketServerProtocol
from autobahn.websocket.compress import PerMessageDeflateOffer, \
										PerMessageDeflateOfferAccept

from ..httpclients import AsyncHttpJsonRequest
from transforms import MetrilyxSerie, EventannoSerie

logger = logging.getLogger(__name__)

"""
def advancedGetPage(url, contextFactory=None, *args, **kwargs):
	return _makeGetterFactory(
		url,
		HTTPClientFactory,
		contextFactory=contextFactory,
		*args, **kwargs)

		# factory.deferred.addCallback....
"""

## Enable WebSocket extension "permessage-deflate".
## Function to accept offers from the client ..
def acceptedCompression(offers):
	for offer in offers:
		if isinstance(offer, PerMessageDeflateOffer):
			return PerMessageDeflateOfferAccept(offer)

class BaseGraphServerProtocol(WebSocketServerProtocol):
	REQUIRED_REQUEST_KEYS = ('_id', 'start', 'graphType', 'series',)

	def onConnect(self, request):
		logger.info("WebSocket connection request by %s" %(str(request.peer)))

	def onOpen(self):
		logger.info("WebSocket connection opened. extensions: %s" %(self.websocket_extensions_in_use))

	def checkMessage(self, payload, isBinary):
		if not isBinary:
			try:
				obj = json.loads(payload)
				for k in self.REQUIRED_REQUEST_KEYS:
					if not obj.has_key(k):
						self.sendMessage(json.dumps({"error": "Invalid key: '%s'" %(k)}))
						logger.warning("Invalid key '%s'" %(k))
						return {"error": "Invalid key: '%s'" %(k)}
				return obj
			except Exception, e:
				self.sendMessage(json.dumps({'error': str(e)}))
				logger.error(str(e))
				return {'error': str(e)}
		else:
			self.sendMessage(json.dumps({'error': 'Binary data not support!'}))
			logger.warning("Binary data not supported!")
			return {'error': 'Binary data not support!'}

class GraphServerProtocol(BaseGraphServerProtocol):
	## set dataprovider in subclass
	dataprovider = None
	timeout = 0

	def ds_response_callback(self, response, url, graph_meta=None):
		graph_meta['series'][0]['data'] = self.dataprovider.response_callback(
															json.loads(response))
		
		## apply metrilyx transforms
		mserie = MetrilyxSerie(graph_meta['series'][0])
		graph_meta['series'][0]['data'] = mserie.data
		self.sendMessage(json.dumps(graph_meta))

	def ds_response_errback(self, error, url, graph_meta=None):
		response = self.dataprovider.response_errback(error, graph_meta)
		self.sendMessage(json.dumps(response))


	def submitPerfQueries(self, req_obj):
		for (url, meta) in self.dataprovider.get_queries(req_obj):
			d = getPage(url, timeout=self.timeout)
			d.addCallback(self.ds_response_callback, url, meta)
			d.addErrback(self.ds_response_errback, url, meta)

	def submit_parallel_queries(self, req_obj):
		'''
		This gets called when a message is recieved
		'''
		self.submitPerfQueries(req_obj)

	def onMessage(self, payload, isBinary):
		request_obj = self.checkMessage(payload, isBinary)
		if not request_obj.get("error"):
			## all checks passed - proceed
			logger.info("Request %(_id)s start=%(start)s" %(request_obj))
			self.submit_parallel_queries(request_obj)
		else:
			logger.error("Invalid request object: %s" %(str(request_obj)))

	"""
	def onClose(self, wasClean, code, reason):
		for k in self.active_queries.keys():
			self.active_queries[k].cancel()
			del self.active_queries[k]
	"""

class AnnoEventGraphServerProtocol(GraphServerProtocol):
	annoEventDataProvider = None

	def submit_parallel_queries(self, req_obj):
		'''
		This gets called when a message is recieved
		'''
		self.submitPerfQueries(req_obj)
		self.__fetchAnnoEvents(req_obj)

	def ae_response_callback(self, data, annoType, query, graph):
		try:
			dct = json.loads(data)
			if dct.has_key('error'):
				logger.error(str(dct))
				return
			eas = EventannoSerie([ h['_source'] for h in dct['hits']['hits'] ])
			if len(eas.data) < 1:
				logger.debug("%s %s" %(annoType, graph['_id']))
				return
			
			out = {
				'_id': graph['_id'],
				'annoEvents': graph['annoEvents'],
				'graphType': graph['graphType']
				}
			out['annoEvents']['data'] = eas.data
			out['annoEvents']['eventType'] = annoType
			self.sendMessage(json.dumps(out))
			logger.info("%s %s %d" %(graph['_id'], annoType, len(eas.data)))
		except Exception,e:
			logger.error(str(e))

	def __fetchAnnoEvents(self, graphMeta):
		if len(graphMeta['annoEvents']['types']) < 1 or \
					len(graphMeta['annoEvents']['tags'].keys()) < 1:
			return
		request = {
			'start': graphMeta['start']*1000000,
			'tags': graphMeta['annoEvents']['tags'],
			'types': graphMeta['annoEvents']['types']
		}
		if graphMeta.has_key('end'):
			request['end'] = graphMeta['end']*1000000
		for (url, eventType, query) in self.annoEventDataProvider.getQueries(request):
			#print graphMeta['_id'], eventType
			#print eventType, query
			a = AsyncHttpJsonRequest(uri=url, method='GET', body=query)
			a.addResponseCallback(self.ae_response_callback, eventType, query, graphMeta)
