Metrilyx v2.1.0
===============
Metrilyx is a web based dashboard engine  to OpenTSDB, a time series database used to store large amounts of data.  It allows for analyzing, cross cutting and viewing of time series data in a simple manner.

#### Overview
![Alt text](metrilyx/static/imgs/readme/screenshot_1.png)
#### Page listing
![Alt text](metrilyx/static/imgs/readme/screenshot_2.png)
#### Edit Mode
![Alt text](metrilyx/static/imgs/readme/screenshot_3.png)
 
### Requirements
Metrilyx will run on any system that supports the packages below.  It has primarily been tested on RedHat based flavors of Linux.

#### OS Packages:
##### RHEL:
	libuuid
	uuid
	httpd
	mod_wsgi
	python-setuptools
	python-devel
	gcc
	
##### Debian:
	libuuid1 
	uuid-runtime 
	apache2-mpm-worker 
	libapache2-mod-wsgi 
	make 
	python-setuptools

#### Python Packages:
	uuid
	django
	djangorestframework
	django-filter
	django-cors-headers
	django-reversion
	celery
	requests
	jsonfield

### Installation
The provided install script will work with both **RedHat** and **Debian** based distributions.  You can issue the command below, to auto-install the complete application including dependencies. The default install destination is **/opt/metrilyx**.	
	
	[</path/to/downloaded/app>]$./install.sh
	

This will install all required OS packages as well as python packages and apache configs.

For **other distributions**, follow the instructions below:

	- Install the required OS packages based on your OS's package manager.
	
	- Install all required python modules as mentioned above.
	
	- Copy etc/httpd/conf.d/metrilyx.conf to your webservers config directory. Usually /etc/httpd/conf.d/ for **RedHat** and /etc/apache2/sites-available/ for **Debian** based distributions.
	
	- Set the permissions to /opt/metrilyx to the appropriate web server user.   

	- Edit the configuration (more below).

	- Restart the webserver.

### Configuration
The default installation directory is /opt/metrilyx (i.e %{metrilyx_home}).

##### Path 
%{metrilyx_home}/etc/metrilyx/metrilyx.conf

A sample config file is provided.  The configuration file is in JSON format.  To begin you can copy the sample config to the path mentioned above and fill in the uri and port.
	
	{
		"tsdb": {
			"uri":"tsdb.example.com",
			"port": 80,
			"suggest_limit": 100
		},
		"model_path": <absolute path to models directory>,
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
		}
	}
	
##### tsdb.uri
OpenTSDB http host

##### tsdb.port
OpenTSDB http port (default: 4242)

##### tsdb.suggest_limit
OpenTSDB suggest max result limit. 

##### model_path
Path to directory where JSON page models (i.e. dashboards) will be stored.  Optional (default: /opt/metrilyx/pagemodels)

After you've installed and configured metrilyx, click on the "tutorials" link towards the bottom-center of the page for a general overview and basic tutorial on how to get started.

##### heatmaps
This configuration option is only need if you plan to use heatmaps. If you choose to enable this feature the only needed change is the mongodb information relative to your setup.


### Heat Maps
Heatmaps are used to view your top 10 consumers for a given metric.  They are created similarly to pages.  The only subtly is the "pivot tag" which is the tag used to calculate the top 10.  This is usually the tag containing a value of '*'.

Heatmap jobs are stored in the application directory in 'heatmaps.json'.  The heatmap dashboards are stored in a directory called 'heatmaps' in the application directory.

In order to use heatmaps, you will need a mongodb server.  Heatmap computations are performed using celery (a python distributed processing framework) which uses mongodb for its backend.  For scalability more celery worker nodes can be added.  To install simply download the application on the node in question and run the install script.

#####Start the heatmap generator.  (only 1 instance of this should be running)
	/etc/init.d/celerybeatd start
	
#####Start the heatmap processor.  (these can run on as many nodes as you like)
	/etc/init.d/celeryd start


#### Notes
- The default username and password for the site are admin and password respectively. These should almost never be required and are specifically needed by the REST interface.
- If you would like to change the password, change to the application installation directory.  Remove the file called **metrilyx.sqlite3** and run **python manage.py syncdb**.  This should prompt you to create a new admin user.  Type 'yes', and follow the prompts to create a new username and password.
- Please be aware that although the project has a MIT license, the graphing library is under the creative commons license.