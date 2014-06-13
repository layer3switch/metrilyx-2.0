import uuid

def new_uuid():
	return "".join(str(uuid.uuid4()).split("-"))

class BasicDataStructure(object):
	def __init__(self, config):
		for k,v in config.items():
			setattr(self, k, v)