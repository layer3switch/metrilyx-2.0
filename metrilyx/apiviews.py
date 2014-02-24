
import os
import uuid

#from django.http import Http404
from django.http import HttpResponseRedirect
from django.views.generic import TemplateView

from rest_framework.views import APIView
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from datastores import *
from datastreams.opentsdb import OpenTSDBRequest, OpenTSDBEndpoints
from httpclients import HttpJsonClient

from metrilyxconfig import config

from pprint import pprint


class SchemaView(APIView):
	def get(self, request, model_type):
		abspath = os.path.join(config['schema_path'], model_type+".json")
		obj = jsonFromFile(abspath)
		if model_type == "graph":
			obj['_id'] = "".join(str(uuid.uuid4()).split("-"))
		return Response(obj)

class PageView(APIView):
	modelstore = ModelDatastore(config['model_path'])
	## Retrieve
	def get(self, request, page_id=None):
		if page_id == None or page_id == "":
			rslt = self.modelstore.listModels()	
		else:	
			rslt = self.modelstore.getModel(page_id)

		return Response(rslt)

	## Add
	def post(self, request, page_id=None):
		req_obj = json.loads(request.body)
		rslt = self.modelstore.addModel(req_obj)
		return Response(rslt)

	## Overwrite or Add
	def put(self, request, page_id=None):
		req_obj = json.loads(request.body)
		#return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
		rslt = self.modelstore.editModel(req_obj)
		if rslt.get("error"):
			rslt = self.modelstore.addModel(req_obj)
		return Response(rslt)

	## Delete
	def delete(self, request, page_id):
		#return Response(status=status.HTTP_204_NO_CONTENT)
		rslt = self.modelstore.removeModel(page_id)
		return Response(rslt)

	## Update
	#def patch(self, request, model_type, model_id=None, format=None):
	#	return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
		#return Response(request.DATA)


class GraphView(APIView):
	"""
	Handles graph data requests.
	Returns: graph model, with data 
	"""
	def post(self, request, base=None):
		req_obj = json.loads(request.body)
		#print req_obj['graphType'], req_obj['_id']
		## pie charts only needs a smaller subset
		if req_obj['graphType'] == "pie":
			#print req_obj['start']
			if type(req_obj['start']) != int and "-ago" in req_obj['start']:
				req_obj['start'] = "3m-ago"
			else:
				start = int(req_obj['start'])
				end = int(req_obj['end'])
				if req_obj.get('end'):
					if (end - start) > 180:
						req_obj['start'] = end-180
				else:
					now = int(time.time())
					if (now - start) > 180:
						req_obj['start'] = now - 180
	
		tsd_req = OpenTSDBRequest(req_obj)
		return Response(tsd_req.data)


class SearchView(APIView):
	"""
		Search for pages, metrics, tag keys and tag values.
		Metrics and tag key-value pairs use OpenTSDB's interface.
	"""
	#md_search_types = ( "metrics", "tagk", "tagv" )
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

