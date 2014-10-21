===========
Quick Start
===========
This is a quick start guide for RHEL/CentOS/Oracle 6.5 based distributions.  Although Metrilyx will run on any linux distribution, testing has been done againsts the os's mentioned above.

If you currently have a running version of nginx >= 1.6.1 you can move on to the 'Metrilyx Installation' section.

Nginx Installation
------------------
Download and install the appropriate nginx repository based on your distribution.  The setup has been tested with nginx >= 1.6.1

Start by downloading the nginx repository rpm.

For RedHat::

	$ yum -y install http://nginx.org/packages/rhel/6/noarch/RPMS/nginx-release-rhel-6-0.el6.ngx.noarch.rpm

For CentOS/Oracle::

	$ yum -y install http://nginx.org/packages/centos/6/noarch/RPMS/nginx-release-centos-6-0.el6.ngx.noarch.rpm

Finally install nginx::

	$ yum -y install nginx
	$ chkconfig nginx on

Disable the default nginx configuration::
	
	$ mv /etc/nginx/conf.d/default.conf{,.disabled}

Metrilyx installation
---------------------

For RHEL, CentOS, Oracle distributions::
		
	## Install os packages
	$ yum -y install git gcc gcc-c++ gcc-gfortran atlas-devel blas-devel libffi libffi-devel libuuid uuid python-setuptools python-devel

	## Install pip
	$ which pip || easy_install pip

	## Install numpy before installing metrilyx
	$ pip install 'numpy>=1.6.1'
	
	## Install metrilyx
	$ pip install git+https://github.com/Ticketmaster/metrilyx-2.0.git


The next step is configure your installation.

Configuration
-------------
The configuration file can be found at /opt/metrilyx/etc/metrilyx.  To begin, copy the sample config::

	$ cd /opt/metrilyx/etc/metrilyx
	$ cp metrilyx.conf.sample metrilyx.conf

The 'dataprovider' and 'websocket' section are the only 2 needed configurations to start.  

Fill in the uri and port for OpenTSDB in the 'dataprovider' section::

	{
		"dataprovider": {
			.
			.
			"uri": "http://openstdb.foo.com",
			"port": 4242
			.
			.
		}
	}

In the 'websocket' section fill in the fully qualified resolvable hostname for the server::

	{
		"websocket": {
			.
			.
			"hostname": "my.host.name.org"
			.
			.
		}
	}

Finally start the metrilyx service::

	/etc/init.d/metrilyx start

This will start 3 other services::

	metrilyx-dataserver
	metrilyx-modelmanager
	metrilyx-cacher

You should now be able to visit http://my.host.name.org to start using Metrilyx.

Thats It!