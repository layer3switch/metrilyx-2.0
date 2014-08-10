
from ..perf import BasePerfDataProvider

class OpenTSDBDataProvider(BasePerfDataProvider):
	def getQuery(self, request):
		'''
			Returns: A tuple with (url, method, request_body).  Body can be None 
			if method is 'GET' and the query is url encoded.
		'''
		try:
			baseUrl = "%s:%d%s?start=%s" %(self.uri, self.port,
							self.query_endpoint, request['start'])
		except Exception,e:
			print e, request
			raise RuntimeError(e)

		if request.has_key('end'):
			baseUrl += "&end=%d" %(request['end'])
		for s in request['series']:
			if s['query'].get('rate'):
				query = "&m=%(aggregator)s:rate:%(metric)s" %(s['query'])
			else:
				query = "&m=%(aggregator)s:%(metric)s" %(s['query'])
			tagstr = ",".join([ "%s=%s"%(k,v) for k,v in s['query']['tags'].items() ])
			if tagstr != "":
				baseUrl += query + "{" + tagstr + "}"
			else:
				baseUrl += query
		# uri, method, body
		return (str(baseUrl), 'GET', None)




