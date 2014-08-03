#!/usr/bin/env python
description = """
	Sends an event to the event server.  The following parameters are required:
	event type, message, and any number of tags with at least 1 tags
"""

import os
import sys
import time
import socket
import requests
import json
from optparse import OptionParser

from pprint import pprint

EVENT_HTTP_ENDPOINT = "/api/annotations"
EVENT_SERVER = "localhost"
EVENT_SRV_PORT = 80
EVENT_TIME = time.time()*1000000

class MetrilyxEvent(object):
	def __init__(self, *args, **kwargs):
		if kwargs.has_key('protocol'):
			if kwargs['protocol'] in ('tcp','http'):
				self.protocol = kwargs['protocol']
			else:
				raise RuntimeError("Invalid protocol. Must be tcp or http")
		else:
			self.protocol = 'tcp'
		self.serverAddress = args[0]
		self.serverPort = args[1]
		self._data = kwargs

	@property
	def data(self):
		return self._data

	def __str__(self):
		return "%d %s %s:%s '%s'" %(
				self._data['timestamp'], 
				" ".join(["%s=%s" %(k,v) for k,v in self._data['tags'].items()]), 
				self._data['eventType'], 
				self._data['message'], 
				json.dumps(self._data['data']))

	def fire(self):
		if self.protocol == 'tcp':
			sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
			try:
				sock.connect((self.serverAddress, self.serverPort))
				bytesSent = sock.send(str(self)+"\n")
				sock.close()
			except Exception,e:
				print "ERROR:", e
				return 0
			return bytesSent
		else:
			url = "http://%s:%d%s" %(self.serverAddress, self.serverPort, EVENT_HTTP_ENDPOINT)
			req = requests.post(url,data=json.dumps(self._data))
			return (req.status_code, req.json())

parser = OptionParser(description)
parser.add_option('-m', dest="message")
parser.add_option('-e', dest="event_type")
parser.add_option('-t', dest="tags", help="t1=v1,t2=v2")
parser.add_option('-d', dest="data", help="JSON data")
parser.add_option('-s', dest="server", default=EVENT_SERVER, 
	help="Server to send event to (default: %s)" %(EVENT_SERVER))
parser.add_option('-p', dest="port", default=EVENT_SRV_PORT, type="int", 
	help="Server port (default: %d)" %(EVENT_SRV_PORT))
parser.add_option('--proto',dest="protocol", default="http", help="tcp or http (default: http)")

(opts,args) = parser.parse_args()

if not opts.message or not opts.event_type or not opts.tags:
	parser.print_help()
	sys.exit(1)
try:
	opts.tags = dict([tkv.strip().split("=") for tkv in opts.tags.split(",")])
	if len(opts.tags.keys()) < 1:
		parser.print_help()
		sys.exit(1)
except Exception,e:
	parser.print_help()
	sys.exit(1)

if opts.data:
	try:
		if opts.data.startswith("@"):
			opts.data = json.load(open(opts.data[1:], "rb"))
		else:
			opts.data = json.loads(opts.data)
	except Exception,e:
		print str(e)
		parser.print_help()
		sys.exit(1)

mEvent = MetrilyxEvent(opts.server, opts.port,
					message=opts.message,
					tags=opts.tags,
					data=opts.data,
					timestamp=EVENT_TIME,
					eventType=opts.event_type,
					protocol=opts.protocol)


bytesSent = mEvent.fire()

if opts.protocol == 'tcp':
	if bytesSent == 0:
		print "Failed to send: %s" %(mEvent)
		sys.exit(2)
	else:	
		print "[Sent %d bytes] %s" %(bytesSent, mEvent)
else:
	if bytesSent[0] >= 200 and bytesSent[0] <= 304:
		print "[HTTP Response code %d]" %(bytesSent[0])
		pprint(bytesSent[1])
	else:
		print "[HTTP Response code %d] %s %s" %(bytesSent[0], str(bytesSent[1]), mEvent)

sys.exit(0)