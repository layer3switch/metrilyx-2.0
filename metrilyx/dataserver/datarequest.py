
REQUIRED_REQUEST_KEYS = ('_id', 'start', 'graphType', 'series',)

class PanelRequest(object):
    
    def __init__(self, **kwargs):
        self.__cleanRequest(kwargs)
        
        for k, v in kwargs.items():
            setattr(self, k, v)
        
        self.__checkRequest()
        self.__applyGlobalTagsToSeries()

    def split(self):
        """
            Return: Broken up graph request: 1 per metric with graph metadata
        """
        for serie in self.series:
            obj = dict([ (k,v) for k,v in self.__dict__.items() if k != "series" ])
            obj['series'] = [serie]
            yield obj

    def request(self):
        return self.__dict__

    def __cleanRequest(self, request):
        if request.has_key('series'):
            for s in request['series']:
                if s.has_key('$$hashKey'):
                    del s['$$hashKey']

        if request.has_key('secondaries'):
            for s in request['secondaries']:
                if s.has_key('$$hashKey'):
                    del s['$$hashKey']

    def __checkRequest(self):
        for k in REQUIRED_REQUEST_KEYS:
            if not getattr(self, k):
                raise NameError('Missing key: %s' %(k))

    def __applyGlobalTagsToSeries(self):
        for serie in self.series:
            for k,v in self.tags.items():
                serie['query']['tags'][k] = v

"""
class GraphRequest(object):

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
        for k in REQUIRED_REQUEST_KEYS:
            if not request.has_key(k):
                raise NameError('Missing key: %s' %(k))

    def __applyGlobalTagsToSeries(self):
        for serie in self.request['series']:
            for k,v in self.request['tags'].items():
                serie['query']['tags'][k] = v
"""
