
#### Setup vagrant VM

	vagrant init 'chef/centos-6.5'

Add the following line to your **Vagrantfile** to setup the port forwarding to your localhost on port 8888.

	config.vm.network "forwarded_port", guest: 80, host: 8888


#### Update system

	yum -y update
	yum -y install libuuid uuid python-setuptools python-devel gcc git


#### Install nginx

	yum -y install http://nginx.org/packages/centos/6/noarch/RPMS/nginx-release-centos-6-0.el6.ngx.noarch.rpm
	yum -y install nginx

	mv /etc/nginx/conf.d/default.conf{,.disabled}

	/etc/init.d/nginx start

#### Install metrilyx

	git clone https://github.com/TicketMaster/metrilyx-2.0.git
	cd metrilyx-2.0
	./install app

Edit the configs as prompted.  Set the SERVER_NAME variable in **/opt/metrilyx/metrilyx/static/config.js** as below with the port forward we setup earlier for vagrant.

	var SERVER_NAME = "localhost:8888"


#### Start services
	
	/etc/init.d/metrilyx-dataserver start
	/etc/init.d/metrilyx-modelmanager start