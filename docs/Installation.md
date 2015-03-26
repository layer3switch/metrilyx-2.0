Installation Guide
==================

Metrilyx will run on any system that supports the packages mentioned below.  It has primarily been tested on RedHat based flavors of Linux.

Requirements
============

The compiler requirements are needed specifically by numpy and pandas for computation and analysis.

- RHEL, CentOS, Oracle distributions (test w/ CentOS/Oracle 6.5)::

	## Install OS packages
	$ yum -y install git gcc gcc-c++ gcc-gfortran atlas-devel blas-devel libffi libffi-devel libuuid uuid python-setuptools python-devel nginx

	## Install pip
	$ which pip || easy_install pip

	## Install numpy before installing metrilyx
	$ pip install 'numpy>=1.6.1'


- Debian based distributions (tested w/ Ubuntu 14.04 & 12.04)::

	## Install OS packages
	$ apt-get install build-essential make g++ gfortran libuuid1 uuid-runtime python-setuptools python-dev libpython2.7 python-pip git-core libffi-dev libatlas-dev libblas-dev python-numpy ngnix


Installation
============

Finally install metrilyx::

	$ pip install git+https://github.com/Ticketmaster/metrilyx-2.0.git

Assuming all required OS packages are installed, the script will install the needed python modules and configurations and prompt you to edit the metrilyx configuration files.

After you have completed editing the configuration file, start the modelmanager and dataserver processes, then restart nginx.  Also start celeryd and celerybeat which consume and run periodic jobs repsectively.

	$ /etc/init.d/metrilyx start
	$ /etc/init.d/nginx restart


**Note**: The default nginx configuration file may conflict with the metrilyx one.  In this case you'll need to disable the default one or edit the configuration file to accomodate for metrilyx's nginx configuration.

#### Postgresql Install (optional)
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
