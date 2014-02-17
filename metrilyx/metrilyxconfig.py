import os 
from datastores import jsonFromFile

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "etc/metrilyx/metrilyx.conf")
config = jsonFromFile(CONFIG_FILE)
## Not exposed to the user.
config["static_path"] = os.path.join(os.path.dirname(__file__), "static")
config["schema_path"] = os.path.join(os.path.dirname(os.path.dirname(__file__)), "schemas")

if not config.has_key("model_path"):
	config["model_path"] = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pagemodels")

#from pprint import pprint
#pprint(config)