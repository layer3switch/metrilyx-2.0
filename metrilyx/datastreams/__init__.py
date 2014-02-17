
class GraphRequest(object):
	def __init__(self, request):
		self.request = request
		self.series = request['series']
		if request.get('tags'):
			self.tags = request['tags']
		else:
			self.tags = {}

	@property
	def data(self):
		return self.request