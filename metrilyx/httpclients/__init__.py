

import httplib
try:
    import json
except:
    import simplejson as json

import StringIO
import gzip

from pprint import pprint

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
    def __init__(self, host, port=80):
        self.host = host
        self.port = port

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
            return "/api/query?start=%s&end=%s%s" %(query['start'], query['end'], cq_str)
        else:
            return "/api/query?start=%s%s" %(query['start'], cq_str)
    
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
            #print q
            return OpenTSDBResponse(hjc.GET("/api/query?"+q))
        




