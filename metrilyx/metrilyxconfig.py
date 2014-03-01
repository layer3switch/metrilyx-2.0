import os 
from datastores import jsonFromFile

_abspath = os.path.abspath(__file__)
_apphome = os.path.dirname(os.path.dirname(_abspath))

CONFIG_FILE = os.path.join(_apphome, "etc/metrilyx/metrilyx.conf")
config = jsonFromFile(CONFIG_FILE)
## Not exposed to the user.
config["static_path"] = os.path.join(os.path.dirname(_abspath), "static")
config["schema_path"] = os.path.join(_apphome, "schemas")

if not config.has_key("model_path"):
	config["model_path"] = os.path.join(_apphome, "pagemodels")

if not config['heatmaps'].has_key("store_path"):
	config["heatmaps"]["store_path"] = os.path.join(_apphome, "heatmaps")

if not config['heatmaps'].has_key('db_path'):
	config['heatmaps']['db_path'] = os.path.join(_apphome, "heatmaps.json")

#from pprint import pprint
#print CONFIG_FILE
#pprint(config)