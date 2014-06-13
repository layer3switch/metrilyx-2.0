#!/usr/bin/env python

import os
import json
import sys
from pprint import pprint


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "metrilyx.settings")

from metrilyx.models import *

graphSchema = json.load(open("./schemas/graph.json", "rb"))

def upgradeThresholds(graph):
	if graph['graphType'] == "pie": 
		print graph['_id'],  "skipping pie graph"
		return
	if not graph.has_key('thresholds') or \
			type(graph['thresholds']['danger']) is str or \
			type(graph['thresholds']['danger']) is unicode:
		graph['thresholds'] = graphSchema['thresholds']
	else:
		if type(graph['thresholds']['danger']) is dict: 
			print graph['_id'], "skipping already in upgraded"
			return
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
		print graph['_id'], "updated"
		#print model._id, graph['thresholds']

def addEventAnnoDef(graph):
	graph['annoEvents'] = graphSchema['annoEvents']

def processLayout(model):
	for row in model.layout:
		for col in row:
			for pod in col:
				for graph in pod['graphs']:
					upgradeThresholds(graph)
					addEventAnnoDef(graph)

models = MapModel.objects.all()
for m in models:
	if m.model_type != "graph": continue
	processLayout(m)
	m.save()
