
from django.contrib import admin
from metrilyx.models import MapModel, HeatQuery

from reversion.admin import VersionAdmin

class MapModelAdmin(VersionAdmin):
	list_display = ['_id', 'name', 'model_type', 'user', 'group', 'tags']
	search_fields = ['_id', 'name', 'user', 'group', 'tags']
	readonly_fields = ('model_type',)
	
class HeatQueryAdmin(VersionAdmin):
	list_display = ['_id', 'name', 'query']
	search_fields = ['_id', 'name', 'query']

admin.site.register(MapModel, MapModelAdmin)
admin.site.register(HeatQuery, HeatQueryAdmin)