
import logging

import numpy
from pandas import Series, DataFrame
from pandas.tseries.tools import to_datetime

from metrilyx.dataserver.uuids import QueryUUID, SerieUUID, TagsUUID

logger = logging.getLogger(__name__)

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
	def __init__(self, serie, eventType, originalRequest):
		self._serie = serie
		self.eventType = eventType
		self.__microToMilli()
		self.__request = originalRequest
		self.__data = self.__assembleEventSerie()

	@property
	def data(self):
		return self.__data

	def __assembleEventSerie(self):
		'''
		Returns:
			series data in highcharts format
		'''
		out = {'query': self.__request,'annoEvents': {}}
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


class BasicSerie(object):

	def _flatten_dict(self, d):
		def flatten_dict_gen(d):
			for k, v in d.items():
				if isinstance(v, dict):
					for item in flatten_dict_gen(v):
						value = item[1]
						yield (k + "." + item[0], value)
				else:
					yield (k, v)

		return dict((key, value) for (key, value) in list(flatten_dict_gen(d)))

		
	def _normalizeAlias(self, alias_str, obj, unique_tags_str):
		"""
		@args:
			alias_str 	string to format
			obj 		dict containing atleast 'tags' and 'metric' keys
		"""
		flat_obj = self._flatten_dict(obj)
		if unique_tags_str:
			uniqueTagsString = unique_tags_str %(flat_obj)

		normalizedAlias = alias_str
		# When alias_str starts with ! we will do an eval for lambda processing
		if alias_str.startswith("!"):
			try:
				return eval(alias_str[1:])(flat_obj)
			except Exception,e:
				#TODO: assign calculated default
				logger.warn("could not transform alias: %s %s" %(obj['metric'], str(e)))
				#normalizedAlias = obj['metric']+ " " + uniqueTagsString
				normalizedAlias = obj['metric']
		else:
			try:
				normalizedAlias = alias_str %(flat_obj)
			except Exception, e:
				logger.error("could not normalize alias: %s %s" %(obj['metric'], str(e)))
				normalizedAlias =  obj['metric']

		if unique_tags_str and normalizedAlias == obj['metric']:
			normalizedAlias += " " + uniqueTagsString

		return normalizedAlias.strip()

	def _getConvertedTimestamps(self, pSerie, unit='s'):
		'''
			pSerie: pandas Series object
			unit: s, ms, us
		'''
		if unit == 's':
			# seconds
			return pSerie.index.astype(numpy.int64)/1000000000
		elif unit == 'ms':
			# milliseconds
			return pSerie.index.astype(numpy.int64)/1000000
		elif unit == 'us':
			# microseconds
			return pSerie.index.astype(numpy.int64)/1000
		else:
			# nanoseconds
			return pSerie.index.astype(numpy.int64)

	def _dataHasErrors(self, data):
		if isinstance(data, dict) and data.has_key('error'):
			return data['error']
		return False


class MetrilyxSerie(BasicSerie):
	"""
	This makes an object containing the original series data (request) with the tsdb
	data appropriately added in.

	Args:
		serie 			: single serie component of a graph (i.e. the metric query to tsdb)
		data_callback	: callback for each unique series
	"""
	def __init__(self, serie, dataCallback=None):
		super(MetrilyxSerie, self).__init__()
		self._serie = serie
		self._dataCallback = dataCallback
		self.uuid = QueryUUID(self._serie['query'])

		self.error = self._dataHasErrors(self._serie['data'])
		if not self.error:
			self.uniqueTagsString = self.__uniqueTagsStr()
			## assign uuid id's to result dataset
			for d in self._serie['data']:
				d['uuid'] = TagsUUID(d['tags']).uuid

			self.__normalizeAliases()

	def __normalizeAliases(self):
		for s in self._serie['data']:
			if isinstance(s, dict) and s.get('error'):
				continue
			s['alias'] = self._normalizeAlias(self._serie['alias'],
								{'tags': s['tags'],'metric': s['metric']},
								self.uniqueTagsString)

	def data(self):
		if self.error: return { "error": self.error }
		return [ self.__processSerieData(r) for r in self._serie['data'] ]

	def __processSerieData(self, dataset):
		if isinstance(dataset, dict) and dataset.get('error'):
			return {"alias": self._serie['alias'],"error": dataset.get('error')}

		try:
			dataset['dps'] = self.__normalizeTimestamp(dataset['dps'])
		except Exception,e:
			logger.error("Coudn't normalize timestamp: %s %s" %(dataset['metric'], str(e)))

		### todo: add tsdb performance header
		#dataset['perf'] = self._serie['perf']
		dataset['dps'] = self.__apply_ytransform(dataset['dps'], self._serie['yTransform'])
		## May remove this as it can be achieved using a yTransform which would be controlled by the user.
		if self._serie['query']['rate']:
			dataset['dps'] = self.__rmNegativeRates(dataset['dps'])

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
			logger.warn("could not apply yTransform: %s", str(e))
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
	'''
	def _normalizeAlias(self, alias_str, obj):
		"""
		@args:
			alias_str 	string to format
			obj 		dict containing atleast 'tags' and 'metric' keys
		"""
		flat_obj = self._flatten_dict(obj)
		normalizedAlias = super(MetrilyxSerie, self)._normalizeAlias(alias_str, flat_obj)
		## only add unique tags if using string formating.
		if self.uniqueTagsString:
			normalizedAlias = normalizedAlias + self.uniqueTagsString %(flat_obj)
		
		return normalizedAlias
	'''
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
			logger.warn("Data not a dict. Processing as list: %s" %(str(type(data))))
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


### TODO: add error handling on per serie basis
class MetrilyxAnalyticsSerie(MetrilyxSerie):
	
	def __init__(self, serie, graphType="line", dataCallback=None):
		super(MetrilyxAnalyticsSerie, self).__init__(serie, dataCallback)
		
		self.graphType = graphType

		if not self.error:
			self._istruct = self.__getInternalStruct()
			self.__applyTransform()
		else:
			self._istruct = None

	def __getInternalStruct(self):
		out = []
		for d in self._serie['data']:
			## TODO: change to use d['uuid']
			out.append((d['uuid'], Series([d['dps'][k] for k in sorted(d['dps'].keys())], 
				index=to_datetime([int(ts) for ts in sorted(d['dps'].keys())], unit='s'))))
		return DataFrame(dict(out))
	
	def __getSerieMetadata(self, serie):
		return dict([(k,v) for k,v in serie.items() if k != 'dps'])

	def _convertPandasTimestamp(self, timestampObj, unit="ms"):
		
		timestamp = timestampObj.value
		if unit == 's':
			# seconds
			return timestamp/1000000000
		elif unit == 'ms':
			# milliseconds
			return timestamp/1000000
		elif unit == 'us':
			# microseconds
			return timestamp/1000
		else:
			# nanoseconds
			return timestamp


	def __getDataSerieDps(self, column, ts_unit='ms'):
		try:
			if self.graphType == "pie":
				
				aggr = self._serie['query']['aggregator']
				if aggr == "avg":
					return [[eval("self._convertPandasTimestamp(column.idxmean(), ts_unit)"), eval("column.mean()")]]
				elif aggr == "sum":
					return [[ eval("self._convertPandasTimestamp(column.index[-1])"), eval("column.%s()" %(aggr))]]
				else:
					return [[eval("self._convertPandasTimestamp(column.idx%s(), ts_unit)" %(aggr)), 
																	eval("column.%s()" %(aggr))]]

			else:
				nonNaSerie = column.replace([numpy.inf, -numpy.inf], numpy.nan).dropna()
				return zip(self._getConvertedTimestamps(nonNaSerie, ts_unit), nonNaSerie.values)

		except Exception,e:
			logger.warning(str(e))
			return {"error": str(e)}

	def data(self, ts_unit='ms'):
		if self.error: return { 'error': self.error }
		
		out = []
		for s in self._serie['data']:
			md = self.__getSerieMetadata(s)

			datapoints = self.__getDataSerieDps(self._istruct[s['uuid']], ts_unit) 
			error = self._dataHasErrors(datapoints)
			if not error:
				md['dps'] = datapoints
				md['uuid'] = SerieUUID(s).uuid
			else:
				#s = {'error': error}
				logger.warning("Error assembling data: %s" %(str(e)))
			out.append(md)

		return out

	def __applyTransform(self):
		if self._serie['yTransform'] != "":
			try:
				self._istruct = eval("%s" %(self._serie['yTransform']))(self._istruct)
			except Exception,e:
				logger.warn("Could not apply yTransform: %s" %(str(e)))


class SecondariesGraph(BasicSerie):

	def __init__(self, metrilyxGraphRequest):
		super(SecondariesGraph, self).__init__()
		self.__request = metrilyxGraphRequest
		self.__analyticsSeriess = [ None for i in self.__request['series'] ]

	def add(self, metrilyxAnalyticsSerie):
		idx = self.__findSerieIdxInRequest(metrilyxAnalyticsSerie)
		if idx < 0:
			raise NameError("Serie not found in request: %s" %(str(metrilyxAnalyticsSerie._serie['query'])))
		
		self.__analyticsSeriess[idx] = metrilyxAnalyticsSerie

	def __findSerieIdxInRequest(self, metrilyxAnalyticsSerie):
		if not isinstance(metrilyxAnalyticsSerie, MetrilyxAnalyticsSerie):
			raise NameError("Added type must be 'MetrilyxAnalyticsSerie'")

		for i in range(len(self.__request['series'])):
			if self.__request['series'][i]['query'] == metrilyxAnalyticsSerie._serie['query']:
				return i
		return -1

	def __serieIdTags(self, val):
		return dict([tkv.split('=') for tkv in val[1:-1].split(',')])

	def __secondaryMetricName(self, metricSource, uuid):
		return '(' + ':'.join(metricSource.split(':')[1:]).strip() + ')' + uuid


	def __normalizeSeriesData(self):
		for i in range(len(self.__request['series'])):
			self.__request['series'][i]['data'] = self.__analyticsSeriess[i].data()


	def data(self, ts_unit='ms'):
		self.__makeSecondaryGraphs(ts_unit)
		self.__normalizeSeriesData()
		return self.__request

	def __makeSecondaryGraphs(self, ts_unit):
		istructs = [s._istruct for s in self.__analyticsSeriess]

		for sec in self.__request['secondaries']:
			try:
				istruct = eval("%s" %(sec['query']))(*istructs)
				dArr = []
				for colname in istruct.columns.values:
					tags = self.__serieIdTags(colname)
					md = {
						'tags': tags,
						'alias': self._normalizeAlias(sec['alias'], self._flatten_dict({'tags': tags}), False),
						'uuid': colname,
						'metric': self.__secondaryMetricName(sec['query'], colname)
						}
					## clean out infinity and nan
					nonNaSerie = istruct[colname].replace([numpy.inf, -numpy.inf], numpy.nan).dropna()
					md['dps'] = zip(self._getConvertedTimestamps(nonNaSerie, ts_unit), nonNaSerie.values)
					dArr.append(md)
				sec['data'] = dArr
			except Exception,e:
				logger.error(str(e))
				sec['data'] = {"error": str(e)}
