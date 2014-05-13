
import json
from pprint import pprint 

from twisted.web.client import getPage
from autobahn.twisted.websocket import WebSocketServerProtocol
from autobahn.websocket.compress import PerMessageDeflateOffer, \
										PerMessageDeflateOfferAccept

from transforms import MetrilyxSerie

## Enable WebSocket extension "permessage-deflate".
## Function to accept offers from the client ..
def acceptedCompression(offers):
	for offer in offers:
		if isinstance(offer, PerMessageDeflateOffer):
			return PerMessageDeflateOfferAccept(offer)

class BaseGraphServerProtocol(WebSocketServerProtocol):
	REQUIRED_REQUEST_KEYS = ('_id', 'start', 'graphType', 'series',)

	def onConnect(self, request):
		print("WebSocket connection request by {}".format(request.peer))

	def onOpen(self):
		print("WebSocket connection opened. extensions: {}".format(self.websocket_extensions_in_use))

	def checkMessage(self, payload, isBinary):
		if not isBinary:
			try:
				obj = json.loads(payload)
				for k in self.REQUIRED_REQUEST_KEYS:
					if not obj.has_key(k):
						self.sendMessage(json.dumps({"error": "Invalid key: '%s'" %(k)}))
						return {"error": "Invalid key: '%s'" %(k)}
				return obj
			except Exception, e:
				self.sendMessage(json.dumps({'error': str(e)}))
				return {'error': str(e)}
		else:
			self.sendMessage(json.dumps({'error': 'Binary data not support!'}))
			return {'error': 'Binary data not support!'}

class GraphServerProtocol(BaseGraphServerProtocol):
	## set dataprovider in subclass
	dataprovider = None

	def ds_response_callback(self, response, graph_meta=None):
		graph_meta['series'][0]['data'] = self.dataprovider.response_callback(
															json.loads(response))
		
		#pprint(graph_meta)
		## apply metrilyx transforms
		mserie = MetrilyxSerie(graph_meta['series'][0])
		graph_meta['series'][0]['data'] = mserie.data
		self.sendMessage(json.dumps(graph_meta))

	def ds_response_errback(self, error, graph_meta=None):
		self.sendMessage(json.dumps(
			self.dataprovider.response_errback(error, graph_meta)))

	def __submit_parallel_queries(self, req_obj):
		for (url, meta) in self.dataprovider.get_queries(req_obj):
			d = getPage(url)
			d.addCallback(self.ds_response_callback, meta)
			d.addErrback(self.ds_response_errback, meta)

	def onMessage(self, payload, isBinary):
		request_obj = self.checkMessage(payload, isBinary)
		if not request_obj.get("error"):
			## all checks passed - proceed
			self.__submit_parallel_queries(request_obj)
		else:
			print "Invalid request object:", str(request_obj)


