
import time
import itertools

from pprint import pprint

class GraphRequest(object):
    REQUIRED_REQUEST_KEYS = ('_id', 'start', 'graphType', 'series',)

    def __init__(self, request):
        self.__checkRequest(request)
        self.__cleanRequest(request)
        self.request = request
        self.__applyGlobalTagsToSeries()

    def split(self):
        '''
            Return: Broken up graph request: 1 per metric with graph metadata
        '''
        for serie in self.request['series']:
            obj = dict([ (k,v) for k,v in self.request.items() if k != "series" ])
            obj['series'] = [serie]
            yield obj

    def __cleanRequest(self, request):
        if request.has_key('series'):
            for s in request['series']:
                if s.has_key('$$hashKey'):
                    del s['$$hashKey']

        if request.has_key('secondaries'):
            for s in request['secondaries']:
                if s.has_key('$$hashKey'):
                    del s['$$hashKey']

        
    def __checkRequest(self, request):
        for k in self.REQUIRED_REQUEST_KEYS:
            if not request.has_key(k):
                raise NameError('Missing key: %s' %(k))

    def __applyGlobalTagsToSeries(self):
        for serie in self.request['series']:
            for k,v in self.request['tags'].items():
                serie['query']['tags'][k] = v


