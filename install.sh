
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
	echo "-- Installing app..."
	/etc/init.d/httpd stop > /dev/null 2>&1;
	if [ -d /opt/metrilyx ]; then
		mv /opt/metrilyx /opt/metrilyx-$(date '+%d%b%Y_%H%M');
	fi;
	mkdir -p /opt/metrilyx;
	cp -a . /opt/metrilyx/;
	cp -a etc/rc.d/init.d/* /etc/rc.d/init.d/;
	if [ ! -f /etc/sysconfig/celeryd ]; then 
		cp etc/sysconfig/celeryd /etc/sysconfig/;
	fi
	if [ ! -f /opt/metrilyx/etc/metrilyx/metrilyx.conf ]; then
		cp etc/metrilyx/metrilyx.conf.sample /opt/metrilyx/etc/metrilyx/metrilyx.conf;
	fi
	vi /opt/metrilyx/etc/metrilyx/metrilyx.conf;
}
install_web_config() {
	echo "-- Install UI..."
	cp etc/httpd/conf.d/metrilyx.conf /etc/httpd/conf.d/;
	chown -R apache:apache /opt/metrilyx;
	echo "-- Restarting apache..."
	/etc/init.d/httpd restart
}

##### Main ####

if [ ! -f "/etc/redhat-release" ]; then 
	echo "Not a RedHat based distro.  Please install manually.";
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
		echo -e "\n\tUsage:\n\t\t$0\t[lyx|www|all]\n";
		exit 2;
esac
