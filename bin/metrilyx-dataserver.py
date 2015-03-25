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
from metrilyx.dataserver.protocols import getConfiguredProtocol

from metrilyx.dataserver.spawner import MemoryMonitoredProcessPool, WebSocketServer

from metrilyx.dataserver.wsfactory import MetrilyxWebSocketServerFactory

from pprint import pprint

LOG_FORMAT = "%(asctime)s [%(levelname)s %(name)s %(lineno)d] %(message)s"

'''
def getProtocol():
	try:
		class GraphProtocol(GraphServerProtocol):
			dataprovider = getPerfDataProvider()

		return GraphProtocol
		#logger.warning("Protocol: %s" %(str(proto)))
	except Exception,e:
		logger.error("Could not set dataprovider and/or protocol: %s" %(str(e)))
		sys.exit(2)
'''

class DataserverOptionParser(OptionParser):

	def __init__(self, *args, **kwargs):
		OptionParser.__init__(self, *args, **kwargs)

	def __getLogger(self, opts):
		try:
			logging.basicConfig(level=eval("logging.%s" % (opts.logLevel)), format=LOG_FORMAT)
			return logging.getLogger(__name__)
		except Exception,e:
			print "[ERROR] %s" %(str(e))
			sys.exit(2)

	def __checkServerCount(self, logger, count):
		# Set to N-1 procs
	    if count == 0:
	    	count = multiprocessing.cpu_count()-1
	    	logger.warning("Using auto-spawn count: %d" % (count))
	    # Final check
	    if count < 1:
	    	count = 1
	    	logger.warning("Detected single cpu/core!")
	    return count


	def parse_args(self):
		opts, args = OptionParser.parse_args(self)
		logger = self.__getLogger(opts)

		if not opts.uri:
			print " --uri required!"
			parser.print_help()
			sys.exit(1)

		opts.serverCount = self.__checkServerCount(logger, opts.serverCount)

		return (logger, opts, args)


def parseCLIOptions():
	#parser = OptionParser()
	parser = DataserverOptionParser()
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

	#(logger, opts, args) = parser.parse_args()
	return parser.parse_args()


if __name__ == '__main__':

	(logger, opts, args) = parseCLIOptions()

	mmProcPool = MemoryMonitoredProcessPool(logger, maxMemPerProc=1024)
	# Added server processes
	for i in range(opts.serverCount):
		uri = "%s:%d" % (opts.uri, opts.startPort + i)
		logger.warning("Starting server on: %s" %(uri))
		
		mmProcPool.addProcess(WebSocketServer, {
			"factory": MetrilyxWebSocketServerFactory, 
			"protocol": getConfiguredProtocol(), 
			"uri": uri,
			"extPort": opts.externalPort,
			"checkInterval": 15
			})

	try:
		mmProcPool.start()
	except KeyboardInterrupt:
		logger.warning("Stopping...")


