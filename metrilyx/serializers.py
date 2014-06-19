from django.contrib.auth.models import User, Group

from models import *
import custom_fields

from rest_framework import serializers

class EventTypeSerializer(serializers.HyperlinkedModelSerializer):
	metadata = custom_fields.JSONField(source='metadata',required=False)
	
	class Meta:
		model = EventType
		fields = ('_id','name','metadata')

class HeatQuerySerializer(serializers.HyperlinkedModelSerializer):
	class Meta:
		model = HeatQuery
		fields = ('_id','name','query')

class MapModelSerializer(serializers.HyperlinkedModelSerializer):
	user = serializers.Field(source='user.username')
	group = serializers.Field(source='group.name')
	layout = custom_fields.JSONField(source='layout')
	tags = custom_fields.JSONField(source='tags',required=False)

	class Meta:
		model = MapModel
		fields = ('_id', 'name', 'user', 'group', 'layout', 'tags')

class MapModelListSerializer(serializers.HyperlinkedModelSerializer):
	user = serializers.Field(source='user.username')
	group = serializers.Field(source='group.name')
	tags = custom_fields.JSONField(source='tags',required=False)

	class Meta:
		model = MapModel
		fields = ('_id', 'name', 'user', 'group', 'tags')



class UserSerializer(serializers.HyperlinkedModelSerializer):
	mapmodels = serializers.PrimaryKeyRelatedField(many=True)

	class Meta:
		model = User
		fields = ('id', 'username', 'url', 'email', 'groups', 'mapmodels')

class GroupSerializer(serializers.HyperlinkedModelSerializer):
	mapmodels = serializers.PrimaryKeyRelatedField(many=True)

	class Meta:
		model = Group
		fields = ('url', 'name', 'mapmodels')
