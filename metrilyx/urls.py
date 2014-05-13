
import os

from django.conf import settings
from django.conf.urls import patterns, include, url
from django.conf.urls.static import static

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

from rest_framework import routers
from metrilyxconfig import config
from metrilyx import apiviews

router = routers.SimpleRouter(trailing_slash=False)
router.register(r'(api/)?users', apiviews.UserViewSet)
router.register(r'(api/)?groups', apiviews.GroupViewSet)
router.register(r'(api/)?graphmaps', apiviews.GraphMapViewSet)
router.register(r'(api/)?heatmaps', apiviews.HeatMapViewSet)
router.register(r'(api/)?schemas', apiviews.SchemaViewSet, base_name="schemas")
router.register(r'(api/)?search', apiviews.SearchViewSet, base_name="search")
router.register(r'(api/)?tags', apiviews.TagViewSet, base_name="tags")

urlpatterns = patterns('',
	# url(r'^$', apiviews.index),
	# (api/)* is to allow apache to point to /api and work from CLI
	# as well as from a webserver
	url(r'^', include(router.urls)),
	#url(r'^(api/)?graph(/(?P<graph_query>.*)|/*)$', apiviews.GraphView.as_view()),
	url(r'^(api/)?heat(/(?P<heat_id>.*)|/*)$', apiviews.HeatView.as_view()),
	url(r'^(api/)?api-auth/', include('rest_framework.urls', namespace='rest_framework')),
	url(r'^(api/)?admin/?', include(admin.site.urls)),
)
if config['debug']:
	urlpatterns += static('/', 
			document_root=os.path.join(os.path.dirname(__file__), 'static'))   
