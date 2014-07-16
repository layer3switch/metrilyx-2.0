import json
import logging

from metrilyx import BaseClassWithConfig
from ...dataproviders import re_504

logger = logging.getLogger(__name__)

class BasePerfDataProvider(BaseClassWithConfig):

	def responseErrback(self, error, graphMeta):
		logger.error("%s %s" %(str(graphMeta['series']), str(error)))
		try:
			err_obj = json.loads(error.value.response)['error']
		except Exception,e:
			err_obj = {'message': str(error)}

		m = re_504.search(err_obj['message'])
		if m != None:
			graphMeta['series'][0]['data'] = {"error": m.group(1)}
		else:
			graphMeta['series'][0]['data'] = {"error": err_obj['message'][:100]}

		logger.error("BasePerfDataProvider.responseErrback: %s %s" %(
			str(graphMeta['series'][0]['query']), err_obj['message']))
		
		return graphMeta

	def responseCallback(self, response, url, graphMeta):
		'''
			This should be subclassed if response needs to be formatted 
			before calling MetrilyxSerie
		'''
		return response