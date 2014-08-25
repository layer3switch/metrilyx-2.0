

import httplib
import json
import logging

import StringIO
import gzip

from zope.interface import implements

from twisted.internet import reactor
from twisted.web.client import Agent
from twisted.web.http_headers import Headers
from twisted.web.iweb import IBodyProducer
from twisted.internet.defer import Deferred, succeed
from twisted.internet.protocol import Protocol

from metrilyx.metrilyxconfig import config

from pprint import pprint

logger = logging.getLogger(__name__)

class HttpJsonClient(object):

    def __init__(self, host, port, secure=False):
        self.host = host
        self.port = port
        if secure:
            self.datahandle = httplib.HTTPSConnection(self.host, self.port)
        else:
            self.datahandle = httplib.HTTPConnection(self.host, self.port)

    def ungzip_response(self, response):
        raw_data = response.read()
        #pprint(response.getheader('content-encoding'))
        #pprint(raw_data)
        if not response.getheader('content-encoding') or \
			'gzip' not in response.getheader('content-encoding'):
            try:
                return json.loads(raw_data)
            except Exception,e:
                return { 'error': str(e) }
                
        compressedstream = StringIO.StringIO(raw_data)
        gzipper = gzip.GzipFile(fileobj=compressedstream)
        return json.loads(gzipper.read())

    def GET(self, callPath):
        headers = {'Accept-encoding': 'gzip'}
        #try:
        self.datahandle.request('GET', callPath, headers=headers)
        response = self.datahandle.getresponse()
        return self.ungzip_response(response)

    # callpath, dictionary
    def POST(self, callPath, postObj):
        if type(postObj).__name__ == 'str':
            qstr = postObj
        else:
            qstr = json.dumps(postObj)
        headers = {'Content-Type': 'application/json; charset=UTF-8',
                   'Accept-encoding': 'gzip'}
        try:
            #pprint(qstr)
            self.datahandle.request('POST', callPath, qstr, headers)
            response = self.datahandle.getresponse()
            return self.ungzip_response(response)
        except Exception, e:
            return {"error": str(e)}

    def close(self):
        self.datahandle.close()

class OpenTSDBResponse(object):
    def __init__(self, data_arr):
        if type(data_arr) == dict and data_arr.get('error'):
            self.error = data_arr.get('error')['message']
        else:
            self.error = False
            for d in data_arr:
                d['dps'] = self.__sort_dps(d['dps'])
        self._data = data_arr
        

    @property
    def data(self):
        return self._data

    def __sort_dps(self, dps):
        out = []
        for ts in sorted(dps.keys()):
            out.append((ts, dps[ts]))
        return out

    @property
    def metadata(self):
        #pprint(self._data)
        if not self.error:
            out = []
            for d in self._data:
                m = {
                    "metric"        : d["metric"],
                    "tags"          : d["tags"],
                    "aggregateTags" : d["aggregateTags"],
                    }
                if len(d['dps']) > 0:
                    m['dps'] = {
                        "length": len(d['dps']),
                        "start": d['dps'][0][0],
                        "end": d['dps'][-1][0]
                    }
                out.append(m)
            return out
        else:
            return self._data

class OpenTSDBClient(object):
    def __init__(self, **kwargs):
        for k,v in kwargs.items():
            if k == 'uri':
                setattr(self, 'host', v.split("/")[-1])
            else:
                setattr(self, k,v)
        if not kwargs.has_key('port'):
            self.port = 80

    def __get_tags_string(self, tags):
        tagstr = "{"
        for k,v in tags.items():
            tagstr += "%s=%s," %(k,v)
        tagstr = tagstr.rstrip(",")+"}"
        return tagstr

    def __build_metric_query(self, query):
        cq_str = ""
        for q in query['queries']:
            if q['rate']:
                q_str = "m=%(aggregator)s:rate:%(metric)s" %(q)
            else:
                q_str = "m=%(aggregator)s:%(metric)s" %(q)
            q_str += self.__get_tags_string(q['tags'])
            cq_str += "&" + q_str
        if query.has_key('end'):
            return "%s?start=%s&end=%s%s" %(self.query_endpoint,
                                query['start'], query['end'], cq_str)
        else:
            return "%s?start=%s%s" %(self.query_endpoint,
                                        query['start'], cq_str)
    
    def query(self, q):
        """
            Args:
                q       : OpenTSDB query
            Return:
                OpenTSDBResponse
        """
        hjc = HttpJsonClient(self.host, self.port)
        if type(q) == dict:
            q_str = self.__build_metric_query(q)
            return OpenTSDBResponse(hjc.GET(q_str))
        else:
            return OpenTSDBResponse(hjc.GET(self.query_endpoint+"?"+q))
   
## ASYNC ##     
class JsonBodyProducer(object):
    implements(IBodyProducer)

    def __init__(self, body):
        self.body = json.dumps(body)
        self.length = len(self.body)

    def startProducing(self, consumer):
        consumer.write(self.body)
        return succeed(None)

    def pauseProducing(self):
        pass

    def stopProducing(self):
        pass

class AsyncHttpResponseProtocol(Protocol):
    def __init__(self, finished_deferred, headers):
        self.headers = headers
        self.finished = finished_deferred
        #self.remaining = 1024 * 50
        self.data = ""

    def dataReceived(self, bytes):
        #if self.remaining:
        self.data += bytes
        #    self.remaining -= len(bytes[:self.remaining])

    def __ungzip_(self):
        try:   
            compressedstream = StringIO.StringIO(self.data)
            gzipper = gzip.GzipFile(fileobj=compressedstream)
            return gzipper.read()
        except Exception,e:
            logger.error(e)
            return json.dumps({"error": str(e)})

    def connectionLost(self, reason):
        if self.headers.hasHeader('content-encoding') and \
                ('gzip' in self.headers.getRawHeaders('content-encoding')):
            self.finished.callback(self.__ungzip_())
        else:
            self.finished.callback(self.data)

class AsyncHttpJsonClient(object):
    '''
        Supports json request payload on both HTTP GET and POST
    '''
    def __init__(self, **kwargs):
        # uri, method, body
        for k,v in kwargs.items():
            setattr(self, k, v)
        if not kwargs.has_key('body'):
            self.body = None
        else:
            self.body = JsonBodyProducer(self.body)
        if not kwargs.has_key('method'):
            self.method = 'GET'

        self.agent = Agent(reactor)
        self.__d_agent = self.agent.request(
                self.method,
                self.uri,
                Headers({
                    'User-Agent': ['AsyncHttpJsonRequest'],
                    'Content-Type': ['application/json'],
                    'Accept-Encoding': ['gzip']
                }),
                self.body)

        self.__deferredResponse = Deferred()

    def __readResponseCallback(self, response, userCb, *cbargs):
        response.deliverBody(AsyncHttpResponseProtocol(self.__deferredResponse, response.headers))
        self.__deferredResponse.addCallback(userCb, *([response]+list(cbargs)))
        return self.__deferredResponse

    def __readErrorCallback(self, error, userCb, *cbargs):    
        self.__deferredResponse.addErrback(userCb, *cbargs)

    def addResponseCallback(self, callback, *cbargs):
        self.__d_agent.addCallback(self.__readResponseCallback, callback, *cbargs)

    def addResponseErrback(self, callback, *cbargs):
        self.__d_agent.addErrback(self.__readErrorCallback, callback, *cbargs)

    def cancelRequest(self):
        try:
            self.__deferredResponse.cancel()
            self.__d_agent.cancel()
        except Exception,e:
            logger.debug(str(e))
