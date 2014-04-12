#!/usr/bin/env bash

INSTALL_ROOT="/opt";
INSTALL_TIME=$(date '+%d%b%Y_%H%M');
APP_HOME="${INSTALL_ROOT}/metrilyx";
PYPKGS="uuid Django djangorestframework django-filter django-cors-headers pymongo celery";

if [[ -f "/etc/redhat-release" ]]; then
	HTTPD="httpd"
	HTTP_USER="apache"
	PKGS="libuuid gcc uuid ${HTTPD} mod_wsgi python-setuptools python-devel mongodb"
	PKG_INSTALLER="yum -y install"
	PKG_LISTER="rpm -qa"
	PKG_S_PREFIX="^"
elif [[ -f "/etc/debian_version" ]]; then
	HTTPD="apache2"
	HTTP_USER="www-data"
	PKGS="libuuid1 gcc uuid ${HTTPD} libapache2-mod-wsgi python-setuptools python-dev mongodb"
	PKG_INSTALLER="apt-get install -y"
	PKG_LISTER="dpkg -l"
	PKG_S_PREFIX="ii\s+"
else
	echo "Currently only RedHat/Debian based distro are supported.  Please install manually.";
	exit 1;
fi

clean() {
	find . -name '*.pyc' -exec rm -rvf '{}' \;
}
setup_app_dirs() {
	mkdir -p ${APP_HOME};
	cp -a . ${APP_HOME}/;
	chmod g+w ${APP_HOME};
	( id celery 2>&1 ) > /dev/null || useradd celery;
	chgrp celery ${APP_HOME};
}
setup_startup_config() {
	cp -a etc/rc.d/init.d/* /etc/rc.d/init.d/;
	if [ ! -f /etc/sysconfig/celeryd ]; then 
		cp etc/sysconfig/celeryd /etc/sysconfig/;
	fi	
}
install_os_deps() {
	echo "-- Installing OS dependencies...."
	for pkg in ${PKGS}; do
		$PKG_LISTER | egrep "${PKG_S_PREFIX}${pkg}" || $PKG_INSTALLER ${pkg};
	done;
};
install_pydeps() {
	echo "-- Installing python dependencies..."
	which pip || easy_install pip;
	for pypkg in $PYPKGS; do
		pip list | grep ${pypkg} || pip install ${pypkg};
	done;
};
install_deps() {
	install_os_deps;
	install_pydeps;
}
backup_curr_install() {
	if [ -d "${INSTALL_ROOT}/metrilyx" ]; then
		echo "- Backing up existing installation...";
		mv ${APP_HOME} ${APP_HOME}-${INSTALL_TIME};
	fi;
}
setup_app_config() {
	if [ -f "/opt/metrilyx-${INSTALL_TIME}/etc/metrilyx/metrilyx.conf" ]; then
		echo "- Importing existing data..."
		echo "  configs...";
		cp ${APP_HOME}-${INSTALL_TIME}/etc/metrilyx/metrilyx.conf ${APP_HOME}/etc/metrilyx/metrilyx.conf;
		if [ -f "${APP_HOME}-${INSTALL_TIME}/metrilyx/static/config.js" ]; then
			cp ${APP_HOME}-${INSTALL_TIME}/metrilyx/static/config.js ${APP_HOME}/metrilyx/static/config.js;
		fi
		if [ ! -f "${APP_HOME}/metrilyx/static/config.js" ]; then
			cp ${APP_HOME}/metrilyx/static/config.js.sample ${APP_HOME}/metrilyx/static/config.js;
		fi
		echo "  dashboards..."
		cp -a ${APP_HOME}-${INSTALL_TIME}/pagemodels ${APP_HOME}/;
		echo "  heatmap index..."
		cp -f ${APP_HOME}-${INSTALL_TIME}/heatmaps.json ${APP_HOME}/heatmaps.json;
		echo "  heatmaps..."
		cp -a ${APP_HOME}-${INSTALL_TIME}/heatmaps ${APP_HOME}/;
	else
		cp ${APP_HOME}/metrilyx/static/config.js.sample ${APP_HOME}/metrilyx/static/config.js;
		cp etc/metrilyx/metrilyx.conf.sample ${APP_HOME}/etc/metrilyx/metrilyx.conf;
		${EDITOR:-vi} ${APP_HOME}/etc/metrilyx/metrilyx.conf;
	fi
}
install_app(){
	clean;

	backup_curr_install;
	
	echo "- Installing app..."
	setup_app_dirs;
	setup_app_config;
	
}
app_postinstall() {
	if [[ -f "/etc/debian_version" ]]; then
		a2enmod rewrite;
	elif [[ -f "/etc/redhat-release" ]]; then
		setup_startup_config;
	fi
	#/etc/init.d/${HTTPD} restart;
}
install_web_config() {
	echo "- Installing web components..."
	cp etc/httpd/conf.d/metrilyx.conf /etc/${HTTPD}/conf.d/;
	chown -R $HTTP_USER ${APP_HOME};
}
##### Main ####



case "$1" in
	lyx)	
		install_deps;
		install_app;
		app_postinstall;
		;;
	all)
		install_deps;
		install_app;
		install_web_config;
		app_postinstall;
		;;	
	*)
		echo -e "\n\tUsage:\n\t\t$0\t[lyx|all]\n";
		exit 2;
esac

echo "** Please restart the webserver **"
echo "** Heatmaps are still in beta phase.  Currently requiring a frequent restart."
echo "** If you choose to use heatmaps set the config options (/opt/metrilyx/etc/metrilyx/metrilyx.conf) and start celerybeat and celeryd **"
