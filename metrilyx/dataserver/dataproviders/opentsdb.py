
import ujson as json
import logging

import re

import metrilyx
from metrilyx.metrilyxconfig import config
from metrilyx import BaseClassWithConfig

re_504 = re.compile("(504 gateway time.+out)", re.IGNORECASE)

logger = logging.getLogger(__name__)

class BasePerfDataProvider(BaseClassWithConfig):

	def responseErrback(self, error, graphMeta):
		logger.error("%s - %s" %(str(error),str(graphMeta['series'])))
		try:
			err_obj = json.loads(error.value.response)['error']
		except Exception,e:
			err_obj = {'message': str(error)}

		m = re_504.search(err_obj['message'])
		if m != None:
			graphMeta['series'][0]['data'] = {"error": m.group(1)}
		else:
			graphMeta['series'][0]['data'] = {"error": err_obj['message'][:100]}

		#logger.error("%s %s" %(str(graphMeta['series']), err_obj['message']))

		return graphMeta

	def responseCallback(self, response, url, graphMeta):
		'''
			This should be subclassed if response needs to be formatted
			before calling MetrilyxSerie
		'''
		return response


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


def getPerfDataProvider():
	mc = config['dataprovider']['loader_class'].split(".")
	mod = __import__("metrilyx.dataserver.dataproviders.%s" % 
							(".".join(mc[:-1])), fromlist=['*']) 
	return eval("mod.%s(config['dataprovider'])" %(mc[-1]))


