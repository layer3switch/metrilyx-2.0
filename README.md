metrilyx-2.0
============
Metrilyx is a web based dashboard engine  to OpenTSDB, a time series database used to store large amounts of data.  It allows for analyzing, cross cutting and viewing of time series data in a simple manner.
 
### Requirements
Metrilyx will run on any system that supports the packages below.  It has primarily been tested on RedHat based flavors of Linux.

##### OS Packages:
	libuuid
	uuid
	httpd
	mod_wsgi
	

##### Python Packages:
	Django
	django-filter
	Markdown
	djangorestframework
	uuid

### Installation
The provided makefile will work with **RedHat** based distributions.  You can issue the command below, to auto-install the complete package including dependencies. The default install path is **/opt/metrilyx**.	
	
	[</path/to/app>]$ bash install.sh
	

This will install all required OS packages as well as python packages and restart apache.  

For **other distributions**, follow the instructions below:

	- Install the required OS packages based on your OS's package manager.
	
	- [</path/to/app>]$ make pydeps
	
	- Copy etc/httpd/conf.d/metrilyx.conf to your webservers config directory.
	
	- Set the permissions to /opt/metrilyx to the appropriate web user 

	- Edit the configuration (more below).

	- Restart the webserver.

### Configuration
The default username and password for the site is admin and password respectively.  This is specifically needed by the rest api and to create the appropriate internal state.


##### Path 
%{metrilyx_home}/etc/metrilyx/metrilyx.conf

A sample config file is provided in the same directory above.  The configuration file is in JSON format.  To begin you can copy the sample config to the path mentioned above and fill in the uri and port.
	
	{
		"tsdb": {
			"uri":"tsdb.example.com",
			"port": 80
		},
		"model_path": <absolute path to models directory>
	}
	
##### tsdb.uri
OpenTSDB http host

##### tsdb.port
OpenTSDB http Port (default: 80)

##### model_path
Path to directory where JSON page models (i.e. dashboards) will be stored.  Optional (default: %{home}/pagemodels)