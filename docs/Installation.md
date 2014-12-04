Installation Guide
==================

Metrilyx will run on any system that supports the packages mentioned below.  It has primarily been tested on RedHat based flavors of Linux.

## Requirements:

**Before you can install Metrilyx, you will need to have the following pre-requisites installed**

Remove previously created temp files by pip. Depending on your platform one or both of the following directories willl need to be removed.

	rm -rf /tmp/pip_build_root
	rm -rf /tmp/pip-build-root

You will also need the following python packages:

	numpy>=1.6.1


This is to ensure that previous versions of existing packages do not interfere with the depenedencies.

*	**nginx**

	This is used as the proxy layer to the model manager as well as the websocket data server. Installer packages are available on their site. Here's a link to the page for linux:

		http://nginx.org/en/linux_packages.html#stable

*	**elasticsearch** (optional)

	This is used to store all event annotations.  This is where the data is queried from as well.  Installer packages are available on their site.
	In order to create the index issue the following command:

		curl -XPOST http://<elasticsearch_host>:<port>/eventannotations

	If you've changed the name of the index in the configuration, appropriately change the name in the command above.

*	**postgresql >= 9.3** (optional)

	This component is only needed if you plan to store your models in a database other than the default sqlite3.  Based on the number of models and usage a proper database may be needed.  Metrilyx has been tested using postgresql and is currently in use at TicketMaster.  In order to install postgres on a RHEL based system, the OS version must be >= 6.5.  MySQL has not been tried due to the lack of JSON support.  Installer packages for postgres are available on their site.


#### OS Packages:
Once the above requirements have been fulfilled, run the following command to install the required OS packages.

##### RHEL:

	$ yum -y install git gcc gcc-c++ gcc-gfortran atlas-devel openblas-devel libffi-devel libuuid uuid python-setuptools python-devel

##### Debian/Ubuntu:

	$ apt-get install libuuid1 uuid-runtime nginx python-setuptools python-dev libpython-dev make git-core libffi-dev

## Installation:
The provided install script will work with both **RedHat** and **Debian** based distributions.  You can issue the command below to install the application after the above mentioned requirements have been satisfied. The default install destination is **/opt/metrilyx**.

- Install the required OS packages.

- Issue the following command to install the application:

	$ which pip || easy_install pip

	$ pip install 'numpy>=1.6.1'

	$ pip install git+https://github.com/Ticketmaster/metrilyx-2.0.git

Assuming all required OS packages are installed, the script will install the needed python modules and configurations and prompt you to edit the metrilyx configuration files.

After you have completed editing the configuration file, start the modelmanager and dataserver processes, then restart nginx.  Also start celeryd and celerybeat which consume and run periodic jobs repsectively.

	$ /etc/init.d/metrilyx start
	$ /etc/init.d/nginx restart


**Note**: The default nginx configuration file may conflict with the metrilyx one.  In this case you'll need to disable the default one or edit the configuration file to accomodate for metrilyx's nginx configuration.

#### Postgresql Install
If you would like to use postgres for the backend database instead of the default sqlite, you can do so by moving the provided postgres database configuration above the sqlite one in ***metrilyx.conf***.  Fill in the remainder options based on your postgresql instance.

###### ***Before performing the next step please export all of your existing models.***

You will also need to create the appropriate schemas in postgres and re-initialize django.

To initialize django for postgres, issue the command below.  If you get prompted to create a superuser, use the following credentials **admin/metrilyx**.  Setting them to anything else will cause the application to fail.  This is due to the fact that authentication has not been fully integrated and disabled in metrilyx.

	$ cd /opt/metrilyx
	$ python manage.py syncdb
	$ python manage.py createinitialrevisions

If you have existing models in sqlite follow the instructions to export/import them.

#### Postgresql Client Install
(only required if using postgres)

To install the client, first get postrgres's yum repo rpm.  Once that has been installed, you'll need to install the dependencies for the python postgres client (psycopg2).

	yum -y install postgresql93 postrgresql93-devel libpqxx-devel python-psycopg2


#### Upgrading models
Once the database has been upgraded you will need to upgrade the models.  To do this run the following commands:

	$ cd /opt/metrilyx
	$ ./bin/mdlmgr.py

The second command won't actually upgrade the model but give you an idea of what will change along with any errors.  If everything checks out run the same command with the --commit option like so:

	$ ./bin/mdlmgr.py --commit

You can now start the metrilyx services.
