
import sys

import logging
import ujson as json
import time
from datetime import datetime

from twisted.internet import reactor

from autobahn.twisted.websocket import WebSocketServerProtocol
from autobahn.websocket.compress import PerMessageDeflateOffer, PerMessageDeflateOfferAccept

from httpfetcher import MetrilyxGraphFetcher
from transforms import MetrilyxSerie, MetrilyxAnalyticsSerie
from datarequest import PanelRequest

from dataproviders.opentsdb import getPerfDataProvider

from pprint import pprint

logger = logging.getLogger(__name__)


def writeRequestLogLine(request_obj):
    logger.info("Request type=%s, name='%s', sub-queries=%d, id=%s, start='%s'" %(
        request_obj['graphType'], request_obj['name'], len(request_obj['series']),
        request_obj['_id'], datetime.fromtimestamp(float(request_obj['start']))))


def writeResponseLogLine(graph):
    logger.info("Response type=%s, id=%s, name='%s', start='%s'" %(
                        graph['graphType'], graph['_id'],  graph['name'],
                        datetime.fromtimestamp(float(graph['start']))))


## Enable WebSocket extension "permessage-deflate".
## Function to accept offers from the client ..
def acceptedCompression(offers):
    for offer in offers:
        if isinstance(offer, PerMessageDeflateOffer):
            return PerMessageDeflateOfferAccept(offer)


class BaseGraphServerProtocol(WebSocketServerProtocol):
    """
        Basic protocol that handles incoming requests.
        This checks the request and submits it for processing. It also keeps track 
        of all active queries to the backend (i.e. fetcher).

        If needed, 'GraphServerProtocol' should be subclassed instead.
    """
    # Store active fetchers
    __activeFetchers = {}
    # Timeout for long running fetchers
    __activeFetchersTimeout = 900
    # Expirer deferred
    expirerDeferred = None

    __isDraining = False

    def removeFetcher(self, key):
        """
            Remove a fetcher.  Disconnect client if draining and the
            drain is complete.
        """
        if self.__activeFetchers.has_key(key):
            try:
                del self.__activeFetchers[key]
            except Exception, e:
                logger.warning(e)
        
        logger.info("Active fetchers: %d" %(len(self.__activeFetchers.keys())))

        if len(self.__activeFetchers.keys()) == 0 and self.__isDraining:
            self.__onDrainComplete()

    def __onDrainComplete(self):
        try:
            self.expirerDeferred.cancel()
        except Exception:
            pass
        logger.warning("Fetcher drain complete. Disconnecting client...")
        self.transport.loseConnection()

    def addFetcher(self, key, fetcher):
        """
            Add a new fetcher if we are not draining. This is for tracking purposes.
        """
        if self.__activeFetchers.has_key(key):
            logger.warning("Fetcher inprogress: %s" %(key))
            self.__activeFetchers[key].cancelRequests()
        
        self.__activeFetchers[key] = fetcher


    def scheduleExpiration(self):
        self.expirerDeferred = reactor.callLater(self.__activeFetchersTimeout, 
                                                    self.__expireActiveFetchers)

    def __expireActiveFetchers(self):
        """
            Expire long running or stuck fetchers
        """
        logger.info("Removing fetchers with runtime > %d" % (self.__activeFetchersTimeout))

        expireTime = time.time() - self.__activeFetchersTimeout
        expired = 0
        for k,v in self.__activeFetchers.items():
            if float(k.split("-")[-1]) <= expireTime:
                v.cancelRequests()
                self.removeFetcher(k)
                logger.info("Expired fetcher: %s" %(k))
                expired += 1

        logger.info("Expired %d fetchers" %(expired))
        self.scheduleExpiration()


    def cancelAllFetchers(self):
        """
            Cancel all active fetchers.
        """
        for k, d in self.__activeFetchers.items():
            d.cancelRequests()
            self.removeFetcher(k)

    def startDrain(self):
        """ 
            Start draining fetchers 
        """
        self.__isDraining = True
        if len(self.__activeFetchers.keys()) == 0:
            self.__onDrainComplete()

    def onConnect(self, request):
        logger.info("Connected: %s" %(str(request.peer)))

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
        # Drop requests from active connections if we are shutting down.
        if self.__isDraining:
            logger.info("Draining connections. Dropping request...")
            return

        request_obj = self.checkMessage(payload, isBinary)
        if not request_obj.get("error"):
            
            writeRequestLogLine(request_obj)
            try:
                panelReq = PanelRequest(**request_obj)
                self.processRequest(panelReq)
            except Exception,e:
                logger.error(str(e) + " " + str(request_obj))
        else:
            logger.error("Invalid request object: %s" %(str(request_obj)))


    def processRequest(self, graphOrAnnoRequest):
        """
            Implemented by subclasser
        """
        pass


class GraphServerProtocol(BaseGraphServerProtocol):
    """ 
        This class should be subclassed with the 'dataprovider' attribute
        initialized accordingly.
    """
    
    def processRequest(self, graphRequest):
        mgf = MetrilyxGraphFetcher(self.dataprovider, graphRequest)

        # id and timestamp key to track fetcher.
        stamp = "%s-%f" %(graphRequest._id, time.time())
        mgf.addCompleteCallback(self.completeCallback, stamp)
        mgf.addCompleteErrback(self.completeErrback, graphRequest.request(), stamp)
        mgf.addPartialResponseCallback(self.partialResponseCallback)
        mgf.addPartialResponseErrback(self.partialResponseErrback, graphRequest.request())

        self.addFetcher(stamp, mgf)


    def completeErrback(self, error, *cbargs):
        (request, key) = cbargs
        self.removeFetcher(key)

        if "CancelledError" not in str(error):
            logger.error("%s" %(str(error)))

    def completeCallback(self, *cbargs):
        """ 
            Callback after a complete panel/graph has been fetched.
        """
        (graph, key) = cbargs
        self.removeFetcher(key)

        if graph != None:
            self.sendMessage(json.dumps(graph))
            logger.info("Reponse (secondaries graph) %s '%s' start: %s" %(graph['_id'],
                    graph['name'], datetime.fromtimestamp(float(graph['start']))))


    def partialResponseCallback(self, graph):
        self.sendMessage(json.dumps(graph))
        writeResponseLogLine(graph)

    def partialResponseErrback(self, error, *cbargs):
        (graphMeta,) = cbargs
        if "CancelledError" not in str(error):
            logger.error("%s" %(str(error)))
            errResponse = self.dataprovider.responseErrback(error, graphMeta)
            self.sendMessage(json.dumps(errResponse))

    def onOpen(self):
        logger.info("Connection opened. extensions: %s" %(self.websocket_extensions_in_use))
        # Add client to factory
        self.factory.addClient(self)
        # Schedule  fetcher expiration
        logger.info("Scheduling fetcher expiration...")
        self.scheduleExpiration()

    def onClose(self, wasClean, code, reason):
        logger.info("Connection closed: wasClean=%s code=%s reason=%s" % 
                                (str(wasClean), str(code), str(reason)))

        self.cancelAllFetchers()
        
        try:
            self.expirerDeferred.cancel()
        except Exception:
            pass
        
        self.factory.removeClient(self)


# Get protocol using the configured dataprovider and a subclass
# of GraphServerProtocol 
def getConfiguredProtocol():
    try:
        class GraphProtocol(GraphServerProtocol):
            dataprovider = getPerfDataProvider()

        return GraphProtocol
        #logger.warning("Protocol: %s" %(str(proto)))
    except Exception,e:
        logger.error("Could not set dataprovider and/or protocol: %s" %(str(e)))
        sys.exit(2)
