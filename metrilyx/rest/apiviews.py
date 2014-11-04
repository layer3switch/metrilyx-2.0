
import os
import json
import time
import socket
import requests

from elasticsearch import Elasticsearch

from django.contrib.auth.models import User, Group
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions, filters

import metrilyx

from custompermissions import IsGroupOrReadOnly, IsCreatorOrReadOnly
from serializers import *
from ..models import *

from ..annotations import Annotator

from ..metrilyxconfig import config
from metrilyx import metrilyxconfig
from metrilyx.dataserver import GraphEventRequest
from metrilyx.dataserver.dataproviders import getEventDataProvider

from pprint import pprint

class UserViewSet(viewsets.ModelViewSet):
	permission_classes = (permissions.IsAuthenticated,)
	queryset = User.objects.all()
	serializer_class = UserSerializer


class GroupViewSet(viewsets.ModelViewSet):
	permission_classes = (permissions.IsAuthenticated,)
	queryset = Group.objects.all()
	serializer_class = GroupSerializer


class MapViewSet(viewsets.ModelViewSet):
	"""
	This class is not directly used.  It is subclassed by heatmaps and graphmaps.
	"""
	serializer_class = MapModelSerializer
	permission_classes = (permissions.IsAuthenticatedOrReadOnly,
			IsGroupOrReadOnly, IsCreatorOrReadOnly)

	filter_backends = (filters.SearchFilter,)
	search_fields = ('name', '_id', 'tags',)

	def pre_save(self, obj):
		obj.user = self.request.user


class EventTypeViewSet(viewsets.ModelViewSet):
	queryset = EventType.objects.all()
	serializer_class = EventTypeSerializer
	permission_classes = (IsCreatorOrReadOnly,)

	def create(self, request, path, pk=None):
		if pk is None or pk in ("", "/"):
			return Response({"error": "Invalid request"},
						status=status.HTTP_400_BAD_REQUEST)

		try:
			obj = EventType.objects.get(_id=pk[1:].lower())
			return Response({"error": "Event type already exists!"},
								status=status.HTTP_400_BAD_REQUEST)
		except EventType.DoesNotExist:
			etype = EventType(name=pk[1:].title(), _id=pk[1:].lower(), metadata={})
			rslt = etype.save()
			if rslt.has_key("error"):
				return Response(rslt, status=status.HTTP_400_BAD_REQUEST)

			return Response(rslt)


class GraphMapViewSet(MapViewSet):

	queryset = MapModel.objects.filter(model_type="graph")

	def pre_save(self, obj):
		super(GraphMapViewSet,self).pre_save(obj)
		obj.model_type = "graph"


	def list(self, request, pk=None):
		# w/out this not all models show up in the listing.
		queryset = MapModel.objects.filter(model_type="graph")
		serializer = MapModelListSerializer(queryset, many=True)
		return Response(serializer.data)

	def retrieve(self, request, pk=None):
		export_model = request.GET.get('export', None)
		if export_model == None:
			return super(GraphMapViewSet, self).retrieve(request,pk)
		else:
			graphmap = get_object_or_404(MapModel, model_type='graph', _id=pk)
			serializer = MapModelSerializer(graphmap)
			request.accepted_media_type = "application/json; indent=4"
			return Response(serializer.data, headers={
				'Content-Disposition': 'attachment; filename: %s.json' %(pk),
				'Content-Type': 'application/json'
				})


class SchemaViewSet(viewsets.ViewSet):

	def list(self, request):
		schemas = [ os.path.splitext(x)[0] for x in os.listdir(config['schema_path']) ]
		return Response(schemas)

	def retrieve(self, request, pk=None):
		try:
			schema = json.load(open(os.path.join(config['schema_path'], pk+".json" )))
			if pk == 'graph':
				schema['_id'] = metrilyx.new_uuid()
			return Response(schema)
		except Exception,e:
			return Response({"error": str(e)})

class ConfigurationView(APIView):

	def __metricSearchConfig(self):
		if config['cache']['enabled']:
			return { 'uri': config['cache']['datasource']['url'] }
		else:
			return {'uri': '/api/search'}

	def __websocketConfig(self):
		hostname = socket.gethostname()
		resp = {
			'hostname': hostname,
			'extensions': ['compressed=true']
			}

		if config['websocket'].has_key('hostname'):
			resp['hostname'] = config['websocket']['hostname']

		resp['uri'] = 'ws://%s' %(resp['hostname'])

		if config['websocket'].has_key('port'):
			resp['port'] = config['websocket']['port']
			resp['uri'] = "%s:%d" %(resp['uri'], resp['port'])

		if config['websocket'].has_key('endpoint'):
			resp['endpoint'] = config['websocket']['endpoint']
			resp['uri'] = "%s%s" %(resp['uri'], resp['endpoint'])

		resp['uri'] = "%s?%s" %(resp['uri'], "&".join(resp['extensions']))

		return resp

	def get(self, request, pk=None):
		'''
			Websocket connection information for client requests.
		'''
		response = {
			'websocket': self.__websocketConfig(),
			'metric_search': self.__metricSearchConfig()
			}

		return Response(response)

class EventsViewSet(APIView):
	REQUIRED_QUERY_PARAMS = ('start','eventTypes','tags')
	REQUIRED_WRITE_PARAMS = ('eventType','message', 'tags')

	eventDataProvider = getEventDataProvider()

	def __checkRequest(self, request):
		if request.body == "":
			return {'error': 'no query specified'}
		try:
			jsonReq = json.loads(request.body)
		except Exception,e:
			return {'error': 'json parse: %s' %(str(e))}

		if request.method == 'GET':
			for rp in self.REQUIRED_QUERY_PARAMS:
				if rp not in jsonReq.keys():
					return {'error':'%s key required' %(rp)}
			if type(jsonReq['tags']) is not dict:
				return {'error': 'Invalid tags'}
		else:
			for rp in self.REQUIRED_WRITE_PARAMS:
				if rp not in jsonReq.keys():
					return {'error': 'missing parameter: %s' %(rp)}

			try:
				etype = EventType.objects.get(_id=jsonReq['eventType'].lower())
			except EventType.DoesNotExist:
				return {'error': 'event type: %s not found' %(jsonReq['eventType'])}

		return jsonReq

	def get(self, request, pk=None):
		'''
			request object:
				types:
				tags:
				start:
				end: (optional)
		'''
		reqBody = self.__checkRequest(request)
		if reqBody.has_key('error'):
			return Response(reqBody, status=status.HTTP_400_BAD_REQUEST)

		gevt = {
			"_id": "annotations",
			"annoEvents": {
				"tags": reqBody["tags"],
				"eventTypes": reqBody["eventTypes"]
			},
			"start": reqBody["start"]
		}
		if reqBody.has_key("end"):
			gevt["end"] = reqBody["end"]

		ger = GraphEventRequest(gevt)
		out = []
		for gr in ger.split():
			for (url, et, query) in self.eventDataProvider.queryBuilder.getQuery(gr, split=False):
				rslt = self.eventDataProvider.search(query)
				if len(rslt["hits"]["hits"]) > 0:
					out += [r['_source'] for r in rslt['hits']['hits']]
		return Response(out)

	def post(self, request, pk=None):
		'''
			request object:
				eventType:
				tags:
				message:
				timestamp:
		'''
		reqBody = self.__checkRequest(request)
		if reqBody.has_key('error'):
			return Response(reqBody, status=status.HTTP_400_BAD_REQUEST)

		try:
			out = dict([(k,v) for k,v in reqBody.items() if k != "tags"])
			for k,v in reqBody['tags'].items():
				out[k] = v
			anno = Annotator(out)
			self.eventDataProvider.add(anno.annotation)
			return Response(anno.annotation)
		except Exception,e:
			return Response({'error': str(e)},
				status=status.HTTP_503_SERVICE_UNAVAILABLE)

class TagViewSet(viewsets.ViewSet):

	def __get_unique_tags(self, model_type=''):
		## distinct() is not handled properly when using json in postgres
		if model_type != '':
			objs = MapModel.objects.filter(model_type=model_type).values_list('tags',flat=True)
		else:
			objs = MapModel.objects.values_list('tags',flat=True)
		## this is to handle db's that dont' support json types
		if len(objs) < 1:
			return []
		if type(objs[0]) in (str,unicode): objs = [ json.loads(o) for o in objs ]
		objs = [ o for o in objs if len(o) > 0 ]
		out = []
		for o in objs:
			out += [ t for t in o if t not in out ]
		return sorted(out)

	def list(self, request, pk=None):
		model_type = request.GET.get('model_type', '')
		tags = self.__get_unique_tags(model_type)
		return Response([ {'name': t } for t in tags ])

	def retrieve(self, request, pk=None):
		model_type = request.GET.get('model_type', '')
		if model_type == '':
			objs = MapModel.objects.filter(tags__contains=pk)
		else:
			objs = MapModel.objects.filter(tags__contains=pk, model_type=model_type)
		serializer = MapModelSerializer(objs, many=True)
		return Response(serializer.data)

class OpenTSDBMetaSearch(object):
    """
    Class to handle metric metadata searches.  This class is used when
    metric metadata caching is disabled.
    """
    def __init__(self, config):
    	self.suggest_limit = config["suggest_limit"]
        self.tsdb_suggest_url = "%(uri)s:%(port)d%(search_endpoint)s" %(config)

    def search(self, obj, limit=None):
        if obj["type"] == "metric":
            obj["type"] = "metrics"
        if limit != None:
        	resp = requests.get("%s?max=%d&type=%s&q=%s" %(self.tsdb_suggest_url,
        										limit, obj['type'], obj['query']))
        else:
        	resp = requests.get("%s?max=%d&type=%s&q=%s" %(self.tsdb_suggest_url,
        							self.suggest_limit, obj['type'], obj['query']))
        return resp.json()

class SearchViewSet(viewsets.ViewSet):

	def __init__(self, *args, **kwargs):
		super(SearchViewSet, self).__init__(*args, **kwargs)
		# Only used if cache is disabled
		self.metricMetaSearch = OpenTSDBMetaSearch(config["dataprovider"])

	def list(self, request, pk=None):
		return Response(['graphmaps', 'heatmaps', 'metrics', 'tagk', 'tagv', 'event_types'])

	def retrieve(self, request, pk=None):
		query = request.GET.get('q', '')
		limit = request.GET.get('limit', config['dataprovider']['suggest_limit'])

		if query == '':
			response = []
		elif pk == 'graphmaps':
			models_obj = MapModel.objects.filter(name__contains=query, model_type='graph')
			serializer_obj = MapModelSerializer(models_obj, many=True)
			response = serializer_obj.data
		elif pk == 'event_types':
			models_obj = EventType.objects.filter(name__contains=query)
			serializer_obj = EventTypeSerializer(models_obj,many=True)
			response = serializer_obj.data
		elif pk in ('tagk','tagv', 'metrics'):
			response = self.metricMetaSearch.search({'type':pk,'query':query},limit=limit)
		else:
			response = {"error": "Invalid search: %s" %(pk)}
		return Response(response)
