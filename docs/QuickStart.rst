===========
Quick Start
===========
This is a quick start guide for RHEL/CentOS/Oracle 6.4 & 6.5 and Debian/Ubuntu based distributions.

Although Metrilyx will run on any linux distribution, testing has been done againsts the following 64bit systems:

* CentOS/Oracle 6.4 & 6.5
* Ubuntu 14.04 (trusty), 12.04 (precise)

Also a minimum of 1GB of memory is also required.

The quickest way to be get up and running is to use the packages provided under the release section. The only additional required piece is a running installation of nginx.

For yum based systems:

	yum install <metrilyx-2.0-x.rpm>

For apt based systems:

	apt-get install <metrilyx-2.0.x.deb>


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

Configuration
=============

The configuration file can be found at **/opt/metrilyx/etc/metrilyx**.  To begin, copy the sample config.

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


Services
========
Once the configuration is complete, start the metrilyx service/s::

	/etc/init.d/metrilyx start

Also start or restart nginx::

	/etc/init.d/nginx restart


You should now be able to visit http://$my_ip_or_hostname to start using Metrilyx.

Thats It!
