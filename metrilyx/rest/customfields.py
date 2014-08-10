
import json
from rest_framework import serializers

class JSONField(serializers.WritableField):
    
    def to_native(self, obj):
    	#print "to_native"
    	if type(obj) is str:
    		return json.loads(obj)
    	return obj
    
    def from_native(self, value):
    	#print "from_native"
    	if type(value) is str:
    		return json.loads(value)
    	return value