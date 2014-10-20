import os 
from datastores import jsonFromFile

_abspath = os.path.abspath(__file__)

_apphome = os.environ.get('METRILYX_HOME')
if _apphome == None:
	_apphome = os.path.dirname(os.path.dirname(_abspath))

CONFIG_FILE = os.path.join(_apphome, "etc/metrilyx/metrilyx.conf")
if not os.path.exists(CONFIG_FILE):
	raise RuntimeError("Configuration file not found: %s!" %(CONFIG_FILE))

config = jsonFromFile(CONFIG_FILE)

if config.has_key("error"):
	raise RuntimeError("Configuration error: %s" %(str(config)))

if not config.has_key("static_path"):
	config["static_path"] = os.path.join(os.path.dirname(_apphome), "www")

if not config.has_key("schema_path"):
	config["schema_path"] = os.path.join(_apphome, "etc/metrilyx/schemas")
