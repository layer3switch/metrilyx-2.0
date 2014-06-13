
from django.contrib import admin
from metrilyx.models import *

from reversion.admin import VersionAdmin

class MapModelAdmin(VersionAdmin):
	list_display = ['_id', 'name', 'model_type', 'user', 'group', 'tags']
	search_fields = ['_id', 'name', 'user', 'group', 'tags']
	readonly_fields = ('model_type',)
	
class HeatQueryAdmin(VersionAdmin):
	list_display = ['_id', 'name', 'query']
	search_fields = ['_id', 'name', 'query']

class EventTypeAdmin(VersionAdmin):
	list_display = ['name', '_id', 'metadata']
	search_fields = ['_id', 'name', 'metadata']
	exclude = ('_id',)

admin.site.register(MapModel, MapModelAdmin)
admin.site.register(HeatQuery, HeatQueryAdmin)
admin.site.register(EventType, EventTypeAdmin)