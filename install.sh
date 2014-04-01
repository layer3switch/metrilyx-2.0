#!/bin/bash

install_os_deps() {
	echo "-- Installing OS dependencies...."
	for pkg in libuuid gcc uuid httpd mod_wsgi python-setuptools python-devel mongodb; do
		rpm -qa | egrep "^${pkg}" || yum -y install ${pkg};
	done;
	chkconfig httpd on;
};
install_pydeps() {
	echo "-- Installing python dependencies..."
	which pip || easy_install pip;
	for pypkg in uuid Django djangorestframework django-filter pymongo celery; do
		pip list | grep ${pypkg} || pip install ${pypkg};
	done;
};
install_deps() {
	install_os_deps;
	install_pydeps;
}
clean() {
	find . -name '*.pyc' -exec rm -rvf '{}' \;
}
install_app(){
	clean;

	echo "- Stopping apache...";
	/etc/init.d/httpd stop > /dev/null 2>&1;
	
	install_time=$(date '+%d%b%Y_%H%M');
	
	if [ -d /opt/metrilyx ]; then
		echo "- Backing up existing installation...";
		mv /opt/metrilyx /opt/metrilyx-${install_time};
	fi;
	
	echo "- Installing app..."
	mkdir -p /opt/metrilyx;
	cp -a . /opt/metrilyx/;
	chmod g+w /opt/metrilyx;
	id celery || useradd celery;
	chgrp celery /opt/metrilyx;
	
	cp -a etc/rc.d/init.d/* /etc/rc.d/init.d/;
	if [ ! -f /etc/sysconfig/celeryd ]; then 
		cp etc/sysconfig/celeryd /etc/sysconfig/;
	fi
	if [ -f "/opt/metrilyx-${install_time}/etc/metrilyx/metrilyx.conf" ]; then
		echo "- Importing existing data..."
		echo "  configs...";
		cp /opt/metrilyx-${install_time}/etc/metrilyx/metrilyx.conf /opt/metrilyx/etc/metrilyx/metrilyx.conf;
		echo "  dashboards..."
		cp -a /opt/metrilyx-${install_time}/pagemodels/ /opt/metrilyx/pagemodels/;
		echo "  heatmap index..."
		cp -f /opt/metrilyx-${install_time}/heatmaps.json /opt/metrilyx/heatmaps.json;
		echo "  heatmaps..."
		cp -a /opt/metrilyx-${install_time}/heatmaps/ /opt/metrilyx/heatmaps/;
	else
		cp etc/metrilyx/metrilyx.conf.sample /opt/metrilyx/etc/metrilyx/metrilyx.conf;
		${EDITOR:-vi} /opt/metrilyx/etc/metrilyx/metrilyx.conf;
	fi
	
}
install_web_config() {
	echo "- Installing web components..."
	cp etc/httpd/conf.d/metrilyx.conf /etc/httpd/conf.d/;
	chown -R apache:apache /opt/metrilyx;
	echo "- Restarting apache..."
	/etc/init.d/httpd restart
}

##### Main ####

if [ ! -f "/etc/redhat-release" ]; then 
	echo "Currently only RedHat based distro are supported.  Please install manually.";
	exit 1;
fi

case "$1" in
	lyx)	
		install_deps;
		install_app;
		;;
	all)
		install_deps;
		install_app;
		install_web_config;
		;;	
	*)
		echo -e "\n\tUsage:\n\t\t$0\t[lyx|all]\n";
		exit 2;
esac
