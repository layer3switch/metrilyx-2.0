
import logging
import json
from datetime import datetime

from twisted.internet import reactor

from autobahn.twisted.websocket import WebSocketServerProtocol
from autobahn.websocket.compress import PerMessageDeflateOffer, \
										PerMessageDeflateOfferAccept

from ..httpclients import AsyncHttpJsonClient
from transforms import MetrilyxSerie, EventSerie
from ..dataserver import GraphRequest, GraphEventRequest
from dataproviders import re_504

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
			try:
				## all checks passed - proceed
				logger.info("Request %s '%s' start: %s" %(request_obj['_id'], request_obj['name'],
										datetime.fromtimestamp(float(request_obj['start']))))
				graphReq = GraphRequest(request_obj)
				self.processRequest(graphReq)
			except Exception,e:
				logger.error(str(e))
		else:
			logger.error("Invalid request object: %s" %(str(request_obj)))

	def processRequest(self, graphRequest):
		'''
			This is a stub that is overwritten in 'GraphServerProtocol'
		'''
		pass


class GraphServerProtocol(BaseGraphServerProtocol):

	def graphResponseErrback(self, error, graphMeta):
		# call dataprovider errback (diff for diff backends)
		logger.error("%s" %(str(error)))
		errResponse = self.dataprovider.responseErrback(error, graphMeta)
		self.sendMessage(json.dumps(errResponse))

	def _checkResponse(self, respBodyStr, response, url, graphMeta):
		if response.code < 200 or response.code > 304:
			logger.warning("Request failed %d %s %s %s" %(response.code, respBodyStr, url, str(graphMeta)))
			m = re_504.search(respBodyStr)
			if  m != None:
				return {"error": "code=%d,response=%self" %(response.code, m.group(1))}
			return {"error": "code=%s,response=%s" %(response.code, respBodyStr)}

		try:
			d = json.loads(respBodyStr)
			if isinstance(d, dict) and d.has_key('error'):
				logger.warning(str(d))
				return d
			return {'data': d}
		except Exception, e:
			logger.warning("%s %s %s" %(str(e), url, str(graphMeta)))
			return {"error": str(e)}

	def graphResponseCallback(self, respBodyStr, response, url, graphMeta):
		responseData = self._checkResponse(respBodyStr, response, url, graphMeta)
		if responseData.has_key('error'):
			graphMeta['series'][0]['data'] = responseData
		else:
			graphMeta['series'][0]['data'] = self.dataprovider.responseCallback(
											responseData['data'], url, graphMeta)
			mserie = MetrilyxSerie(graphMeta['series'][0])
			graphMeta['series'][0]['data'] = mserie.data
		
		self.sendMessage(json.dumps(graphMeta))
		logger.info("Response (graph) %s '%s' start: %s" %(graphMeta['_id'], 
			graphMeta['name'], datetime.fromtimestamp(float(graphMeta['start']))))

	def processRequest(self, graphRequest):
		self.submitPerfQueries(graphRequest)

	def submitPerfQueries(self, graphRequest):
		for serieReq in graphRequest.split():
			(url, method, query) = self.dataprovider.getQuery(serieReq)
		 	a = AsyncHttpJsonClient(uri=url, method=method, body=query)
			a.addResponseCallback(self.graphResponseCallback, url, serieReq)
			a.addResponseErrback(self.graphResponseErrback, serieReq)

	"""
	def onClose(self, wasClean, code, reason):
		for k in self.active_queries.keys():
			self.active_queries[k].cancel()
			del self.active_queries[k]
	"""

class EventGraphServerProtocol(GraphServerProtocol):
	eventDataprovider = None

	def processRequest(self, graphRequest):
		# submit graph data queries
		self.submitPerfQueries(graphRequest)
		# submit event queries
		self.submitEventQueries(graphRequest.request)

	def eventResponseCallback(self, data, response, url, eventType, graph):
		dct = self._checkResponse(data, response, url, graph)
		if dct.has_key('error'):
			logger.error(str(dct))
			return

		eas = EventSerie(self.eventDataprovider.responseCallback(dct['data']),
													graph, eventType)
		if len(eas.data['annoEvents']['data']) < 1:
			logger.info("Event annotation: type=%s no data (%s)" %(
												eventType, graph['_id']))
			return

		self.sendMessage(json.dumps(eas.data))
		logger.info("Event annotation: sha1=%s type=%s count=%d" %(graph['_id'], 
									eventType, len(eas.data['annoEvents']['data'])))
	
	def eventReponseErrback(self, error, response, url, eventType, graph):
		logger.error(str(error))

	def submitEventQueries(self, request):
		## TODO: this will raise an exception 
		if len(request['annoEvents']['tags'].keys()) < 1 or \
					len(request['annoEvents']['eventTypes']) < 1: 
			return

		graphEvtReq = GraphEventRequest(request)
		
		for graphEvent in graphEvtReq.split():
			(url, method, query) = self.eventDataprovider.getQuery(graphEvent)
			a = AsyncHttpJsonClient(uri=url, method=method, body=query)
			a.addResponseCallback(self.eventResponseCallback, 
					url, graphEvent['eventTypes'][0], request)
			a.addResponseErrback(self.eventReponseErrback,
					url, graphEvent['eventTypes'][0], request)
