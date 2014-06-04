
import logging

log = logging.getLogger(__name__)

def absoluteTime(relTime):
	'''
		Args:
			relTime: relative time or absolute time in seconds
		Returns relative/absoluteTime time in microseconds
	'''
	if type(relTime) != str or "-ago" not in relTime:
		return relTime*1000000

	val = int(relTime.split("-")[0][:-1])
	unit = relTime.split("-")[0][-1]
	
	if unit == 's':
		retVal = time.time() - val
	elif unit == 'm':
		retVal = time.time() - (val*60000000)
	elif unit == 'h':
		retVal = time.time() - (val*3600000000)
	elif unit == 'd':
		retVal = time.time() - (val*86400000000)
	elif unit == 'w':
		retVal = time.time() - (val*604800000000)
	return retVal


class MetrilyxSerie(object):
	"""
	This makes an object containing the original series data (request) with the tsdb
	data appropriately added in.

	Args:
		serie 			: single serie component of a graph (i.e. the metric query to tsdb)
		data_callback	: callback for each unique series
	"""
	def __init__(self, serie, data_callback=None):
		self._serie = serie
		self._data = serie['data']
		self._data_callback = data_callback

		if type(self._data) == dict and self._data.get('error'):
				self.error = self._data.get('error')
		else:
			self.error = False

	@property
	def data(self):
		if self.error: return { "error": self.error }
		data = []
		for r in self._data:
			data.append(self.__process_serie(r))
		return data

	def __apply_ytransform(self, dataset, yTransform):
		if yTransform == "":
			return dataset
		## eval causes a hang.
		try:
			dps = []
			for ts, val in dataset:
				dps.append(( ts, eval(yTransform)(val) ))
			return dps
		except Exception,e:
			log.warn("could not apply yTransform: %s", str(e))
			return dataset

	def __process_serie(self, dataset):
		#data = response
		if type(dataset) == dict and dataset.get('error'):
			return {
				"alias": self._serie['alias'],
				"error": dataset.get('error'),
				}
		try:
			dataset['dps'] = self.__convert_timestamp(dataset['dps'])
		except Exception,e:
			log.error("could not normalize datapoints: %s %s" %(dataset['metric'], str(e)))

		### todo: add tsdb performance header
		#dataset['perf'] = self._serie['perf']
		dataset['dps'] = self.__apply_ytransform(dataset['dps'], self._serie['yTransform'])
		### normalize alias (i.e. either lambda function or string formatting)
		dataset['alias'] = self.__normalize_alias(self._serie['alias'], {
			'tags': dataset['tags'],
			'metric': dataset['metric']
			})
		### scan tags to make unique series alias (looks for * and | operators)
		uq = self.__determine_uniqueness(self._serie['query'])
		nstr = ""
		for u in uq:
			talias = "%(" + u + ")s"
			if talias not in self._serie['alias']:
				nstr += " " + talias
		### apply the unique tag and normalize
		if nstr and not self._serie['alias'].startswith("!"):
			dataset['alias'] = self.__normalize_alias(self._serie['alias']+nstr, {
				'tags': dataset['tags'],
				'metric': dataset['metric']
				})

		## any custom callback for resulting data set 
		## e.g. scrape metadata
		if self._data_callback != None:
			self._data_callback(dataset)

		## clean rate
		if self._serie['query']['rate']:
			#print "removing negative rates"
			dataset['dps'] = self.__remove_negative_rates(dataset['dps'])

		return dataset

	def __determine_uniqueness(self, query):
		"""
			Finds all tags in query with a '*' or '|' or multiple values
		"""
		uniques = []
		for k,v in query['tags'].items():
			if v == "*" or "|" in v:
				uniques.append("tags."+k)
		return uniques


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

	def __normalize_alias(self, alias_str, obj):
		"""
		@args:
			alias_str 	string to format
			obj 		dict containing atleast 'tags' and 'metric' keys
		"""
		flat_obj = self.__flatten_dict(obj)

		# When alias_str starts with ! we will do an eval for lambda processing
		if alias_str.startswith("!"):
			try:
				return eval(alias_str[1:])(flat_obj)
			except Exception,e:
				log.warn("could not transform alias: %s %s" %(obj['metric'], str(e)))

		try:
			return alias_str %(flat_obj)
		except KeyError:
			return obj['metric']
		except Exception, e:
			log.error("could not normalize alias: %s %s" %(obj['metric'], str(e)))
			return alias_str

	def __sig_figs(self, num):
		"""
			for server side precision calculation
		"""
		if num != 0:
			return round(num, config['sig_figs'])
		else:
			return 0

	def __convert_timestamp(self, data):
		"""
		Convert to milliseconds
		Convert dict to tuple
		Sort by timestamp
		@params
				tsdb dps structure
		"""
		return [ (int(ts)*1000, data[ts]) for ts in sorted(data) ]

	def __remove_negative_rates(self, data):
		"""
		Remove negative rates as current version of TSDB can't handle it 
		@params
			data 	tsdb dps structure
		"""
		return [ (ts,val) for ts,val in data if val >= 0 ]
