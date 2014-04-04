
from multiprocessing import Pool
import math

from ..httpclients import HttpJsonClient
from ..datastreams import GraphRequest
from ..metrilyxconfig import config

from pprint import pprint



class OpenTSDBEndpoints(object):
	"""
	Endpoints for OpenTSDB v2.0
	"""
	s = 			'/s'
	aggregators = 	'/api/aggregators'
	annotation = 	'/api/annotation'
	dropcaches = 	'/api/dropcaches'
	put = 			'/api/put'
	query = 		'/api/query'
	search = 		'/api/search'
	serializers = 	'/api/serializers'
	stats = 		'/api/stats'
	suggest = 		'/api/suggest'
	tree = 			'/api/tree'
	uid = 			'/api/uid'
	version = 		'/api/version'


"""
Sample request:

{u'_id': u'5a55b84b86124b9fae664464e93244a6',
 u'graphType': u'line',
 u'name': u'',
 u'series': [{u'alias': u'%(tags.class)s',
			  u'query': {u'aggregator': u'sum',
						 u'metric': u'apache.bytes',
						 u'rate': True,
						 u'tags': {u'class': u'*'}},
			  u'yTransform': u''}],
 u'size': u'medium',
 u'start': u'5m-ago'}

"""
class OpenTSDBRequest(GraphRequest):
	"""
		Args:
			metrilyx_request	: request containing graph info and tsdb query info
			data_callback		: callback for each unique series
	"""
	endpoints = OpenTSDBEndpoints()
	tsd_host = config['tsdb']['uri']
	tsd_port = config['tsdb']['port']

	def __init__(self, metrilyx_request, data_callback=None):
		super(OpenTSDBRequest,self).__init__(metrilyx_request)
		self.data_callback = data_callback
		for serie in self.series:
			serie = self.__fetch_serie(serie)

	def __fetch_serie(self, serie):
		hjc = HttpJsonClient(self.tsd_host, self.tsd_port)
		tsd_data = hjc.POST(self.endpoints.query, self.__serieQuery(serie, self.tags))
		if type(tsd_data) == dict and tsd_data.get("error"):
			serie['data'] = tsd_data
		else:
			m_serie = MetrilyxSeries(serie, tsd_data, self.data_callback)
			serie['data'] = m_serie.data
		return serie

	def __extendTags(self, tags1, global_tags):
		"""
			Over write all tags with global_tags if present
		"""
		out = tags1
		for k,v in global_tags.items():
			out[k] = v
		return out

	def __serieQuery(self, one_serie, global_tags=None):
		if global_tags != None:
			one_serie['query']['tags'] = self.__extendTags(one_serie['query']['tags'],global_tags)
		q = {
			"queries": [ one_serie['query'] ],
			"start": self.request['start']
			}
		if self.request.get('end'):
			q['end'] = self.request['end']
		return q

class MetrilyxSeries(object):
	"""
	This makes an object containing the original series data (request) with the tsdb
	data appropriately added in.

	Args:
		serie 			: single serie component of a graph (i.e. the metric query to tsdb)
		data 			: response data from tsdb
		data_callback	: callback for each unique series
	"""
	def __init__(self, serie, tsd_data, data_callback=None):
		self._data = tsd_data
		self._data_callback = data_callback
		#pprint(data)
		self._serie = serie
		if type(self._data) == dict and self._data.get('error'):
			self.error = data.get('error')
		else:
			self.error = False

	@property
	def data(self):
		if self.error: return { "error": self.error }
		#pprint(self._serie)
		data = []
		for r in self._data:
			data.append(self.__process_serie(r))
		return data

	def __apply_ytransform(self, dataset, yTransform):
		if yTransform == "":
			return dataset
		dps = []
		for ts, val in dataset:
			dps.append(( ts, eval(yTransform)(val) ))
		return dps

	def __process_serie(self, dataset):
		#data = response
		if type(dataset) == dict and dataset.get('error'):
			return {
				"alias": self._serie['alias'],
				"error": dataset.get('error'),
				}
		try:
			dataset['dps'] = self.__convert_timestamp(dataset['dps'])
			#pprint(dataset['dps'])
			#print "%s: %d" %(dataset['metric'], len(dataset['dps']))
		except Exception,e:
			print "----- ERROR -----"
			pprint(e)
			pprint(dataset['metric'])
			print "-----------------"

		dataset['dps'] = self.__apply_ytransform(dataset['dps'], self._serie['yTransform'])
		
		### scan tags to make unique series alias (looks for * and | operators)
		uq = self.__determine_uniqueness(self._serie['query'])
		nstr = ""
		for u in uq:
			talias = "%("+u+")s"
			if talias not in self._serie['alias']:
				nstr += " "+talias

		dataset['alias'] = self.__normalize_alias(self._serie['alias']+nstr, {
			'tags': dataset['tags'],
			'metric': dataset['metric']
			})

		## any custom callback for resulting data set 
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
		#pprint(obj['tags'])
		flat_obj = self.__flatten_dict(obj)
		try:
			#print alias_str %(obj)
			return alias_str %(flat_obj)
		except KeyError:
			#print str(e)
			return obj['metric']

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

