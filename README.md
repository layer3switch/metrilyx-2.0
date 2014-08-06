Metrilyx v2.3.0
===============
Metrilyx is a web based dashboard engine to OpenTSDB, a time series database used to store large amounts of data.  It allows for analyzing, cross cutting and viewing of time series data in a simple manner.

#### Features:
- Easy to use UI for dashboard creation.
- Annotate various events.
- Multiple graph types: spline, area, stacked, pie, line.
- Data provided via websockets for low protocol overhead.
- Regex support for metric, tag key and tag value searches.
- Supports distributed and HA setup

#### Screenshots
##### Overview
![Alt text](metrilyx/static/imgs/readme/screenshot_1.png)
##### Page listing
![Alt text](metrilyx/static/imgs/readme/screenshot_2.png)
##### Edit Mode
![Alt text](metrilyx/static/imgs/readme/screenshot_3.png)

### Configuration
The configuration file is located at: **/opt/metrilyx/etc/metrilyx/metrilyx.conf**

#### /opt/metrilyx/etc/metrilyx/metrilyx.conf
A sample configuration file has been provided.  The configuration file is in JSON format.  
	
	{
		"dataprovider": {
			"name": "OpenTSDB",
			"uri": "http://<OpenTSDB host>",
			"query_endpoint": "/api/query",
			"search_endpoint": "/api/suggest",
			"loader_class": "opentsdb.OpenTSDBDataProvider"
		},
		"heatmaps": {
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
			"datastore": {
				"mongodb": {
					"host": ["127.0.0.1"],
			    	"port": 27017,
			    	"database": "metrilyx_cache", 
			    	"collection": "tsmeta_cache"
		    	}
	    	},
	    	"result_size": 50
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
This configuration option is only need if you plan to use heatmaps. If you choose to enable this feature the only needed change is the mongodb information relative to your setup i.e. **host**, **port**, and database

##### databases
The are 2 database configurations provided - sqlite and postgres.  The first one in the list will be the one used.  The default uses sqlite.  Postgresql can also be used.  To use postgres move that configuration option to the top of the list.  Using postgres requires the **psycopg2** python package.  All options are self explanatory.

##### cache
This is where the metric metadata cache settings can be changed.  The only configuration need is the correct mongodb settings.

###### interval
The interval at which to refresh the cache.  This is in minutes.

###### result_size
Maximum number of results to return.  Setting this value too high may cause performance issues.

##### annotations
In order to use annotations they need to be enabled in the config.  Create the index by issuing the following command:

	curl -XPOST http://<elasticsearch_host>:<port>/eventannotations

Certain mappings need to be added for each event type in elasticsearch.  Here's an example of an 'Alarm' mapping with a mapping configuration that has been provided (*etc/metrilyx/ess-mapping-alarm.conf*).

	curl -XPUT http://<ess_host>:<ess_port>/eventannotations/_mapping/Alarm -d @/opt/metrilyx/etc/metrilyx/ess-mapping-alarm.conf

You can easily add a new type by replacing 'Alarm' in the url as well as sample file with your desired name.

#### /opt/metrilyx/metrilyx/static/config.js
This is the client side configuration file. A sample for this configuration has also been provided.

##### AUTHCONFIG (optional)
This does not need to be changed.  This is a placeholder for a future feature to allow user authentication.

##### SERVER_NAME (required)
Client accessible FQDN of the server.  This is the address used by the client to make the websocket connection.  This usually is the hostname of the machine it's running on.  Not having this configured correctly will cause client connections will fail.  This is the only required option in this configuration file.

##### WS_URI (optional)
The websocket URI used by the client.  This is made up of the **SERVER_NAME** and connection options.  This does not need to be edited.


#### Nginx
The metrilyx nginx configuration is install at **/etc/nginx/conf.d/metrilyx.conf**.  The default nginx configuration may conflict with the metrilyx configuration and should be disabled. The name of the default file will be different depending on the operating system you are using.

	$ mv /etc/nginx/conf.d/default.conf{,.disabled}
	
Metrilyx can still function without these configuration changes but it is recommended these options be configured for scalability and performance.

	upstream dataprovider {
		server 127.0.0.1:9000
		#server 127.0.0.1:9001
		#server 127.0.0.1:9002
		#server 127.0.0.1:9003
	}

This configuration option should be edited to match the number of metrilyx-dataserver instances running.  Uncomment each line for a given instance with the corresponding port number.

### Heat Maps
Heatmaps are used to view your top 10 consumers for a given metric.  They are created similarly to pages.  The only subtly is the "pivot tag" which is the tag used to calculate the top 10.  This is usually the tag containing a value of '*'.

Heatmap jobs are stored in the application directory in 'heatmaps.json'.  The heatmap dashboards are stored in a directory called 'heatmaps' in the application directory.

In order to use heatmaps, you will need a mongodb server.  Heatmap computations are performed using celery (a python distributed processing framework) which uses mongodb for its backend.  For scalability more celery worker nodes can be added.  To install simply download the application on the node in question and run the install script.

#####Start the heatmap generator.  (only 1 instance of this should be running)
	/etc/init.d/celerybeatd start
	
#####Start the heatmap processor.  (these can run on as many nodes as you like)
	/etc/init.d/celeryd start


#### Importing models
You will need to import page models from v2.0 to v2.1 as 2.1 uses a database to store the models.  During the installation process, the installer backups the current installation with a timestamp.

You can import models from the UI but you may also import them via CLI.  You can issue the following command to import a json page model (i.e. graphmap).

	curl -u admin:metrilyx http://localhost/api/graphmaps -H "Content-Type:application/json" -d @<path/to/json/model>

The above will import a graphmap (i.e. page).  To import a heatmap you can use the following endpoint:

	curl -u admin:metrilyx http://localhost/api/heatmaps -H "Content-Type:application/json" -d @<path/to/heatmap/model>
	
To import all existing graphmaps from v2.0, issue the following commands:

	$ cd /opt/metrilyx-<timestamp>/pagemodels
	$ for i in $(ls);do curl -u admin:metrilyx http://localhost/api/graphmaps -H "Content-Type:application/json" -d @./$i; done
	
Similarly to import all existing heatmaps from v2.0, issue the following commands:

	$ cd /opt/metrilyx-<timestamp>/heatmaps
	$ for i in $(ls);do curl -u admin:metrilyx http://localhost/api/heatmaps -H "Content-Type:application/json" -d @./$i; done

#### Postgresql Client Install 
(only required if using postgres)

To install the client, first get postrgres's repo rpm.  Once that has been installed, you'll need to install the dependencies for the python postgres client (psycopg2).

	yum -y install postgresql93 postrgresql93-devel

You will also need to symlink the pg_config binary as it is not in the path by default.

	ln -s /usr/pgsql-9.3/bin/pg_config /usr/local/bin/pg_config

Finally install the python module i.e. psycopg2 

	pip install psycopg2

#### Notes
- The default username and password for the site are admin and metrilyx respectively. Changing these will cause the application to stop functioning as other configurations also need to be updated.
- If you would like to change the password, change to the application installation directory.  Remove the file called **metrilyx.sqlite3** and run **python manage.py syncdb**.  This should prompt you to create a new admin user.  Type 'yes', and follow the prompts to create a new username and password.  You will also need to update the config.js appropriately.
- Please be aware that although the project has a MIT license, the graphing library is under the creative commons license.