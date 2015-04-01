
import sys

from twisted.internet import reactor
from twisted.internet.defer import Deferred

from autobahn.twisted.websocket import listenWS
from autobahn.twisted.websocket import WebSocketServerFactory

from protocols import getConfiguredProtocol, acceptedCompression

class MetrilyxWebSocketServerFactory(WebSocketServerFactory):
    """
        Factory to manage clients.  It also allows to drain clients
        and their respective active fetchers.
    """
    def __init__(self, logger, *args, **kwargs):
        WebSocketServerFactory.__init__(self, *args, **kwargs)
        self.logger = logger
        self.clients = []
        self.__drainDeferred = Deferred()
        self.__isDraining = False

    def addClient(self, client):
        self.clients.append(client)
        self.logger.warning("WebSocket clients: %d" %(len(self.clients)))

    def removeClient(self, client):
        self.clients.remove(client)
        self.logger.warning("Client removed.  Active clients: %d refs: %d" %(
            len(self.clients), sys.getrefcount(client)))

        if self.__isDraining and len(self.clients) == 0:
            self.logger.warning("All clients drained.")
            self.__drainDeferred.callback(None)


    def drainClients(self):
        """ 
            Issue drains to each client
        
            Return:
                deferred for when all clients are disconnected.
        """
        self.logger.warning("Initiating client drain: %d" % (len(self.clients)))
        
        self.__isDraining = True

        for c in self.clients:
            c.startDrain()

        return self.__drainDeferred


def setupWebSocketFactory(hostname, port, extPort, cLogger):
    """
        Registers factory along with the protocol

        Args:
            hostname : resolvable fqdn of the system
            port     : port to listen on
            extPort  : external port if running behind a proxy.
            logger   : global logger

        Return:
            websocket factory
            websocket listener object
    """
    factory = MetrilyxWebSocketServerFactory(cLogger, "ws://%s:%d" % (hostname, port), 
                                                                externalPort=extPort)
    factory.protocol = getConfiguredProtocol(cLogger)
    factory.setProtocolOptions(perMessageCompressionAccept=acceptedCompression)
    cLogger.warning("Starting websocket server: ws://%s:%d [permessage-deflate]" % (hostname, port))
    return factory, listenWS(factory)
