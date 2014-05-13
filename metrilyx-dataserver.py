#!/usr/bin/env python

import sys
import json
import time
from pprint import pprint

from twisted.internet import reactor
from twisted.python import log
#from twisted.web.server import Site
#from twisted.web.static import File

from autobahn.twisted.websocket import WebSocketServerFactory, listenWS

from metrilyx.metrilyxconfig import config

from metrilyx.dataserver.protocols import GraphServerProtocol, acceptedCompression
from metrilyx.dataserver.dataproviders import TSDBDataProvider

WS_ADDRESS = "ws://localhost:9000"

"""
{
	"start": start_time,
	"graphType": "line",
	"name": metric,
	"series": [{
		"alias": metric,
		"yTransform": "",
		"query": {
			"metric": metric,
			"aggregator": "sum",
			"rate": rate,
			"tags": {}
		}
	}]
}
"""
class TSDBGraphServerProtocol(GraphServerProtocol):
	dataprovider = TSDBDataProvider(config['dataproviders']['tsdb'])


if __name__ == '__main__':

	if len(sys.argv) > 1 and sys.argv[1] == 'debug':
		log.startLogging(sys.stdout)
		debug = True
	else:
		debug = False

	factory = WebSocketServerFactory(WS_ADDRESS, debug=debug, debugCodePaths=debug)
	factory.protocol = TSDBGraphServerProtocol
	factory.setProtocolOptions(perMessageCompressionAccept=acceptedCompression)
	listenWS(factory)

	##  service static files
	#webdir = File(".")
	#web = Site(webdir)
	#reactor.listenTCP(8080, web)
	
	print "Starting websocket server: %s" %(WS_ADDRESS)
	reactor.run()

