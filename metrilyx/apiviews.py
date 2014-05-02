
import os
import uuid
import json

from django.contrib.auth.models import User, Group
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions

from celery import Celery

from custom_permissions import IsGroupOrReadOnly, IsCreatorOrReadOnly
from serializers import *
from models import * 

from datastores import *
from datastreams.opentsdb import OpenTSDBRequest, OpenTSDBEndpoints
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
		## extract queries before saving model

	def retrieve(self, request, pk=None):
		export_model = request.GET.get('export', None)
		if export_model == None:
			return super(HeatMapViewSet, self).retrieve(request,pk)
		else:
			heatmap = get_object_or_404(MapModel,model_type='heat', _id=pk)
			serializer = MapModelSerializer(heatmap)
			request.accepted_media_type = "application/json; indent=4"
			return Response(serializer.data, headers={
				'Content-Disposition': 'attachment; filename: %s.json' %(pk),
				'Content-Type': 'application/json'
				})

### REFACTOR EVERYTHING BELOW ###
class SchemaViewSet(viewsets.ViewSet):

	def list(self, request):
		schemas = [ os.path.splitext(x)[0] for x in os.listdir(config['schema_path']) ]
		return Response(schemas)

	def retrieve(self, request, pk=None):
		try:
			schema = json.load(open(os.path.join(config['schema_path'], pk+".json" )))
			return Response(schema)
		except Exception,e:
			return Response({"error": str(e)})


class PageView(APIView):
	modelstore = FileModelStore(config['model_path'])
	## Retrieve
	def get(self, request, page_id=None):
		if page_id == None or page_id == "":
			rslt = self.modelstore.listModels()
		else:	
			rslt = self.modelstore.getModel(page_id)
		
		export = request.QUERY_PARAMS.get("export", False)
		if export:
			request.accepted_media_type = "application/json; indent=4"
			return Response(rslt, headers={
				'Content-Disposition': 'attachment; filename: %s.json' %(page_id),
				'Content-Type': 'application/json'
				})
		return Response(rslt)

	def __sanitize_series(self, req_obj):
		for row in req_obj['layout']:
			for col in row:
				for pod in col:
					for graph in pod['graphs']:
						for s in graph['series']:
							if s.get('loading'): del s['loading']
		return req_obj

	## Add
	def post(self, request, page_id=None):
		j_req_obj = json.loads(request.body)
		req_obj = self.__sanitize_series(j_req_obj)
		rslt = self.modelstore.addModel(req_obj)
		return Response(rslt)

	## Overwrite or Add
	def put(self, request, page_id=None):
		j_req_obj = json.loads(request.body)
		req_obj = self.__sanitize_series(j_req_obj)
		#return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
		rslt = self.modelstore.editModel(req_obj)
		pprint(rslt)
		if rslt.get("error"):
			print rslt.get("error")
			rslt = self.modelstore.addModel(req_obj)
		return Response(rslt)

	## Delete
	def delete(self, request, page_id):
		#return Response(status=status.HTTP_204_NO_CONTENT)
		rslt = self.modelstore.removeModel(page_id)
		return Response(rslt)
"""
class HeatmapView(PageView):
	modelstore = FileModelStore(config['heatmaps']['store_path'])
	hmdb = config['heatmaps']['db_path']
	'''
	def get(self, request, heatmap_id=None):
		if heatmap_id == None or heatmap_id == "":
			rslt = self.modelstore.listModels()	
		else:	
			rslt = self.modelstore.getModel(heatmap_id)

		return Response(rslt)
	'''
	def __extract_heat_queries(self, request):
		req_obj = json.loads(request.body)
		out = []
		for row in req_obj['layout']:
			for col in row:
				for pod in col:
					for graph in pod['graphs']:
						for serie in graph['series']:
							q = serie['query']
							if q.get('rate'):
								qbase = "%(aggregator)s:rate:%(metric)s" %(q)
							else:	
								qbase = "%(aggregator)s:%(metric)s" %(q)
							tags = ",".join([ "%s=%s" %(k,v) for k,v in q['tags'].items() ])
							out.append({
								"_id": "%s{%s}" %(qbase, tags),
								"query": "%s{%s}" %(qbase, tags),
								"name": pod['name']
								})
		return out

	def __write_to_db(self, request):
		qlist = self.__extract_heat_queries(request)
		db = jsonFromFile(self.hmdb)
		for ql in qlist:
			db[ql['_id']] = ql
		return jsonToFile(db, self.hmdb)

	def put(self, request, page_id=None):
		rslt = super(HeatmapView, self).put(request, page_id)
		## check for errors
		pprint(self.__write_to_db(request))
		return rslt

	def post(self, request, page_id=None):
		rslt = super(HeatmapView, self).post(request, page_id)
		## check for errors
		pprint(self.__write_to_db(request))
		return rslt

	def delete(self, request, page_id):
		rslt = super(HeatmapView, self).delete(request, page_id)		
		return rslt
"""
class HeatView(APIView):
	def get(self, request, heat_id=None):
		obj = jsonFromFile(config['heatmaps']['db_path'])
		"""
		Send all queries
		"""
		if heat_id == None:
			return Response([ v for k,v in obj.items() ])
		else:
			app = Celery('metrilyx')
			app.config_from_object('metrilyx.heatmapsconfig')
			rslt = app.AsyncResult(heat_id)
			out = [ v for k,v in obj.items() if k == heat_id ][0]
			out['data'] = rslt.get()
			return Response(out)

class GraphView(APIView):
	pie_graph_interval_rel = "5m-ago"
	pie_graph_interval_secs = 300

	def __calibrate_piegraph(self, req_obj):
		"""
		In the case of pie graphs cut the query time down to 
		2 mins.

		Args:
			req_obj	: original http request object
		Returns:
			Modified request object with trimmed time
		"""
		if req_obj['graphType'] == "pie":
			#print req_obj['start']
			if type(req_obj['start']) != int and "-ago" in req_obj['start']:
				req_obj['start'] = self.pie_graph_interval_rel
			else:
				start = int(req_obj['start'])			
				if req_obj.get('end'):
					end = int(req_obj['end'])
					if (end - start) > self.pie_graph_interval_secs:
						req_obj['start'] = end - self.pie_graph_interval_secs
				else:
					now = int(time.time())
					if (now - start) > self.pie_graph_interval_secs:
						req_obj['start'] = now - self.pie_graph_interval_secs
		return req_obj
	
	def post(self, request, graph_query=None):
		"""
		Handles graph data requests.
		
		Returns: 
			graph model, with data 
		"""
		req_obj = json.loads(request.body)
		## pie charts only needs a smaller subset
		req_obj = self.__calibrate_piegraph(req_obj)
		tsd_req = OpenTSDBRequest(req_obj)
		return Response(tsd_req.data)

class SearchView(APIView):
	"""
		Search for pages, metrics, tag keys and tag values.
		Metrics and tag key-value pairs use OpenTSDB's interface.
	"""
	tsdb_endpoints = OpenTSDBEndpoints()

	def get(self, request, request_prefix):
		#print params_str
		search_type = request.GET.get('type', None)
		search_query = request.GET.get('q', '')
		if search_type == "page":
			return Response([ os.path.splitext(f)[0] for f in os.listdir(config['model_path']) if search_query in f ])
		else:
			hjc = HttpJsonClient(config['tsdb']['uri'], config['tsdb']['port'])
			rslt = hjc.GET(self.tsdb_endpoints.suggest+"?max="+str(config['tsdb']['suggest_limit'])+"&type="+search_type+"&q="+search_query)
			return Response(rslt)

