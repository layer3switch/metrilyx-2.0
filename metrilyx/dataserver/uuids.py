
class TagsUUID(object):
	def __init__(self, tags):
		self.uuid = self.__tagsUUID(tags)

	def __tagsUUID(self, tags):
		tagsuuid = "{"
		for k in sorted(tags.keys()):
			tagsuuid += "%s=%s," %(k, tags[k])
		tagsuuid = tagsuuid.rstrip(",")+"}"
		return tagsuuid

	def __str__(self):
		return self.uuid
	def __unicode__(self):
		return self.uuid

class QueryUUID(object):
	def __init__(self, serieQuery):
		self.__tagsuuid = TagsUUID(serieQuery['tags'])
		if serieQuery['rate']:
			self.uuid = "%(aggregator)s:rate:%(metric)s" %(serieQuery)
		else:
			self.uuid = "%(aggregator)s:%(metric)s" %(serieQuery)
		self.uuid += str(self.__tagsuuid)

	def __str__(self):
		return self.uuid
	def __unicode__(self):
		return self.uuid

class SerieUUID(object):
	def __init__(self, serieMeta):
		self.__tagsuuid = TagsUUID(serieMeta['tags'])
		self.uuid = serieMeta['metric']+self.__tagsuuid.uuid

	def __str__(self):
		return self.uuid
	def __unicode__(self):
		return self.uuid