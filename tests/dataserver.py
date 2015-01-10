
import unittest

import ujson as json
import time

from twisted.internet import reactor
from autobahn.twisted.websocket import WebSocketClientProtocol, \
                                       WebSocketClientFactory
from pprint import pprint

testMetric = "proc.loadavg.1min"
testWsMsg = {
    "graphType": "line",
    "_id": "some_id",
    "series": [{
        "alias": "",
        "yTransform": "",
        "query": {
            "metric": testMetric,
            "rate": False,
            "aggregator": "sum",
            "tags": {}
        }
    }],
    "tags": {},
    "secondaries": [],
    "name": "test-graph",
    "start": int(time.time()-120)
}
testFailMsg = {"_id": "failed_msg"}

class TestWebSockServer(unittest.TestCase):


    def setUp(self):

        tester = self

        ## Twisted websocket client
        class TestWSProto(WebSocketClientProtocol):

            def testFailed(self):
                self.sendClose()
                tester.fail("-- NO DATA FROM SERVER --")

            def onConnect(self, response):
                #print "Connection opened: %s" % (response.peer)
                self.sendMessage(json.dumps(testWsMsg))
                ## time out test in 10 seconds
                self.factory.reactor.callLater(10, self.testFailed)


            def onMessage(self, msg, isBinary):
                # bail after a single message
                data = json.loads(msg)
                print "* Dataserver: [ok]"
                print "    Keys: %s" % ([k for k in data.keys()])
                self.sendClose()
        

            def onClose(self, wasClean, code, reason):
                #print "Connection closed: %s" % (reason)
                reactor.stop()

        self.wsFactory = WebSocketClientFactory("ws://localhost:9000", debug = False)
        self.wsFactory.protocol = TestWSProto
        

    def runTest(self):

        reactor.connectTCP("127.0.0.1", 9000, self.wsFactory)
        reactor.run()


#if __name__ == '__main__':
#    unittest.main()