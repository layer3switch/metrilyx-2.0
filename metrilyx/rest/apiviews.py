
import os
import json
import requests

from elasticsearch import Elasticsearch

from django.contrib.auth.models import User, Group
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions, filters

from celery import Celery

import metrilyx

from custompermissions import IsGroupOrReadOnly, IsCreatorOrReadOnly
from serializers import *
from ..models import * 

from ..datastores.ess import ElasticsearchDatastore
from ..datastores.mongodb import MetricCacheDatastore
from ..annotations import Annotator

from ..metrilyxconfig import config
from metrilyx import metrilyxconfig

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


class HeatMapViewSet(MapViewSet):
	
	queryset = MapModel.objects.filter(model_type="heat")

	def pre_save(self, obj):
		super(HeatMapViewSet,self).pre_save(obj)
		obj.model_type = "heat"

	def list(self, request, pk=None):
		serializer = MapModelListSerializer(self.queryset, many=True)
		return Response(serializer.data)

	def retrieve(self, request, pk=None):
		export_model = request.GET.get('export', None)
		if export_model == None:
			return super(HeatMapViewSet, self).retrieve(request,pk)
		else:
			heatmap = get_object_or_404(MapModel, model_type='heat', _id=pk)
			serializer = MapModelSerializer(heatmap)
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

class EventsViewSet(APIView):
	REQUIRED_QUERY_PARAMS = ('start','eventTypes','tags')
	REQUIRED_WRITE_PARAMS = ('eventType','message', 'tags')

	eds = ElasticsearchDatastore(config['annotations']['dataprovider'])

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
			
		# always yield's 1 when split=False
		for (url, eventTypes, query) in self.eds.queryBuilder.getQuery(reqBody,split=False):
			essRslt = self.eds.search(query)
			## TODO: potentially need to add error checking 
			rslt = [r['_source'] for r in essRslt['hits']['hits']]
			return Response(rslt)
	
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
			self.eds.add(anno.annotation)
			return Response(anno.annotation)
		except Exception,e:
			## 503 service unavailable
			return Response({'error': str(e)},
				status=status.HTTP_503_SERVICE_UNAVAILABLE)

	'''
	def put(self, request, pk=None):
		reqBody = self.__checkRequest(json.loads(request.body))
		if reqBody.has_key('error'):
			return Response(reqBody, status=status.HTTP_400_BAD_REQUEST)
		return Response({})
	'''

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

class SearchViewSet(viewsets.ViewSet): 
	#tsdb_suggest_url = "%(uri)s%(search_endpoint)s?max=%(suggest_limit)d" %(
	#													config['dataprovider'])
	metricMetaCache = MetricCacheDatastore(**config['cache']['datastore']['mongodb'])

	def list(self, request, pk=None):
		return Response(['graphmaps', 'heatmaps', 'metrics', 'tagk', 'tagv', 'event_types'])

	def retrieve(self, request, pk=None):
		query = request.GET.get('q', '')
		limit = request.GET.get('limit', config['cache']['result_size'])

		if query == '':
			response = []
		elif pk == 'graphmaps':
			models_obj = MapModel.objects.filter(name__contains=query, model_type='graph')
			serializer_obj = MapModelSerializer(models_obj, many=True)
			response = serializer_obj.data
		elif pk == 'heatmaps':
			models_obj = MapModel.objects.filter(name__contains=query, model_type='heat')
			#print models_obj
			serializer_obj = MapModelSerializer(models_obj, many=True)
			response = serializer_obj.data
		elif pk == 'metrics':
			response = self.metricMetaCache.search({'type': 'metric', 'query': query}, limit=limit)
		elif pk in ('tagk','tagv'):
			response = self.metricMetaCache.search({'type': pk, 'query': query}, limit=limit)
		elif pk == 'event_types':
			models_obj = EventType.objects.filter(name__contains=query)
			serializer_obj = EventTypeSerializer(models_obj,many=True)
			response = serializer_obj.data
		else:
			response = {"error": "Invalid search: %s" %(pk)}
		return Response(response)

class HeatView(APIView):
	def get(self, request, heat_id=None):
		# list heat queries
		if heat_id == None:
			objs = HeatQuery.objects.all()
			serializer  = HeatQuerySerializer(objs, many=True)
			out = serializer.data
		else:
			app = Celery('metrilyx')
			app.config_from_object('metrilyx.heatmapsconfig')
			rslt = app.AsyncResult(heat_id)

			hquery = get_object_or_404(HeatQuery, _id=heat_id)
			serializer = HeatQuerySerializer(hquery)
			out = serializer.data
			out['data'] = rslt.get()

		return Response(out)
