#!/usr/bin/env python

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(
						os.path.abspath(__file__))))
import json						
from optparse import OptionParser
from pprint import pprint


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "metrilyx.settings")

from metrilyx.models import *
#from metrilyx.metrilyxconfig import config
#config['schema_path']
graphSchema = json.load(open("etc/metrilyx/schemas/graph.json", "rb"))

def printStatus(graph, status, msg):
	if status in ('ADDED', 'UPDATED'):
		print "  * %s '%s' (%s): %s" %(status, graph['name'], graph['_id'], msg)	
	else:
		print "  %s %s (%s): %s" %(status, graph['name'], graph['_id'], msg)

def updateThresholds(graph):
	if graph['graphType'] == "pie": 
		printStatus(graph, "SKIPPING", "pie graph")
		return
	if not graph.has_key('thresholds'):
		graph['thresholds'] = graphSchema['thresholds']
		printStatus(graph, "ADDED", "thresholds")

	else:
		if type(graph['thresholds']['danger']) is dict: 
			printStatus(graph, "SKIPPING", "already upgraded")
			return
		if type(graph['thresholds']['danger']) is str or \
				type(graph['thresholds']['danger']) is unicode:
			if graph['thresholds']['danger'] == '':
				graph['thresholds']['danger'] = graphSchema['thresholds']['danger']['min']				
			else:
				graph['thresholds']['danger'] = float(graph['thresholds']['danger'])
		if type(graph['thresholds']['warning']) is str or \
				type(graph['thresholds']['warning']) is unicode:
			if graph['thresholds']['warning'] == '':
				graph['thresholds']['warning'] = graphSchema['thresholds']['warning']['min']				
			else:
				graph['thresholds']['warning'] = float(graph['thresholds']['warning'])
		if type(graph['thresholds']['info']) is str or \
				type(graph['thresholds']['info']) is unicode:
			if graph['thresholds']['info'] == '':
				graph['thresholds']['info'] = graphSchema['thresholds']['info']['min']				
			else:
				graph['thresholds']['info'] = float(graph['thresholds']['info'])

		graph['thresholds'] = {
			'danger': {
				'min': graph['thresholds']['danger'],
				'max': graph['thresholds']['danger']+1000000
			},
			'warning': {
				'min': graph['thresholds']['warning'],
				'max': graph['thresholds']['danger']
			},
			'info': {
				'min': graph['thresholds']['info'],
				'max': graph['thresholds']['warning']
			}
		}
		printStatus(graph, "UPDATED", "thresholds")

def addEventAnnoDef(graph):
	if not graph.has_key('annoEvents'):
		graph['annoEvents'] = graphSchema['annoEvents']
		printStatus(graph, "ADDED", "event annotation")
	else:
		if graph['annoEvents'].has_key('types'):
			graph['annoEvents']['eventTypes'] = graph['annoEvents']['types']
			del graph['annoEvents']['types']
			printStatus(graph, "UPDATED", "event annotation")

def updateMultiPaneOptions(graph):
	if not graph.has_key('multiPane'):
		graph['multiPane'] = False
		printStatus(graph, "ADDED", "multiPane")
	if not graph.has_key('panes'):
		graph['panes'] = ["",""]
		printStatus(graph, "ADDED", "panes")
	else:
		while(len(graph['panes'])<2):
			graph['panes'].append("")
	for s in graph['series']:
		if not s.has_key('paneIndex'):
			s['paneIndex'] = 0
			printStatus(graph, "ADDED", "paneIndex")

def udpateSecondaries(graph):
	if not graph.has_key("secondaries"):
		printStatus(graph, "ADDED", "secondaries")
		graph["secondaries"] = []

def processGraphLayout(model):
	for row in model.layout:
		for col in row:
			for pod in col:
				for graph in pod['graphs']:
					updateThresholds(graph)
					addEventAnnoDef(graph)
					updateMultiPaneOptions(graph)
					udpateSecondaries(graph)





parser = OptionParser()
parser.add_option("--commit", "-c", dest="commit", default=False, action="store_true")

(opts,args) = parser.parse_args()

models = MapModel.objects.all()
if not opts.commit:
	print "--- DRYRUN ---\n"
	for m in models:
		print "[%s]" %(m._id)
		if m.model_type == "graph":
			processGraphLayout(m)
		print ""
	print "--- DRYRUN ---"
else:
	for m in models:
		print "[%s]" %(m._id)
		if m.model_type == "graph":
			processGraphLayout(m)
			m.save()
		print ""
