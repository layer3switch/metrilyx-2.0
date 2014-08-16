
import re

import metrilyx
from metrilyx.metrilyxconfig import config


re_504 = re.compile("(504 gateway time.+out)", re.IGNORECASE)


def getPerfDataProvider():
	mc = config['dataprovider']['loader_class'].split(".")
	mod = __import__('metrilyx.dataserver.dataproviders.perf.%s'%(
									".".join(mc[:-1])), fromlist=['*']) 
	return eval("mod.%s(config['dataprovider'])" %(mc[-1]))

def getEventDataProvider():
	mc = config['annotations']['dataprovider']['loader_class'].split(".")
	mod = __import__('metrilyx.dataserver.dataproviders.events.%s' %(
									".".join(mc[:-1])), fromlist=['*'])
	return eval("mod.%s(config['annotations']['dataprovider'])" %(mc[-1]))
