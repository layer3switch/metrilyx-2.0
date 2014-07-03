#!/usr/bin/env python

import os
import json
import sys
from pprint import pprint


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "metrilyx.settings")

from metrilyx.models import *

graphSchema = json.load(open("./schemas/graph.json", "rb"))

def updateThresholds(graph):
	if graph['graphType'] == "pie": 
		print graph['_id'],  "skipping pie graph"
		return
	if not graph.has_key('thresholds'):
		graph['thresholds'] = graphSchema['thresholds']
		print graph['_id'], "thresholds added"

	else:
		if type(graph['thresholds']['danger']) is dict: 
			print graph['_id'], "skipping already in upgraded"
			return
		if type(graph['thresholds']['danger']) is str or \
				type(graph['thresholds']['danger']) is unicode:
			graph['thresholds']['danger'] = float(graph['thresholds']['danger'])
		if type(graph['thresholds']['warning']) is str or \
				type(graph['thresholds']['warning']) is unicode:
			graph['thresholds']['warning'] = float(graph['thresholds']['warning'])
		if type(graph['thresholds']['info']) is str or \
				type(graph['thresholds']['info']) is unicode:
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
		print graph['_id'], "thresholds updated"
		#print model._id, graph['thresholds']

def addEventAnnoDef(graph):
	if not graph.has_key('annoEvents'):
		graph['annoEvents'] = graphSchema['annoEvents']
		print graph['_id'], "added event annotation"
	else:
		if graph['annoEvents'].has_key('types'):
			graph['annoEvents']['eventTypes'] = graph['annoEvents']['types']
			del graph['annoEvents']['types']
			print graph['_id'], "updated event annotation"

def updateMultiPaneOptions(graph):
	if not graph.has_key('multiPane'):
		graph['multiPane'] = False
	if not graph.has_key('panes'):
		graph['panes'] = ["",""]
	else:
		while(len(graph['panes'])<2):
			graph['panes'].append("")
	for s in graph['series']:
		if not s.has_key('paneIndex'):
			s['paneIndex'] = 0

def processGraphLayout(model):
	for row in model.layout:
		for col in row:
			for pod in col:
				for graph in pod['graphs']:
					updateThresholds(graph)
					addEventAnnoDef(graph)
					updateMultiPaneOptions(graph)

def processHeatLayout(model):
	for row in model.layout:
		for col in row:
			for pod in col:
				for graph in pod['graphs']:
					updateThresholds(graph)

models = MapModel.objects.all()
for m in models:
	if m.model_type == "graph":
		processGraphLayout(m)
		m.save()
	elif m.model_type == "heat":
		processHeatLayout(m)
		m.save()
