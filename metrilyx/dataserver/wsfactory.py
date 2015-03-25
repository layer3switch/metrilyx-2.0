
import sys
import logging

from twisted.internet import reactor
from twisted.internet.defer import Deferred

from autobahn.twisted.websocket import listenWS
from autobahn.twisted.websocket import WebSocketServerFactory

from protocols import getConfiguredProtocol, acceptedCompression

logger = logging.getLogger(__name__)

class MetrilyxWebSocketServerFactory(WebSocketServerFactory):
    """
        Factory to manage clients.  It also allows to drain clients
        and their respective active fetchers.
    """
     
    clients = []
    __drainDeferred = Deferred()
    __isDraining = False

    def addClient(self, client):
        self.clients.append(client)
        logger.warning("WebSocket clients: %d" %(len(self.clients)))

    def removeClient(self, client):
        self.clients.remove(client)
        logger.warning("Client removed.  Active clients: %d refs: %d" %(
            len(self.clients), sys.getrefcount(client)))

        if self.__isDraining and len(self.clients) == 0:
            logger.warning("All clients drained.")
            self.__drainDeferred.callback(None)


    def drainClients(self):
        """ 
            Issue drains to each client
        
            Return:
                deferred for when all clients are disconnected.
        """
        logger.warning("Initiating client drain: %d" % (len(self.clients)))
        
        self.__isDraining = True

        for c in self.clients:
            c.startDrain()

        return self.__drainDeferred


def setupWebSocketFactory(hostname, port, extPort):
    """
        Registers factory along with the protocol

        Args:
            hostname : resolvable fqdn of the system
            port     : port to listen on
            extPort  : external port if running behind a proxy.

        Return:
            websocket factory
            websocket listener object
    """
    factory = MetrilyxWebSocketServerFactory("ws://%s:%d" % (hostname, port), extPort)
    factory.protocol = getConfiguredProtocol()
    factory.setProtocolOptions(perMessageCompressionAccept=acceptedCompression)
    logger.warning("Starting websocket server: ws://%s:%d [permessage-deflate]" % (hostname, port))
    return factory, listenWS(factory)
