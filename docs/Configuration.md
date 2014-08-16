Configuration
=============
Metrilyx contains 2 configuration files

- /opt/metrilyx/etc/metrilyx/metrilyx.conf
This is the main configuration file.  

- /opt/metrilyx/metrilyx/static/config.js
This configuration file is used by the clients i.e. the UI

#### /opt/metrilyx/etc/metrilyx/metrilyx.conf
A sample configuration file has been provided.  The configuration file is in JSON format.  
	
	{
		"dataprovider": {
			"name": "OpenTSDB",
			"uri": "http://<OpenTSDB host>",
			"port": 4242,
			"query_endpoint": "/api/query",
			"search_endpoint": "/api/suggest",
			"loader_class": "opentsdb.OpenTSDBDataProvider",
			"suggest_limit": 50
		},
		"heatmaps": {
			"enabled": false,
			"analysis_interval": "1m-ago",
			"transport": "mongodb",
			"broker": {
		    	"host": ["127.0.0.1"],
		    	"port": 27017,
		    	"database": "jobs", 
		    	"taskmeta_collection": "taskmeta_collection"
			}
		},
		"cache": {
			"interval": 5,
			"retention_period": 12,
			"datastore": {
				"mongodb": {
					"host": ["127.0.0.1"],
			    	"port": 27017,
			    	"database": "metrilyx_cache", 
			    	"collection": "tsmeta_cache"
		    	}
	    	},
	    	"result_size": 50,
	    	"enabled": false
		},
		"databases":[
			{
				"ENGINE": "django.db.backends.sqlite3",
	        	"NAME": "/opt/metrilyx/metrilyx.sqlite3"
			},{
				"ENGINE": "django.db.backends.postgresql_psycopg2",
				"NAME": "metrilyx",
				"HOST": "127.0.0.1",
				"PORT": "5432",
				"USER": "metuser",
				"PASSWORD": "metpass"
			}
		],
		"celery": {
			"tasks": [
				"metrilyx.celerytasks"
			]
		},
		"annotations": {
			"enabled": false,
			"line_re": "([0-9]+) (.+) ([a-zA-Z0-9_]+):(.+) '({.*})'",
			"dataprovider":{
				"name": "Elasticsearch",
				"host": "localhost",
				"port": 9200,
				"use_ssl": false,
				"search_endpoint": "_search",
				"index": "eventannotations",
				"result_size": 10000000,
				"loader_class": "ess.ElasticsearchEventDataProvider"
			}
		},
		"debug": false
	}
	
##### tsdb.uri
OpenTSDB http host

##### tsdb.port
OpenTSDB http port (default: 4242)

##### tsdb.suggest_limit
OpenTSDB suggest max result limit. 

##### heatmaps
This configuration option is only needed if you plan to use heatmaps.  If you choose to enable this feature the only needed change is the mongodb information relative to your setup i.e. **host**, **port**, and database

##### databases
The are 2 database configurations provided - sqlite and postgres.  The first one in the list will be the one used.  The default uses sqlite.  Postgresql can also be used.  To use postgres move that configuration option to the top of the list.  Using postgres requires the **psycopg2** python package.  All options are self explanatory.  MySQL can also be used but has not been tested as of writing this.

##### cache
This is where the metric metadata cache settings can be changed.  The only configuration needed is the correct mongodb settings.

###### interval
The interval at which to refresh the cache.  This is in minutes.

###### result_size
Maximum number of results to return.  Setting this value too high may cause performance issues.

##### annotations
In order to use annotations they need to be enabled in the config.  Once enabled, change the parameters per your environment.  The only required fields are **host** and **port**.  

Now you will need to create the index in elasticsearch.  Create the index by issuing the following command:

	curl -XPOST http://<elasticsearch_host>:<port>/eventannotations

Certain mappings need to be added for each event type in elasticsearch.  Here's an example of an 'Alarm' mapping using a mapping configuration provided (*etc/metrilyx/ess-mapping-alarm.conf*).

	curl -XPUT http://<ess_host>:<ess_port>/eventannotations/_mapping/Alarm -d @/opt/metrilyx/etc/metrilyx/ess-mapping-alarm.conf

These need to be added for every event type created.  You can easily add a new type by replacing 'Alarm' in the url as well as sample file with your desired type name.

#### /opt/metrilyx/metrilyx/static/config.js
This is the client side configuration file. A sample for this configuration has also been provided.

##### SERVER_NAME (required)
Client accessible FQDN of the server.  This is the address used by the client to make the websocket connection.  This usually is the hostname of the machine it's running on.  Not having this configured correctly will cause client connections will fail.  This is the only required option in this configuration file.

##### AUTHCONFIG (optional)
This does not need to be changed.  This is a placeholder for a future feature to allow user authentication.  This should not be edited unless you know what you are doing.

##### WS_URI (optional)
The websocket URI used by the client.  This is made up of the **SERVER_NAME** and connection options.  This should not be edited unless you know what you are doing.


#### Nginx
The metrilyx nginx configuration is installed under **/etc/nginx/conf.d/metrilyx.conf**.  The default nginx configuration may conflict with the metrilyx configuration and should be disabled. The name of the default file will be different depending on the operating system you are using.  Here's an example from a CentOS/RHEL based system.

	$ mv /etc/nginx/conf.d/default.conf{,.disabled}
	
You can also edit the default configuration file to work with the one provided with metrilyx but that is beyod the scope of this document.

Optimization configuration changes also should be made.  Metrilyx can still function without these configuration changes but it is recommended these options be configured for scalability and performance.

	upstream dataprovider {
		server 127.0.0.1:9000
		#server 127.0.0.1:9001
		#server 127.0.0.1:9002
		#server 127.0.0.1:9003
	}

This configuration option should be edited to match the number of metrilyx-dataserver instances running.  This defaults to the number of cores/processors you have onboard.  Uncomment each line for a given instance with the corresponding port number.
