
import requests
import unittest

testEndpoints = {
    "url": "http://localhost:8000",
    "config": "/api/config",
    "schemas": {
        "metric": "/api/schemas/metric",
        "graph": "/api/schemas/graph",
        "pod": "/api/schemas/pod",
        "page": "/api/schemas/page",
        }
    }

class TestEndpoints(unittest.TestCase):

    def setUp(self):
        pass

    def test_config(self):
        resp = requests.get("%s%s" % (testEndpoints["url"], testEndpoints["config"]))
        self.assertEqual(resp.status_code, 200)
        print "\nEndpoint: %s [ok]" % (testEndpoints["config"])

    def test_schemaMetric(self):
        resp = requests.get("%s%s" % (testEndpoints["url"], testEndpoints["schemas"]["metric"]))
        self.assertEqual(resp.status_code, 200)
        print "\nEndpoint: %s [ok]" % (testEndpoints["schemas"]["metric"])

    def test_schemaGraph(self):
        resp = requests.get("%s%s" % (testEndpoints["url"], testEndpoints["schemas"]["graph"]))
        self.assertEqual(resp.status_code, 200)
        print "\nEndpoint: %s [ok]" % (testEndpoints["schemas"]["graph"])

    def test_schemaPod(self):
        resp = requests.get("%s%s" % (testEndpoints["url"], testEndpoints["schemas"]["pod"]))
        self.assertEqual(resp.status_code, 200)
        print "\nEndpoint: %s [ok]" % (testEndpoints["schemas"]["pod"])

    def test_schemaPage(self):
        resp = requests.get("%s%s" % (testEndpoints["url"], testEndpoints["schemas"]["page"]))
        self.assertEqual(resp.status_code, 200)
        print "\nEndpoint: %s [ok]" % (testEndpoints["schemas"]["page"])
