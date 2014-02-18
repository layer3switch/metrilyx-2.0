import os 
from datastores import jsonFromFile

_abspath = os.path.abspath(__file__)

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(_abspath)), "etc/metrilyx/metrilyx.conf")
config = jsonFromFile(CONFIG_FILE)
## Not exposed to the user.
config["static_path"] = os.path.join(os.path.dirname(_abspath), "static")
config["schema_path"] = os.path.join(os.path.dirname(os.path.dirname(_abspath)), "schemas")

if not config.has_key("model_path"):
	config["model_path"] = os.path.join(os.path.dirname(os.path.dirname(_abspath)), "pagemodels")

#from pprint import pprint
#print CONFIG_FILE
#pprint(config)