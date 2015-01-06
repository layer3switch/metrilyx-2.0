#!/usr/bin/env python

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ujson as json
import time
import logging

from optparse import OptionParser

from twisted.internet import reactor
from twisted.python import log

import multiprocessing

from metrilyx.metrilyxconfig import config
from metrilyx.dataserver.protocols import GraphServerProtocol
from metrilyx.dataserver.dataproviders.opentsdb import getPerfDataProvider
from metrilyx.dataserver.spawner import spawnServers


LOG_FORMAT = "%(asctime)s [%(levelname)s %(name)s %(lineno)d] %(message)s"


def getLogger(opts):
	try:
		logging.basicConfig(level=eval("logging.%s" % (opts.logLevel)), format=LOG_FORMAT)
		return logging.getLogger(__name__)
	except Exception,e:
		print "[ERROR] %s" %(str(e))
		sys.exit(2)


def parseCLIOptions():
	parser = OptionParser()
	parser.add_option("-l", "--log-level", dest="logLevel", default="INFO",
		help="Logging level.")
	parser.add_option("-u", "--uri", dest="uri", default="ws://localhost",
		help="ws://<hostname>")
	parser.add_option("-s", "--start-port", dest="startPort", type="int", default=9000,
		help="Starting point of the port range to listen on. This is only applicable when multiple servers are launched.")
	parser.add_option("-c","--server-count", dest="serverCount", type="int", default=0,
		help="Number of servers to spawn. If 0 is specified, the count will be based off of the number cpus/cores")
	parser.add_option("-e", "--external-port", dest="externalPort", type="int", default=None,
		help="External port to use.  This is needed when running the servers behind a reverse proxy (i.e nginx)")

	(opts, args) = parser.parse_args()

	logger = getLogger(opts)

	if not opts.uri:
		print " --uri required!"
		parser.print_help()
		sys.exit(1)

	if opts.serverCount == 0:
		
		opts.serverCount = multiprocessing.cpu_count()-1
		logger.warning("Using auto-spawn count: %d" % (opts.serverCount))
		
		# set to 1 if single cpu/core
		if opts.serverCount == 0:
			opts.serverCount = 1
			logger.warning("Detected single cpu/core!")

	return logger, opts, args


if __name__ == '__main__':

	(logger, opts, args) = parseCLIOptions()

	try:
		class GraphProtocol(GraphServerProtocol):
			dataprovider = getPerfDataProvider()

		proto = GraphProtocol
	
	except Exception,e:
		logger.error("Could not set dataprovider and/or protocol: %s" %(str(e)))
		sys.exit(2)

	logger.warning("Protocol: %s" %(str(proto)))
	logger.warning("Spawning %d server/s..." %(opts.serverCount))
	
	server_procs = spawnServers(proto, logger, opts)
	# wait for servers to stop
	try:
		for p in server_procs:
			p.join()
	except KeyboardInterrupt:
		logger.warning("Stopping...")


