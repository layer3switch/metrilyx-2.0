

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





