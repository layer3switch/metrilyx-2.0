
import logging
from autobahn.twisted.websocket import WebSocketServerFactory

logger = logging.getLogger(__name__)

class MetrilyxWebSocketServerFactory(WebSocketServerFactory):

    clients = []

    def addClient(self, client):
        self.clients.append(client)
        logger.warning("WebSocket clients: %d" %(len(self.clients)))

    def removeClient(self, client):
        self.clients.remove(client)
        logger.warning("WebSocket clients: %d" %(len(self.clients)))