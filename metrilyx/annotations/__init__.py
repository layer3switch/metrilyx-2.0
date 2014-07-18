
import json
import re
import hashlib
import time
	
VALID_KEYS = ('_id', 'timestamp', 'eventType', 'message', 'tags', 'data')

class Annotator(object):

	def __init__(self, annotation):
		self.annotation = annotation
		self.__checkAnnotation()

	def __checkAnnotation(self):
		if not self.annotation.has_key('timestamp'):
			self.annotation['timestamp'] = time.time()*1000000
		if not self.annotation.has_key('_id'):
			self.annotation['_id'] = hashlib.sha1(json.dumps(self.annotation)).hexdigest()
		if not self.annotationo.has_key('data'):
			self.annotation['data'] = {}
		if not self.annotation.has_key('eventType'):
			raise RuntimeError("eventType required")
