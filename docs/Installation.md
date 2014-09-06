Installation Guide
==================

Metrilyx will run on any system that supports the packages mentioned below.  It has primarily been tested on RedHat based flavors of Linux.


## Pre-requisites:

**Before you can install Metrilyx, you will need to have the following pre-requisites installed**

*	**nginx**

	This is used as the proxy layer to the model manager as well as the websocket data server. Installer packages are available on their site. Here's a link to the page for linux: 

		http://nginx.org/en/linux_packages.html#stable

*	**elasticsearch** (optional)

	This is used to store all event annotations.  This is where the data is queried from as well.  Installer packages are available on their site.
	In order to create the index issue the following command:

		curl -XPOST http://<elasticsearch_host>:<port>/eventannotations

	If you've changed the name of the index in the configuration, appropriately change the name in the command above.

*	**mongodb**

	This component is used by heatmaps as well as for the metric metadata caching.  It powers metric, tagkey and tagvalue searchs.  Installer packages are available on their site.
	
*	**postgresql >= 9.3** (optional)

	This component is only needed if you plan to store your models in a database other than the default sqlite3.  Based on the number of models and usage a proper database may be needed.  Metrilyx has been tested using postgresql and is currently in use at TicketMaster.  In order to install postgres on a RHEL based system, the OS version must be >= 6.5.  MySQL has not been tried due to the lack of JSON support.  Installer packages for postgres are available on their site.
	

#### OS Packages:
Once the above requirements have been fulfilled, run the following command to install the required OS packages.

##### RHEL:

	$ yum -y install libuuid uuid python-setuptools python-devel gcc git
	
##### Debian:

	$ apt-get install libuuid1 uuid-runtime nginx python-setuptools python-dev libpython-dev make git-core

#### Python Packages:
Altough the package versions should not be a concern, they been provided for convenience.

	uuid 					>= 1.30
	pymongo 				>= 2.7
	django 					>= 1.6
	djangorestframework		>= 2.3.13
	django-filter 			>= 0.7
	django-cors-headers 	>= 0.12
	django-reversion 		>= 1.8.0
	django-jsonfield 		>= 0.9.20
	celery 					>= 3.1.11
	requests 				>= 2.2.1
	twisted 				>= 14.0.0
	uwsgi 					>=2.0.4
	autobahn 				>= 0.8.8
	elasticsearch 			>= 1.0.0
	
###### Troubleshooting
Installing autobahn throws an error if **six** hasn't been install beforehand or is not the correct version.  To correct this, uninstall six and autobahn and re-install both as follows:

	$ pip uninstall autobahn -y
	$ pip uninstall six -y
	$ pip install six
	$ pip install autobahn

## Installation:
The provided install script will work with both **RedHat** and **Debian** based distributions.  You can issue the command below to install the application after the above mentioned requirements have been satisfied. The default install destination is **/opt/metrilyx**.	

- Install the required OS packages.

- Issue the following command to install the application:
	
		$ git clone https://github.com/Ticketmaster/metrilyx-2.0.git
	
		$ cd metrilyx-2.0
	
		$ ./install.sh app

Assuming all required OS packages are installed, the script will install the needed python modules and configurations and prompt you to edit the metrilyx configuration files.

After you have completed editing the configuration file, start the modelmanager and dataserver processes, then restart nginx.  Also start celeryd and celerybeat which consume and run periodic jobs repsectively.
	
	$ /etc/init.d/metrilyx-dataserver start
	$ /etc/init.d/metrilyx-modelmanager start
	$ /etc/init.d/nginx restart
	$ /etc/init.d/celeryd start
	$ /etc/init.d/celerybeat start
	

**Note**: The default nginx configuration file may conflict with the metrilyx one.  In this case you'll need to disable the default one or edit the configuration file to accomodate for metrilyx's nginx configuration.

### Heat Maps
Heatmaps are used to view your top 10 consumers for a given metric.  They are created similarly to pages.  The only subtly is the "pivot tag" which is the tag used to calculate the top 10.  This is usually the tag containing a value of '*'.

In order to use heatmaps, you will need a mongodb server.  Heatmap computations are performed using celery (a python distributed processing framework) which uses mongodb for its backend.  For scalability more celery worker nodes can be added.

#### Postgresql Install
If you would like to use postgres for the backend database instead of the default sqlite, you can do so by moving the provided postgres database configuration above the sqlite one in ***metrilyx.conf***.  Fill in the remainder options based on your postgresql instance.

###### ***Before performing the next step please export all of your existing models.***

You will also need to create the appropriate schemas in postgres and re-initialize django.  

To initialize django for postgres, issue the command below.  If you get prompted to create a superuser, use the following credentials **admin/metrilyx**.  Setting them to anything else will cause the application to fail.  This is due to the fact that authentication has not been fully integrated and disabled in metrilyx.

	$ cd /opt/metrilyx && ./install.sh init_django

If you have existing models in sqlite follow the instructions to export/import them.

#### Postgresql Client Install 
(only required if using postgres)

To install the client, first get postrgres's yum repo rpm.  Once that has been installed, you'll need to install the dependencies for the python postgres client (psycopg2).

	yum -y install postgresql93 postrgresql93-devel libpqxx-devel

You will also need to symlink the pg_config binary as it is not in the path by default.

	ln -s /usr/pgsql-9.3/bin/pg_config /usr/local/bin/pg_config

Finally install the python module i.e. psycopg2 

	pip install psycopg2

## Upgrade
Upgrades are extactly similar to the install process with a couple of extra steps.  During the install process, the application directory gets copied with the current date and time keeping an existing state of your application.  After the install process has been completed you will need to perform the following steps to bring your existing models into the new installation.

##### sqlite
You can simply copy the sqlite db file from the previous installation into the current one.

##### Postgresql/MySQL
No additional steps are required.

#### Upgrading configuration
As new configuration options may be added and removed a script has been provided to check and update your configuration.  To generate a new configuration file based on your existing one, issue the following command:

	$ cd /opt/metrilyx
	$ ./bin/cfgmgr.py -i etc/metrilyx/metrilyx.conf -n

This will display the new configuration.  To write it out, exclude the **-n** option.  This will create a file in the current directory called **metrilyx.conf.new**.  Check the file to make sure your options look correct and then replace your current config.

The commands below will backup the existing config and copy in the new one.

	$ cd /opt/metrilyx
	$ cp etc/metrilyx/metrilyx.conf{,.backup}
	$ cp metrilyx.conf.new etc/metrilyx/metrilyx.conf

#### Upgrading models
Once you have the data in the database you will need to upgrade the model schema of each model.  To do this run the following commands:

	$ cd /opt/metrilyx
	$ ./bin/mdlmgr.py

The second command won't actually upgrade the model but give you an idea of what will change along with any errors.  If everything checks out run the same command with the --commit options like so:

	$ ./bin/mdlmgr.py --commit

Thats it.

