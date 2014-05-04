import uuid

def new_uuid():
	return "".join(str(uuid.uuid4()).split("-"))