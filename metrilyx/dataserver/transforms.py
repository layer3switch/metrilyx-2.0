
import logging

log = logging.getLogger(__name__)

def absoluteTime(relTime, convertTo='micro'):
	'''
		Args:
			relTime: relative time or absolute time in seconds
		Returns:
			Time in nano/micro/milli seconds
	'''
	if type(relTime) != str or "-ago" not in relTime:
		return relTime

	val = int(relTime.split("-")[0][:-1])
	unit = relTime.split("-")[0][-1]
	
	if unit == 's':
		retVal = time.time() - val
	elif unit == 'm':
		retVal = time.time() - (val*60)
	elif unit == 'h':
		retVal = time.time() - (val*3600)
	elif unit == 'd':
		retVal = time.time() - (val*86400)
	elif unit == 'w':
		retVal = time.time() - (val*604800)
	
	if convertTo == 'nano':
		retVal *= 1000000000
	elif convertTo == 'micro':
		retVal *= 1000000
	elif convertTo == 'milli':
		retVal *= 1000

	return retVal

class EventSerie(object):
	'''
	Args:
		serie: event serie 
		graph: graph dictionary
		eventType: event type of serie
	'''
	def __init__(self, serie, graph, eventType):
		self._serie = serie
		self._graph = graph
		self.eventType = eventType
		self.__microToMilli()
		self.__data = self.__assembleEventSerie()

	@property
	def data(self):
		return self.__data

	def __assembleEventSerie(self):
		'''
		Returns:
			series data in highcharts format
		'''
		out = {
			'_id': self._graph['_id'],
			'annoEvents': self._graph['annoEvents'],
			'graphType': self._graph['graphType']
		}
		out['annoEvents']['eventType'] = self.eventType
		out['annoEvents']['data'] = [ {
									'x': s['timestamp'],
									'text': s['message'],
									'title': s['eventType'],
									'data': s['data']
									} for s in self._serie ]
		return out
	
	def __microToMilli(self):
		for s in self._serie:
			s['timestamp'] = s['timestamp']/1000



class MetrilyxSerie(object):
	"""
	This makes an object containing the original series data (request) with the tsdb
	data appropriately added in.

	Args:
		serie 			: single serie component of a graph (i.e. the metric query to tsdb)
		data_callback	: callback for each unique series
	"""
	def __init__(self, serie, dataCallback=None):
		self._serie = serie
		self._dataCallback = dataCallback

		if isinstance(self._serie['data'], dict) and self._serie['data'].get('error'):
				self.error = self._serie['data'].get('error')
		else:
			self.error = False
			self.uniqueTagsString = self.__uniqueTagsStr()

	@property
	def data(self):
		if self.error: return { "error": self.error }
		return [ self.__processSerieData(r) for r in self._serie['data'] ]

	def __processSerieData(self, dataset):
		if isinstance(dataset, dict) and dataset.get('error'):
			return {"alias": self._serie['alias'],"error": dataset.get('error')}
		try:
			dataset['dps'] = self.__normalizeTimestamp(dataset['dps'])
		except Exception,e:
			log.error("Coudn't normalize timestamp: %s %s" %(dataset['metric'], str(e)))

		### todo: add tsdb performance header
		#dataset['perf'] = self._serie['perf']
		dataset['dps'] = self.__apply_ytransform(dataset['dps'], self._serie['yTransform'])
		## May remove this as it can be achieved using a yTransform which would be controlled by the user.
		if self._serie['query']['rate']:
			dataset['dps'] = self.__rmNegativeRates(dataset['dps'])

		### normalize alias (i.e. either lambda function or string formatting and append unique tags string) 
		dataset['alias'] = self.__normalizeAlias(self._serie['alias'], {
											'tags': dataset['tags'],
											'metric': dataset['metric']})
		### scan tags to make unique series alias (looks for * and | operators)
		### apply the unique tag and re-normalize
		#if self.uniqueTagsString and not self._serie['alias'].startswith("!"):
		#	dataset['alias'] = self.__normalizeAlias(self._serie['alias']+self.uniqueTagsString, {
		#		'tags': dataset['tags'],
		#		'metric': dataset['metric']
		#		})

		## any custom callback for resulting data set 
		## e.g. scrape metadata
		if self._dataCallback != None:
			self._dataCallback(dataset)

		return dataset

	def __apply_ytransform(self, dataset, yTransform):
		if yTransform == "":
			return dataset
		try:
			## eval may cause a hang.
			return [ ( ts, eval(yTransform)(val) ) for ts, val in dataset ]
		except Exception,e:
			log.warn("could not apply yTransform: %s", str(e))
			return dataset

	def __uniqueTagsStr(self):
		"""
			Finds all tags in query with a '*' or '|' or multiple values
		"""
		uniques = ["tags."+k for k,v in self._serie['query']['tags'].items() if v == "*" or "|" in v]
		nstr = ""
		for u in uniques:
			talias = "%(" + u + ")s"
			if talias not in self._serie['alias']:
				nstr += " " + talias
		return nstr

	def __flatten_dict(self,d):
		def flatten_dict_gen(d):
			for k, v in d.items():
				if isinstance(v, dict):
					for item in flatten_dict_gen(v):
						value = item[1]
						yield (k + "." + item[0], value)
				else:
					yield (k, v)

		return dict((key, value) for (key, value) in list(flatten_dict_gen(d)))

	def __normalizeAlias(self, alias_str, obj):
		"""
		@args:
			alias_str 	string to format
			obj 		dict containing atleast 'tags' and 'metric' keys
		"""
		flat_obj = self.__flatten_dict(obj)
		normalizedAlias = alias_str
		# When alias_str starts with ! we will do an eval for lambda processing
		if alias_str.startswith("!"):
			try:
				return eval(alias_str[1:])(flat_obj)
			except Exception,e:
				log.warn("could not transform alias: %s %s" %(obj['metric'], str(e)))
				normalizedAlias = obj['metric']
		else:
			try:
				normalizedAlias = alias_str %(flat_obj)
			except KeyError:
				normalizedAlias =  obj['metric']
			except Exception, e:
				log.error("could not normalize alias: %s %s" %(obj['metric'], str(e)))
		## only add unique tags if using string formating.
		if self.uniqueTagsString:
			normalizedAlias = normalizedAlias + self.uniqueTagsString %(flat_obj)
		
		return normalizedAlias

	def __sig_figs(self, num):
		"""
			for server side precision calculation
		"""
		if num != 0:
			return round(num, config['sig_figs'])
		else:
			return 0

	def __normalizeTimestamp(self, data, toMillisecs=True):
		"""
		@params
			data 		: list or dict
			toMillisecs : multiply timestamp by 1000
		"""
		if type(data) is dict:
			if toMillisecs:
				return [ (int(ts)*1000, data[ts]) for ts in sorted(data) ]
			else:
				return [ (int(ts), data[ts]) for ts in sorted(data) ]
		else:
			# assume it's a list
			log.warn("Data not a dict. Processing as list: %s" %(str(type(data))))
			if toMillisecs:
				return [ (int(tsval[0])*1000, tsval[1]) for tsval in sorted(data) ]
			else:
				return [ (int(tsval[0]), tsval[1]) for ts in sorted(data) ]


	def __rmNegativeRates(self, data):
		"""
		Remove negative rates as current version of TSDB can't handle it 
		@params
			data 	tsdb dps structure
		"""
		return [ (ts,val) for ts,val in data if val >= 0 ]
