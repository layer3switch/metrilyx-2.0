
import os

from django.conf.urls import patterns, include, url
from django.conf.urls.static import static

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

from rest_framework import routers
from metrilyx import apiviews


urlpatterns = patterns('',
    # url(r'^$', apiviews.index),
    # (api/)* is to allow apache to point to /api and work from CLI
    # as well as from a webserver
	url(r'^(api/)*schemas/(?P<model_type>(metric|graph|pod|page))$', apiviews.SchemaView.as_view()),
	url(r'^(api/)*page(/(?P<page_id>.*)|/*)$', apiviews.PageView.as_view()),
    url(r'^(api/)*graph/*$', apiviews.GraphView.as_view()),
    url(r'^(api/)*search.*$', apiviews.SearchView.as_view()),
    # Examples:
    # url(r'^$', 'MetrilyxServer.views.home', name='home'),
    # url(r'^MetrilyxServer/', include('MetrilyxServer.foo.urls')),
    #url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    url(r'^admin/', include(admin.site.urls)),
    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),
    # Uncomment the next line to enable the admin:
)
urlpatterns += static('/', document_root=os.path.join(os.path.dirname(__file__), 'static'))    
