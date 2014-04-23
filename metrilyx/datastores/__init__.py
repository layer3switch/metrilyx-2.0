
import os
import re
import json

from pprint import pprint 

def jsonFromFile(filepath):
	if os.path.exists(filepath):
		fh = open(filepath)
		jdata = json.load(fh)
		fh.close()
		return jdata
	else:
		return { 
			"error": "file not found %s" %(filepath),
			"message": "file not found %s" %(filepath) }

def jsonToFile(obj, filepath):
	try: 
		fh = open(filepath, 'wb')
		json.dump(obj, fh, indent=4)
		fh.close()
		return {
			"success": "%s saved" %(filepath),
			"message": "%s saved" %(os.path.splitext(os.path.basename(filepath))[0])
		}
	except Exception,e:
		return {
			"error": str(e),
			"message": str(e)
			}

class FileModelStore(object):
	def __init__(self, repo_path, log_hdl=None):
		self.store_type = "file"
		self.repo_path = repo_path
		if not os.path.exists(repo_path):
			print "Creating path: %s" %(repo_path)
			os.makedirs(repo_path)

	def getModel(self, model_id):
		abspath = os.path.join(self.repo_path, model_id+".json")
		return jsonFromFile(abspath)

	def addModel(self, data):
		if not data.get("_id"):
			response = { 
				"error": "_id not provided",
				"message": "_id not provided"
					}
		elif not data.get("name"):
			data['name'] = data['_id']
		else:
			new_id = re.sub(r'\\', "_", re.sub(r"/", "_", data["_id"]))
			model_path = os.path.join(self.repo_path, new_id+".json")
			if os.path.exists(model_path):
				response = { 
					"error": "_id already exists %s" %(new_id),
					"message": "_id already exists %s" %(new_id) }
			else:
				response = jsonToFile(data, model_path)
		return response

	def removeModel(self, model_id):
		try:
			model_path = os.path.join(self.repo_path, model_id+".json")
		except:
			raise RuntimeError(self.repo_path, model_id)
			
		if os.path.exists(model_path):
			try:
				os.remove(model_path)
				response = {
					"success": "%s removed" %(model_id),
					"message": "%s removed" %(model_id) }
			except Exception, e:
				response = { 
					"error": str(e),
					"message": str(e) }
		else:
			response = { 
				"error": "file not found %s" %(model_path),
				"message": "file not found %s" %(model_path) }
		return response

	def editModel(self, model):
		model_path = os.path.join(self.repo_path, model['_id']+".json")
		if not os.path.exists(model_path):
			response = { 
				"error": "model not found %s" %(model_path),
				"message": "model not found %s" %(model_path)
				}
		else:
			response = jsonToFile(model, model_path)

		return response

	def listModels(self):
		out = []
		for p in os.listdir(self.repo_path):
			if p.split(".")[-1] != "json": continue
			abspath = os.path.join(self.repo_path, p)
			j = jsonFromFile(abspath)
			if j.get("error"): 
				print "[ModelDatastore.listModels]"
				pprint(j)
				continue
			out.append({
				"name": j['name'],
				"_id": j['_id']
				})
		return out
