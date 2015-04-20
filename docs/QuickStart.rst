===========
Quick Start
===========
This is a quick start guide for RHEL/CentOS/Oracle 6.4 & 6.5 and Debian/Ubuntu based distributions.

Although Metrilyx will run on any linux distribution, testing has been done againsts the following 64bit systems:

* CentOS/Oracle 6
* Ubuntu 14.04

A minimum of 1GB of memory is required as well as nginx >= 1.6.1.

The quickest way to be get up and running is to use the packages provided under the `Release <https://github.com/Ticketmaster/metrilyx-2.0/releases>`_ section. The only additional required piece is a running installation of nginx.

**yum based systems**::

	yum install <metrilyx-2.0-x.rpm>


**apt based systems**::

	dpkg -i <metrilyx-2.0.x.deb>

If the above command fails due to dependencies, you can issue the following to resolve the dependencies:

	apt-get -f install
	
	dpkg -i <metrilyx-2.0.x.deb>

For all other distros/version issue the following as root:

	curl -s http://metrilyx.github.io/bootstrap.sh  | bash -s -- install v2.5.1

** Note: Ubuntu 12.04 is not supported as the analytics libraries are unable to compile. 

Nginx Installation & Configuration
==================================

Download and install the appropriate nginx repository based on your distribution with a minimum version of 1.6.  Once installed move the default config so it does not intercept metrilyx's nginx config.  The location of the default config may vary based on your installation.  For RHEL based systems you can issue the following::

	$ mv /etc/nginx/conf.d/default.conf{,.disabled}


Configuration
=============

The configuration file can be found at **/opt/metrilyx/etc/metrilyx**.  To begin, copy the sample config.

Edit **etc/metrilyx/metrilyx.conf**.  The '**dataprovider**' section is the only needed configuration assuming that the host has a resolvable FQDN.

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

The '**websocket**' section can be skipped if your **host is a resolvable FQDN** ( i.e socket.gethostname() ), otherwise add the '**hostname**' field, and fill in the IP address of the server::

	{
		"websocket": {
			.
			.
			"hostname": "10.101.101.10"
			.
			.
		}
	}

If running through a NAT and on a non-standard port you may need to set the port in the above to what nginx is listening on.

Services
========
Once the configuration is complete, start the metrilyx service/s::

	/etc/init.d/metrilyx start

Also start or restart nginx::

	/etc/init.d/nginx restart


You should now be able to visit http://$my_ip_or_hostname to start using Metrilyx.

That's it!
