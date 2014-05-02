
import os

from django.conf.urls import patterns, include, url
from django.conf.urls.static import static

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

from rest_framework import routers
from metrilyxconfig import config
from metrilyx import apiviews

router = routers.SimpleRouter(trailing_slash=False)
router.register(r'api/users', apiviews.UserViewSet)
router.register(r'api/groups', apiviews.GroupViewSet)
router.register(r'api/schemas', apiviews.SchemaViewSet, base_name="schemas")
router.register(r'api/graphmaps', apiviews.GraphMapViewSet)
router.register(r'api/heatmaps', apiviews.HeatMapViewSet)

urlpatterns = patterns('',
    # url(r'^$', apiviews.index),
    # (api/)* is to allow apache to point to /api and work from CLI
    # as well as from a webserver
    url(r'^', include(router.urls)),
	#url(r'^(api/)*schema/(?P<model_type>(metric|graph|pod|page|heatmap))$', apiviews.SchemaView.as_view()),
	url(r'^(api/)*page(/(?P<page_id>.*)|/*)$', apiviews.PageView.as_view()),
    #url(r'^(api/)*heatmap(/(?P<page_id>.*)|/*)$', apiviews.HeatmapView.as_view()),
    url(r'^(api/)*graph(/(?P<graph_query>.*)|/*)$', apiviews.GraphView.as_view()),
    url(r'^(api/)*heat(/(?P<heat_id>.*)|/*)$', apiviews.HeatView.as_view()),
    url(r'^(api/)*search.*$', apiviews.SearchView.as_view()),
    # Examples:
    # url(r'^$', 'MetrilyxServer.views.home', name='home'),
    # url(r'^MetrilyxServer/', include('MetrilyxServer.foo.urls')),
    url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    url(r'^admin/?', include(admin.site.urls)),
    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),
    # Uncomment the next line to enable the admin:
)
urlpatterns += static('/', document_root=os.path.join(os.path.dirname(__file__), 'static'))    
