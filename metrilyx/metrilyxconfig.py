import os 
from datastores import jsonFromFile

_abspath = os.path.abspath(__file__)
_apphome = os.path.dirname(os.path.dirname(_abspath))

CONFIG_FILE = os.path.join(_apphome, "etc/metrilyx/metrilyx.conf")
config = jsonFromFile(CONFIG_FILE)

config["static_path"] = os.path.join(os.path.dirname(_abspath), "static")
config["schema_path"] = os.path.join(_apphome, "schemas")
