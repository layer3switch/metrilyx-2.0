Metrilyx v2.1.0
===============
Metrilyx is a web based dashboard engine  to OpenTSDB, a time series database used to store large amounts of data.  It allows for analyzing, cross cutting and viewing of time series data in a simple manner.

#### Features:
- Page Models now stored in a database rather than flat files.
- Ability to group pages based on tags.
- Ability to generate heatmaps against a metric.
- Ability to import and export pages.
- Updated graphing library to Highstock 2.0.1
- Improved the ability to move pods around on a page.
- Various performance improvements and bug fixes.

#### Screenshots
##### Adhoc Graphs
![Alt text](metrilyx/static/imgs/readme/screenshot_1.png)
##### Dashboards
![Alt text](metrilyx/static/imgs/readme/screenshot_2.png)
##### Edit Mode
![Alt text](metrilyx/static/imgs/readme/screenshot_3.png)
 
### Requirements
Metrilyx will run on any system that supports the packages mentioned below.  It has primarily been tested on RedHat based flavors of Linux.

### OS Packages:
#### RHEL:
	libuuid
	uuid
	httpd
	mod_wsgi
	python-setuptools
	python-devel
	gcc
	
#### Debian:
	libuuid1 
	uuid-runtime 
	apache2-mpm-worker 
	libapache2-mod-wsgi 
	make 
	python-setuptools

### Python Packages:
	uuid
	django
	djangorestframework
	django-filter
	django-cors-headers
	django-reversion
	celery
	requests
	jsonfield

In order to use heatmaps you will also need a mongodb server.


### Installation
The provided install script will work with both **RedHat** and **Debian** based distributions.  You can issue the command below to install the application after the above mentioned requirements have been satisfied. The default install destination is **/opt/metrilyx**.	

- Install the required OS packages based on your OS's package manager.
- Issue the following command to install the application:
	
	[ /path/to/downloaded/app ]$ **./install.sh app**

- Assuming all required OS packages are present, the script will install the required python modules, apache configs (based on distribution) and prompt you to edit the configuration file.
- After you have completed editing the configuration file restart Apache.

### Configuration
The default installation directory is /opt/metrilyx (i.e %{metrilyx_home}).

##### Path 
%{metrilyx_home}/etc/metrilyx/metrilyx.conf

A sample configuration file has been provided.  The configuration file is in JSON format.  
	
	{
		"tsdb": {
			"uri":"tsdb.example.com",
			"port": 4242,
			"suggest_limit": 100
		}
		"databases":{
			"default": {
				"ENGINE": "django.db.backends.sqlite3",
            	"NAME": "metrilyx.sqlite3"
			}
		},
		"heatmaps": {
			"analysis_interval": "1m-ago",
			"transport": "mongodb",
			"broker": {
		    	"host": "127.0.0.1",
		    	"port": 27017,
		    	"database": "jobs", 
		    	"taskmeta_collection": "clry_taskmeta_collection"
			}
		},
		"celery": {
			"tasks": [
				"metrilyx.heatmap_tasks"
			]
		},
		"debug": false
	}
	
##### tsdb.uri
OpenTSDB http host

##### tsdb.port
OpenTSDB port

##### tsdb.suggest_limit
OpenTSDB suggest max result limit. 

##### heatmaps
This configuration option is only need if you plan to use heatmaps. If you choose to enable this feature the only needed change is the mongodb information relative to your setup i.e. host, port, and database

##### databases
The default installation uses sqlite.  Other databases can also be used.  We have testing and run a setup using postgresql.  This requires a seperate set of tasks that will be included later.

### Heat Maps
Heatmaps are used to view your top 10 consumers for a given metric.  They are created similarly to pages.  The only subtly is the "pivot tag" which is the tag used to calculate the top 10.  This is usually the tag containing a value of '*'.

Heatmap jobs are stored in the application directory in 'heatmaps.json'.  The heatmap dashboards are stored in a directory called 'heatmaps' in the application directory.

In order to use heatmaps, you will need a mongodb server.  Heatmap computations are performed using celery (a python distributed processing framework) which uses mongodb for its backend.  For scalability more celery worker nodes can be added.  To install simply download the application on the node in question and run the install script.

#####Start the heatmap generator.  (only 1 instance of this should be running)
	/etc/init.d/celerybeatd start
	
#####Start the heatmap processor.  (these can run on as many nodes as you like)
	/etc/init.d/celeryd start


#### Importing models
You will need to import page models from v2.0 to v2.1 as 2.1 now uses a database to store the models.  During the installation process, the installer backups the current installation with a timestamp.

You can import models from the UI but you may also import them via CLI.  You can issue the following command to import a json page model (i.e. graphmap).

	curl -u admin:metrilyx http://localhost/api/graphmaps -H "Content-Type:application/json" -d @<path/to/json/model>

This will import a graphmap (i.e. page).  To import a heatmap you can use the following endpoint:

	curl -u admin:metrilyx http://localhost/api/heatmaps -H "Content-Type:application/json" -d @<path/to/heatmap/model>
	
To import all existing graphmaps from v2.0, issue the following commands:

	cd /opt/metrilyx-<timestamp>/pagemodels
	for i in $(ls);do curl -u admin:metrilyx http://localhost/api/graphmaps -H "Content-Type:application/json" -d @./$i; done
	
Similarly to import all existing heatmaps from v2.0, issue the following commands:

	cd /opt/metrilyx-<timestamp>/heatmaps
	for i in $(ls);do curl -u admin:metrilyx http://localhost/api/heatmaps -H "Content-Type:application/json" -d @./$i; done

#### Notes
- The default username and password for the site are admin and metrilyx respectively. Changing these will cause the application to stop functioning as other configurations also need to be updated.
- If you would like to change the password, change to the application installation directory.  Remove the file called **metrilyx.sqlite3** and run **python manage.py syncdb**.  This should prompt you to create a new admin user.  Type 'yes', and follow the prompts to create a new username and password.  You will also need to update the config.js appropriately.
- Please be aware that although the project has a MIT license, the graphing library is under the creative commons license.
