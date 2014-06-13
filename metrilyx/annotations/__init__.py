
import re
import hashlib
import time

from metrilyx.metrilyxconfig import config

DEFAULT_PARSE_PATTERN = re.compile(config['annotations']['line_re'])	
VALID_KEYS = ('_id', 'timestamp', 'type', 'message')

class Annotator(object):
	'''
		Args:
			parse_pattern: re compiled object to parse line
	'''
	def __init__(self, parse_pattern=DEFAULT_PARSE_PATTERN):
		self.pattern = parse_pattern

	def checkAnnotation(self, anno):
		if not anno.has_key('timestamp'):
			anno['timestamp'] = time.time()*1000000
		if not anno.has_key('_id'):
			anno['_id'] = hashlib.sha1(anno).hexdigest()

	def annotation(self, anno):
		'''
			Args:
				anno: string or dict
			Return:
				if string is provided a dict is returned or vica-versa
		'''
		if type(anno) == str:
			m = self.pattern.match(anno)
			if m != None:
				try:
					d = dict([ kv.split("=") for kv in m.group(2).split() ])
					d.update({
						'timestamp': int(m.group(1)),
						'eventType': m.group(3),
						'message': m.group(4)
						})
					if (len(d.keys()) < 4) or (len(d['message']) <= 0): 
						return {"error": "Tags not provided or message is empty: %s" %(line)}
					else:
						d['_id'] = hashlib.sha1(anno).hexdigest()
						return d
				except Exception,e:
					return {"error": str(e)}
			else:
				return {"error": "Invalid annotation: %s" %(line)}
		elif type(anno) == dict:
			if not anno.has_key('timestamp'):
				anno['timestamp'] = time.time()*1000000
			tagsStr = " ".join([ "%s=%s" %(k, anno[k]) for k in sorted(anno.keys()) if k not in VALID_KEYS])
			return "%d %s %s:%s" %(anno['timestamp'], tagsStr, anno['eventType'], anno['message'])
		else:
			return {"error": "Invalid argument"}
