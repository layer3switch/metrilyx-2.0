#!/usr/bin/env python

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(
						os.path.abspath(__file__))))

import json
from metrilyx import metrilyxconfig
from optparse import OptionParser
from pprint import pprint

def loadJsonFile(filename):
	try:
		currCfg = json.load(open(filename, "rb"))
	except Exception,e:
		print e
		sys.exit(1)
	return currCfg

def check_config(default, curr):
	global CFG_VALID
	for k,v in default.items():
		if not curr.has_key(k):
			print "- Missing option: %s" %(k)
			print "  * added: %s" %({k:default[k]})
			print "--"
			curr[k] = default[k]
			CFG_VALID += 1
			continue
		if isinstance(v, dict):
			check_config(v, curr[k])
		elif isinstance(v, list):
			if len(v) != len(curr[k]):
				print "- List length mismatch:", v, curr[k]
				continue
			for i in range(len(v)):
				if isinstance(v[i], dict):
					check_config(v[i], curr[k][i])


def setCeleryTasks(config):
	config["celery"] = {
		"tasks": ["metrilyx.celerytasks"]
	}



CFG_VALID = 0
NEW_CFG_FILENAME = "metrilyx.conf.new"

parser = OptionParser()

parser.add_option("--infile", "-i", dest="infile")
parser.add_option("--outfile", "-o", dest="outfile", default=NEW_CFG_FILENAME)
parser.add_option("--dryrun", "-n", dest="dryrun", default=False, action="store_true")
(opts,args) = parser.parse_args()

if not opts.infile:
	print "Please provide configuration file to check!"
	parser.print_help()
	sys.exit(1)

currC = loadJsonFile(opts.infile)
defaultC = loadJsonFile("etc/metrilyx/metrilyx.conf.sample")

check_config(defaultC, currC)
setCeleryTasks(currC)

if CFG_VALID != 0:
	print "-----------------"
	print " ** %d missing options! **\n" %(CFG_VALID)
else:
	print " * Configuration passed!"
	print " ======================="
if not os.path.exists(opts.outfile):
	if not opts.dryrun:
		json.dump(currC, open(opts.outfile, "wb"), indent=4)
		print " * New config file written: %s\n" %(opts.outfile)
	else:
		print " * New config file"
		print " ================="
		pprint(currC)
	CFG_VALID = 0
else:
	if not opts.dryrun:
		ans = raw_input("* Overwrite existing file: %s? [y/n] " %(opts.outfile))
		if ans.lower() in ('y','yes'):
			json.dump(currC, open(opts.outfile, "wb"), indent=4)
			print "\nNew config file written: %s\n" %(opts.outfile)
			CFG_VALID = 0
	else:
		pprint(currC)
		CFG_VALID = 0

if not opts.dryrun:
	print """ *******************************************************
  Before using the newly generated config file, please
  fill in the appropriate values that may be missing. 
 ********************************************************\n"""

sys.exit(CFG_VALID)
