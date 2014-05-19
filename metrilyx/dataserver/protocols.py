
import logging
import json
from pprint import pprint 

from twisted.internet import reactor
from twisted.web.client import getPage, HTTPClientFactory, _makeGetterFactory

from autobahn.twisted.websocket import WebSocketServerProtocol
from autobahn.websocket.compress import PerMessageDeflateOffer, \
										PerMessageDeflateOfferAccept

from transforms import MetrilyxSerie

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

	def ds_response_callback(self, response, graph_meta=None):
		graph_meta['series'][0]['data'] = self.dataprovider.response_callback(
															json.loads(response))
		
		## apply metrilyx transforms
		mserie = MetrilyxSerie(graph_meta['series'][0])
		graph_meta['series'][0]['data'] = mserie.data
		self.sendMessage(json.dumps(graph_meta))

	def ds_response_errback(self, error, graph_meta=None):
		response = self.dataprovider.response_errback(error, graph_meta)
		self.sendMessage(json.dumps(response))

	def __submit_parallel_queries(self, req_obj):
		for (url, meta) in self.dataprovider.get_queries(req_obj):
			d = getPage(url)
			d.addCallback(self.ds_response_callback, meta)
			d.addErrback(self.ds_response_errback, meta)

	def onMessage(self, payload, isBinary):
		request_obj = self.checkMessage(payload, isBinary)
		if not request_obj.get("error"):
			## all checks passed - proceed
			logger.info("Request %(_id)s start=%(start)s" %(request_obj))
			self.__submit_parallel_queries(request_obj)
		else:
			logger.error("Invalid request object: %s" %(str(request_obj)))


