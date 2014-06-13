#!/usr/bin/env python

import re
import sys
import time
import logging

from optparse import OptionParser
from multiprocessing import Process, Queue

from twisted.python import log
from twisted.internet import reactor
from twisted.internet.protocol import ServerFactory
from twisted.protocols.basic import LineReceiver

from pprint import pprint

from metrilyx.metrilyxconfig import config

from metrilyx.annotations import Annotator
from metrilyx.annotations.messagebus import KafkaProducer, KafkaConsumer
from metrilyx.datastores import ElasticsearchDataStore


Q = Queue()
LOG_FORMAT = "%(asctime)s [%(levelname)s %(name)s]: %(message)s"

class AnnotationReceiver(LineReceiver):
	delimiter = "\n"
	annotator = Annotator()
	
	def connectionMade(self):
		pass

	def connectionLost(self, reason):
		pass

	def lineReceived(self, line):
		line = line.strip()
		if line == "": return
		result = self.annotator.annotation(line)
		if result.get('error'):
			logger.error(result)
			return
		else:
			Q.put(line)

class AnnotationProcesser(Process):

	bus = KafkaProducer(config['annotations']['messagebus'])
	annotator = Annotator()

	def run(self):
		global logger

		while True:
			if not Q.empty():
				line = Q.get()
				d = self.annotator.annotation(line)
				logger.debug(str(d))
				# publish message
				self.bus.send(line)
			else:
				time.sleep(1)

class AnnoventStorageProcess(Process):
	esds = ElasticsearchDataStore(config['dataproviders'][1])
	kcon = KafkaConsumer(config['annotations']['messagebus'])
	annotator = Annotator()

	def run(self):
		for kMsg in self.kcon.consumer:
			logger.info("offset=%d message=%s" %(kMsg.offset, kMsg.message.value))
			annoObj = self.annotator.annotation(kMsg.message.value)
			#print annoObj
			self.esds.add(annoObj)

		self.kcon.close()

class AnnotationFactory(ServerFactory):
	protocol = AnnotationReceiver

if __name__ == "__main__":
	parser = OptionParser()
	parser.add_option("-l", "--log-level", dest="logLevel", default="INFO", 
		help="Logging level.")
	(opts,args) = parser.parse_args()

	try:
		logging.basicConfig(level=eval("logging.%s" %(opts.logLevel)),
			format=LOG_FORMAT)
		logger = logging.getLogger(__name__)
	except Exception,e:
		print "[ERROR] %s" %(str(e))
		parser.print_help()
		sys.exit(2)


	annoProc = AnnotationProcesser(name='mainAnno')
	annoProc.start()

	annoStorProc = AnnoventStorageProcess(name='storageAnno')
	annoStorProc.start()

	log.startLogging(sys.stdout)
	reactor.listenTCP(4545, AnnotationFactory())
	reactor.run()

	annoStorProc.join()
	annoProc.join()

