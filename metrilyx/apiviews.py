
import os
import json
import requests


from django.contrib.auth.models import User, Group
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions, filters

from celery import Celery

import metrilyx

from custom_permissions import IsGroupOrReadOnly, IsCreatorOrReadOnly
from serializers import *
from models import * 

from datastores import *
from httpclients import HttpJsonClient

from metrilyxconfig import config

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


class GraphMapViewSet(MapViewSet):
	
	queryset = MapModel.objects.filter(model_type="graph")

	def pre_save(self, obj):
		super(GraphMapViewSet,self).pre_save(obj)
		obj.model_type = "graph"

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
	tsdb_suggest_url = "%(uri)s%(search_endpoint)s?max=%(suggest_limit)d" %(config['dataproviders'][0])

	def list(self, request, pk=None):
		return Response(['graphmaps', 'heatmaps', 'metrics', 'tagk', 'tagv'])

	def retrieve(self, request, pk=None):
		query = request.GET.get('q', '')
		if query == '':
			response = []
		elif pk == 'graphmaps':
			models_obj = MapModel.objects.filter(name__contains=query, model_type='graph')
			serializer_obj = MapModelSerializer(models_obj, many=True)
			response = serializer_obj.data
		elif pk == 'heatmaps':
			models_obj = MapModel.objects.filter(name__contains=query, model_type='heat')
			serializer_obj = MapModelSerializer(models_obj, many=True)
			response = serializer_obj.data
		elif pk in ('metrics','tagk','tagv'):
			request_url = "%s&type=%s&q=%s" %(self.tsdb_suggest_url, pk, query)
			resp = requests.get(request_url)
			response = resp.json()
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
