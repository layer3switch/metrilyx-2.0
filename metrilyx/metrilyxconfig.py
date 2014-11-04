
import os
from datastores import jsonFromFile

_abspath = os.path.abspath(__file__)

_apphome = os.environ.get('METRILYX_HOME')
if _apphome == None:
	print " * Warning: METRILYX_HOME environment variable not set!"
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

if not config['annotations']['dataprovider'].has_key('default_mapping'):
    config['annotations']['dataprovider']['default_mapping'] = os.path.join(
                            _apphome, "etc/metrilyx/ess-default-mappings.json")

default_mapping = jsonFromFile(config['annotations']['dataprovider']['default_mapping'])
if default_mapping.has_key('error'):
    raise RuntimeError("Invalid mapping config: %s" % (
                        config['annotations']['dataprovider']['default_mapping']))

config['annotations']['dataprovider']['default_mapping'] = default_mapping

