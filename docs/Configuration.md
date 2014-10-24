Configuration
=============
Metrilyx configuration file is located at: /opt/metrilyx/etc/metrilyx/metrilyx.conf

#### /opt/metrilyx/etc/metrilyx/metrilyx.conf
A sample configuration file has been provided.  The configuration file is in JSON format.

	{
		"dataprovider": {
			"name": "OpenTSDB",
			"uri": "http://<OpenTSDB host>",
			"port": 4242,
			"suggest_limit": 50,
			"query_endpoint": "/api/query",
			"search_endpoint": "/api/suggest",
			"loader_class": "opentsdb.OpenTSDBDataProvider",
			"suggest_limit": 50
		},
		"websocket": {
			"endpoint": "/api/data"
		},
		"cache": {
			"enabled": false,
			"interval": 180,
			"result_size": 50,
			"datasource": {
				"url": "http://localhost:8989"
			}
		},
		"databases":[
			{
				"ENGINE": "django.db.backends.sqlite3",
				"NAME": "/opt/metrilyx/data/metrilyx.sqlite3"
			},{
				"ENGINE": "django.db.backends.postgresql_psycopg2",
				"NAME": "metrilyx",
				"HOST": "127.0.0.1",
				"PORT": "5432",
				"USER": "metuser",
				"PASSWORD": "metpass"
			}
		],
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
		"tmpdir": "/dev/shm/metrilyx",
		"debug": false,
		"schema_path": "/opt/metrilyx/etc/metrilyx/schemas"
	}

##### dataprovider.uri
OpenTSDB http host

##### dataprovider.port
OpenTSDB http port (default: 4242)

##### dataprovider.suggest_limit
OpenTSDB suggest max result limit.

##### websocket.hostname (optional)
This configuration option only needs to be edited if the host does not have a resolvable FQDN..  Add a hostname key under the websocket section called 'hostname' with a client resolvable name.

##### websocket.port (optional)
This options is only needed if directly connecting with the websocket. For example: in development mode

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
