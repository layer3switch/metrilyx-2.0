
import multiprocessing

from twisted.internet import reactor
from autobahn.twisted.websocket import listenWS

from metrilyx.dataserver.protocols import acceptedCompression

from metrilyx.dataserver.wsfactory import MetrilyxWebSocketServerFactory


def spawnWebsocketServer(uri, protocol, externalPort=None):

    factory = MetrilyxWebSocketServerFactory(uri, externalPort=externalPort)
    factory.protocol = protocol
    factory.setProtocolOptions(perMessageCompressionAccept=acceptedCompression)

    listenWS(factory)
    reactor.run()


def spawnServers(protocol, logger, opts):
    
    procs = []
    for i in range(opts.serverCount):
        uri = "%s:%d" %(opts.uri, opts.startPort+i)
        proc = multiprocessing.Process(
                        target=spawnWebsocketServer,
                        args=(uri, protocol, opts.externalPort))
        proc.start()
        logger.warning("Started server - %s" %(uri))
        procs.append(proc)
    
    return procs