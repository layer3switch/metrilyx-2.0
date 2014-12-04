
import ujson as json
import logging

from metrilyx import BaseClassWithConfig
from ...dataproviders import re_504
from pprint import pprint

logger = logging.getLogger(__name__)

class BaseEventDataProvider(BaseClassWithConfig):

	def responseErrback(self, error, graphMeta):
		logger.error(str(error))
		try:
			err_obj = json.loads(error.value.response)['error']
		except Exception,e:
			err_obj = {'message': str(error.value.response)}

		m = re_504.search(err_obj['message'])
		if m != None:
			graphMeta['annoEvents']['data'] = {"error": m.group(1)}
		else:
			graphMeta['annoEvents']['data'] = {"error": err_obj['message'][:100]}

		logger.error("BaseEventDataProvider.responseErrback: %s" %(
										str(graphMeta['annoEvents'])))

		return graphMeta

	def responseCallback(self, response, url, graphMeta):
		'''
			This should be subclassed if response needs to be formatted
			before calling MetrilyxSerie
		'''
		return response