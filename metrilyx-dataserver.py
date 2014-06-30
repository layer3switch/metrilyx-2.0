#!/usr/bin/env python

import sys
import json
import time
import logging

import multiprocessing
from optparse import OptionParser

from twisted.internet import reactor
from twisted.python import log

from autobahn.twisted.websocket import WebSocketServerFactory, listenWS

from metrilyx.metrilyxconfig import config
from metrilyx.dataserver.protocols import GraphServerProtocol, \
					EventGraphServerProtocol, acceptedCompression
from metrilyx.dataserver.dataproviders import TSDBDataProvider
from metrilyx.datastores.ess import ElasticsearchDatastore

LOG_FORMAT = "%(asctime)s [%(levelname)s %(name)s]: %(message)s"

class TSDBGraphServerProtocol(GraphServerProtocol):
	dataprovider = TSDBDataProvider(config['dataproviders'][0])
	timeout = config['dataproviders'][0]['timeout']

class ESEventGraphServerProtocol(EventGraphServerProtocol):
	dataprovider = TSDBDataProvider(config['dataproviders'][0])
	timeout = config['dataproviders'][0]['timeout']	
	eventDataprovider = ElasticsearchDatastore(config['annotations']['dataprovider'])

def spawn_websocket_server(uri, logLevel, externalPort=None):
	if logLevel == "DEBUG":
		isDebug = True
	else:
		isDebug = False

	if externalPort == None:
		factory = WebSocketServerFactory(uri, debug=isDebug)
	else:
		factory = WebSocketServerFactory(uri, debug=isDebug, 
										externalPort=externalPort)

	if config['annotations']['enabled']:
		factory.protocol = ESEventGraphServerProtocol
	else:
		factory.protocol = TSDBGraphServerProtocol
	
	factory.setProtocolOptions(
			perMessageCompressionAccept=acceptedCompression)
	
	listenWS(factory)
	reactor.run()


if __name__ == '__main__':

	parser = OptionParser()
	parser.add_option("-l", "--log-level", dest="logLevel", default="INFO", 
		help="Logging level.")
	parser.add_option("-u", "--uri", dest="uri", default="ws://localhost",
		help="ws://<hostname>")
	parser.add_option("-s", "--start-port", dest="startPort", type="int", default=9000,
		help="Starting point of the port range to listen on. This is only applicable when multiple servers are launched.")
	parser.add_option("-c","--server-count", dest="serverCount", type="int", default=1,
		help="Number of servers to spawn. If 0 is specified, the count will be based off of the number cpus/cores")
	parser.add_option("-e", "--external-port", dest="externalPort", type="int", default=None,
		help="External port to use.  This is needed when running the servers behind a reverse proxy (i.e nginx)")

	(opts, args) = parser.parse_args()

	if not opts.uri:
		print " --uri required!"
		parser.print_help()
		sys.exit(1)

	if opts.logLevel == "DEBUG":
		# twisted logger (may not be needed)
		log.startLogging(sys.stdout)
		observer = log.PythonLoggingObserver()
		observer.start()

	try:
		logging.basicConfig(level=eval("logging.%s" %(opts.logLevel)),
			format=LOG_FORMAT)
		logger = logging.getLogger(__name__)
	except Exception,e:
		print "[ERROR] %s" %(str(e))
		parser.print_help()
		sys.exit(2)
	
	if opts.serverCount == 0:
		logger.info("Using auto-spawn count.")
		opts.serverCount = multiprocessing.cpu_count()
	logger.info("Spawning %d server/s..." %(opts.serverCount))
	
	procs = []
	for i in range(opts.serverCount):
		uri = "%s:%d" %(opts.uri, opts.startPort+i)
		proc = multiprocessing.Process(
								target=spawn_websocket_server, 
								args=(uri, opts.logLevel, opts.externalPort))
		proc.start()
		logger.info("Started server - %s" %(uri))
		procs.append(proc)

	try:
		for p in procs:
			p.join()
	except KeyboardInterrupt:
		logger.info("Stopping...")
