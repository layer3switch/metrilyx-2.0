
import logging
import json
from datetime import datetime

from twisted.internet import reactor

from autobahn.twisted.websocket import WebSocketServerProtocol
from autobahn.websocket.compress import PerMessageDeflateOffer, \
										PerMessageDeflateOfferAccept

from ..httpclients import AsyncHttpJsonClient, checkHttpResponse, MetrilyxGraphFetcher
from transforms import MetrilyxSerie, EventSerie, MetrilyxAnalyticsSerie
from ..dataserver import GraphRequest, GraphEventRequest

from pprint import pprint

logger = logging.getLogger(__name__)


## Enable WebSocket extension "permessage-deflate".
## Function to accept offers from the client ..
def acceptedCompression(offers):
	for offer in offers:
		if isinstance(offer, PerMessageDeflateOffer):
			return PerMessageDeflateOfferAccept(offer)

class BaseGraphServerProtocol(WebSocketServerProtocol):
	'''
		Basic protocol that handles incoming requests. 
		This does nothing more than check the request and submit for processing.  
		If needed, 'GraphServerProtocol' should be subclassed instead.
	'''
	def onConnect(self, request):
		logger.info("WebSocket connection request by %s" %(str(request.peer)))

	def onOpen(self):
		logger.info("WebSocket connection opened. extensions: %s" %(
										self.websocket_extensions_in_use))

	def onClose(self, wasClean, code, reason):
		logger.info("WebSocket closed wasClean=%s code=%s reason=%s" %(
								str(wasClean), str(code), str(reason)))


	def checkMessage(self, payload, isBinary):
		if not isBinary:
			try:
				return json.loads(payload)
			except Exception, e:
				self.sendMessage(json.dumps({'error': str(e)}))
				logger.error(str(e))
				return {'error': str(e)}
		else:
			self.sendMessage(json.dumps({'error': 'Binary data not support!'}))
			logger.warning("Binary data not supported!")
			return {'error': 'Binary data not support!'}

	def onMessage(self, payload, isBinary):
		'''
			Check the payload validity
			Split the request into 1 request per metric.
			Call dataprovider to get query.
			Submit query.
		'''
		request_obj = self.checkMessage(payload, isBinary)
		if not request_obj.get("error"):
			## all checks passed - proceed
			try:
				if request_obj['_id'] == 'annotations':
					## annotation request
					logger.info("Annotation Request: %s" %(str(request_obj)))
					self.processRequest(request_obj)
				else:
					## graph request	
					logger.info("Request %s '%s' start: %s" %(request_obj['_id'], 
						request_obj['name'], datetime.fromtimestamp(float(request_obj['start']))))
					graphReq = GraphRequest(request_obj)
					self.processRequest(graphReq)
			except Exception,e:
				logger.error(str(e) + " " + str(request_obj))
		else:
			logger.error("Invalid request object: %s" %(str(request_obj)))

	def processRequest(self, graphOrAnnoRequest):
		'''
			This is a stub that is overwritten in 'GraphServerProtocol'
		'''
		pass


class GraphServerProtocol(BaseGraphServerProtocol):

	def processRequest(self, graphRequest):
		self.submitPerfQueries(graphRequest)

	def submitPerfQueries(self, graphRequest):
		mgf = MetrilyxGraphFetcher(self.dataprovider, graphRequest)
		mgf.addCompleteCallback(self.completeCallback)
		mgf.addCompleteErrback(self.completeErrback, graphRequest.request)
		mgf.addPartialResponseCallback(self.partialResponseCallback)
		mgf.addPartialResponseErrback(self.partialResponseErrback, graphRequest.request)

	def completeCallback(self, graph):
		self.sendMessage(json.dumps(graph))
		logger.info("Reponse (secondaries graph) %s '%s' start: %s" %(graph['_id'], 
					graph['name'], datetime.fromtimestamp(float(graph['start']))))

	def completeErrback(self, error, *cbargs):
		logger.error("%s" %(str(error)))

	def partialResponseCallback(self, graph):
		self.sendMessage(json.dumps(graph))
		logger.info("Response (graph) %s '%s' start: %s" %(graph['_id'], 
			graph['name'], datetime.fromtimestamp(float(graph['start']))))

	def partialResponseErrback(self, error, *cbargs):
		(graphMeta,) = cbargs
		logger.error("%s" %(str(error)))
		errResponse = self.dataprovider.responseErrback(error, graphMeta)
		self.sendMessage(json.dumps(errResponse))

	"""
	def onClose(self, wasClean, code, reason):
		for k in self.active_queries.keys():
			self.active_queries[k].cancel()
			del self.active_queries[k]
	"""

class EventGraphServerProtocol(GraphServerProtocol):
	eventDataprovider = None

	def processRequest(self, graphOrAnnoRequest):
		if isinstance(graphOrAnnoRequest, GraphRequest):	
			# submit graph data queries
			self.submitPerfQueries(graphOrAnnoRequest)
		elif graphOrAnnoRequest['_id'] == 'annotations':
			# submit annnotation queries
			self.submitEventQueries(graphOrAnnoRequest)
		
	def eventResponseCallback(self, data, response, url, eventType, request):
		dct = checkHttpResponse(data, response, url)
		if dct.has_key('error'):
			logger.error(str(dct))
			return

		eas = EventSerie(self.eventDataprovider.responseCallback(dct['data']), eventType, request)
		if len(eas.data['annoEvents']['data']) < 1:
			logger.info("Event annotation: type=%s no data" %(eventType))
			return

		self.sendMessage(json.dumps(eas.data))
		logger.info("Event annotation: type=%s count=%d" %(eventType, 
									len(eas.data['annoEvents']['data'])))
	
	def eventReponseErrback(self, error, url, eventType, request):
		logger.error(str(error))

	def submitEventQueries(self, request):
		## TODO: this will raise an exception 
		if len(request['annoEvents']['tags'].keys()) < 1 or \
					len(request['annoEvents']['eventTypes']) < 1: 
			return

		graphEvtReq = GraphEventRequest(request)

		for graphEvent in graphEvtReq.split():
			for (url, method, query) in self.eventDataprovider.getQuery(graphEvent):
				a = AsyncHttpJsonClient(uri=url, method=method, body=query)
				a.addResponseCallback(self.eventResponseCallback, 
						url, graphEvent['eventTypes'][0], request)
				a.addResponseErrback(self.eventReponseErrback,
						url, graphEvent['eventTypes'][0], request)

