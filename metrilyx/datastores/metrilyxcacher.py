
import requests

class CacheStore(object):
	
	def __init__(self, url):
		self.url = url

	def search(self, **kwargs):
		if kwargs['type'] in ("metrics", "metric"):
			mdType = "metrics"
		elif kwargs['type'] in ("tagk", "tagkeys", "tagkey" "tagnames", "tagname"):
			mdType = "tagnames"
		elif kwargs['type'] in ("tagv", "tagvalues", "tagvalue"): 
			mdType = "tagvalues"
		else:
			return {"error": "Invalid metadata type"}

		queryUrl = "%s/%s?q=%s" %(self.url, mdType, kwargs['query'])
		response = requests.get(queryUrl)
		return response.json()
