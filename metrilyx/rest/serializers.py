from django.contrib.auth.models import User, Group

from ..models import *
import customfields

from rest_framework import serializers

class EventTypeSerializer(serializers.HyperlinkedModelSerializer):
	metadata = customfields.JSONField(source='metadata',required=False)
	
	class Meta:
		model = EventType
		fields = ('_id','name','metadata')

class MapModelSerializer(serializers.HyperlinkedModelSerializer):
	user = serializers.Field(source='user.username')
	group = serializers.Field(source='group.name')
	layout = customfields.JSONField(source='layout')
	tags = customfields.JSONField(source='tags',required=False)

	class Meta:
		model = MapModel
		fields = ('_id', 'name', 'user', 'group', 'layout', 'tags')

class MapModelListSerializer(serializers.HyperlinkedModelSerializer):
	user = serializers.Field(source='user.username')
	group = serializers.Field(source='group.name')
	tags = customfields.JSONField(source='tags',required=False)

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
