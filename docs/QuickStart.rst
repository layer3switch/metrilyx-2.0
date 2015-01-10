===========
Quick Start
===========
This is a quick start guide for RHEL/CentOS/Oracle 6.4 & 6.5 and Debian/Ubuntu based distributions.

Although Metrilyx will run on any linux distribution, testing has been done againsts the following 64bit systems:

* CentOS/Oracle 6.4 & 6.5
* Ubuntu 14.04 (trusty), 12.04 (precise)

The quickest way to  be get up and running is to use the following method in 2 forms although going through the steps below is recommended::

	## Install all prerequisites including the latest version of nginx and metrilyx.
	curl -s http://metrilyx.github.io/bootstrap.sh  | bash -s -- install

The above is a script that nicely wraps up all the steps mentioned below including dependencies.  If you choose to manually perform the installation then follow the next steps or after successfully completion of the above script, continue on to the **Configuration** section.


Nginx Installation
==================

If you have a running version of nginx >= 1.6.1 you can move on to the 'Installation' step.

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

For Debian base systems follow the directions from the link below::

	http://nginx.org/en/linux_packages.html#stable


Requirements
============

The compiler requirements are needed specifically by numpy and pandas for computation and analysis.

On RHEL, CentOS, Oracle distributions (test w/ CentOS/Oracle 6.5)::

	## Install OS packages
	$ yum -y install git gcc gcc-c++ gcc-gfortran atlas-devel blas-devel libffi libffi-devel libuuid uuid python-setuptools python-devel

	## Install pip
	$ which pip || easy_install pip

	## Install numpy before installing metrilyx
	$ pip install 'numpy>=1.6.1'

For Debian based distributions (tested w/ Ubuntu 14.04)::

	## Install OS packages
	$ apt-get install make g++ gfortran libuuid1 uuid-runtime python-setuptools python-dev libpython-dev git-core libffi-dev libatlas-dev libblas-dev python-numpy

	## Install pip
	$ which pip || easy_install pip


Installation
============

Finally install metrilyx::

	$ pip install git+https://github.com/Ticketmaster/metrilyx-2.0.git

The next step is configure your installation.


Configuration
=============

The configuration file can be found at **/opt/metrilyx/etc/metrilyx**.  To begin, copy the sample config::

	$ cd /opt/metrilyx

	$ cp etc/metrilyx/metrilyx.conf{.sample,}

Also copy the provided default database::

	$ cp data/metrilyx.sqlite3{.default,}

Edit **etc/metrilyx/metrilyx.conf**.  The 'dataprovider' section is the only needed configuration assuming that the host has a resolvable FQDN ( i.e. resolves via socket.gethostname() ).  Otherwise the 'websocket' section will also need to be edited.

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

The 'websocket' section can be skipped if your host is a resolvable FQDN ( resolves via socket.gethostname() ), otherwise add the 'hostname' field and fill in the IP address of the server.  This should be the same address as the one used for web browser access ::

	{
		"websocket": {
			.
			.
			"hostname": "10.101.101.10"
			.
			.
		}
	}

Start the metrilyx service/s::

	/etc/init.d/metrilyx start

Restart nginx::

	/etc/init.d/nginx restart

You should now be able to visit http://my.host.name.org to start using Metrilyx.

Thats It!
