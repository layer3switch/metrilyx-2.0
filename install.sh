#!/usr/bin/env bash

INSTALL_ROOT="/opt";
INSTALL_TIME=$(date '+%d%b%Y_%H%M%S');
APP_HOME="${INSTALL_ROOT}/metrilyx";

if [[ -f "/etc/redhat-release" ]]; then
	HTTPD="httpd"
	HTTP_USER="apache"
elif [[ -f "/etc/debian_version" ]]; then
	HTTPD="apache2"
	HTTP_USER="www-data"
else
	echo "Currently only RedHat/Debian based distro are supported.  Please install manually.";
	exit 1;
fi

clean() {
	find . -name '*.pyc' -exec rm -rf '{}' \;
}

install_app() {
	mkdir -p ${APP_HOME};
	cp -a . ${APP_HOME}/;
	chmod g+w ${APP_HOME};
	( id celery 2>&1 ) > /dev/null || useradd celery;
	chgrp celery ${APP_HOME};
	[ -f "${APP_HOME}/metrilyx.sqlite3" ] && chown ${HTTP_USER} ${APP_HOME}/metrilyx.sqlite3
}

setup_celery_startup() {
	if [[ -f "/etc/redhat-release" ]]; then
		cp -a etc/rc.d/init.d/* /etc/rc.d/init.d/;
		if [ ! -f /etc/sysconfig/celeryd ]; then 
			cp etc/sysconfig/celeryd /etc/sysconfig/;
		fi	
	fi
}

install_pydeps() {
	echo "-- Installing python dependencies..."
	which pip || easy_install pip;
	for pypkg in $(cat PYPACKAGES); do
		pip list | grep ${pypkg} || pip install ${pypkg};
	done;
}

backup_curr_install() {
	clean;
	if [ -d "${APP_HOME}" ]; then
		echo "- Backing up existing installation...";
		mv ${APP_HOME} ${APP_HOME}-${INSTALL_TIME};
	fi;
}
copy_configs() {
	cp etc/metrilyx/metrilyx.conf.sample ${APP_HOME}/etc/metrilyx/metrilyx.conf;
	${EDITOR:-vi} ${APP_HOME}/etc/metrilyx/metrilyx.conf;
	cp ${APP_HOME}/metrilyx/static/config.js.sample ${APP_HOME}/metrilyx/static/config.js;

	[ -d "${APP_HOME}-${INSTALL_TIME}/pagemodels" ] && cp -a ${APP_HOME}-${INSTALL_TIME}/pagemodels ${APP_HOME}/;
	[ -d "${APP_HOME}-${INSTALL_TIME}/heatmaps" ] && cp -a ${APP_HOME}-${INSTALL_TIME}/heatmaps ${APP_HOME}/;
}
configure_app() {
	echo "- Importing existing data...";
	echo "  configs...";
	if [ -f "${APP_HOME}-${INSTALL_TIME}/etc/metrilyx/metrilyx.conf" ]; then
        cp ${APP_HOME}-${INSTALL_TIME}/etc/metrilyx/metrilyx.conf ${APP_HOME}/etc/metrilyx/metrilyx.conf;
    else
        cp etc/metrilyx/metrilyx.conf.sample ${APP_HOME}/etc/metrilyx/metrilyx.conf;
        ${EDITOR:-vi} ${APP_HOME}/etc/metrilyx/metrilyx.conf;
    fi

	if [ -f "${APP_HOME}-${INSTALL_TIME}/metrilyx/static/config.js" ]; then
		cp ${APP_HOME}-${INSTALL_TIME}/metrilyx/static/config.js ${APP_HOME}/metrilyx/static/config.js;
	else
		cp ${APP_HOME}/metrilyx/static/config.js.sample ${APP_HOME}/metrilyx/static/config.js;
	fi

	echo "  dashboards..."
	[ -d "${APP_HOME}-${INSTALL_TIME}/pagemodels" ] && cp -a ${APP_HOME}-${INSTALL_TIME}/pagemodels ${APP_HOME}/;
	
	echo "  heatmaps..."
	[ -d "${APP_HOME}-${INSTALL_TIME}/heatmaps" ] && cp -a ${APP_HOME}-${INSTALL_TIME}/heatmaps ${APP_HOME}/;
}

configure_apache() {
	echo "- Installing web components..."
	if [[ -f "/etc/debian_version" ]]; then
		cp etc/httpd/conf.d/metrilyx.conf /etc/apache2/sites-available/ && rm /etc/apache2/sites-enabled/*.conf && a2ensite metrilyx;
		# ubuntu 13.10
		sed -i "s/#Require all granted/Require all granted/g" /etc/apache2/sites-available/metrilyx.conf;
		a2enmod rewrite;
		a2enmod headers;
	elif [[ -f "/etc/redhat-release" ]]; then
		cp etc/httpd/conf.d/metrilyx.conf /etc/httpd/conf.d/;
		chown -R $HTTP_USER ${APP_HOME};
	fi
}
init_postgres() {
	/etc/init.d/postgresql-9.3 initdb;
	/etc/init.d/postgresql-9.3 start;
	chkconfig postgresql-9.3 on;
}
init_django() {
	cd ${APP_HOME};
	echo "- Removing current db data..."
	rm -rf ./metrilyx.sqlite3 ./celerybeat-schedule.db;
	python ./manage.py syncdb;
	python ./manage.py createinitialrevisions;
	[[ -f "./metrilyx.sqlite3" ]] && chown ${HTTP_USER}:${HTTP_USER} ./metrilyx.sqlite3;
	# apache restart
}
##### Main ####

if [ "$(whoami)" != "root" ]; then
	echo "Must be root!";
	exit 1;
fi

if [ "$1" == "app" ]; then
	install_pydeps;
	backup_curr_install;
	install_app;
	copy_configs;
	#configure_app;
	configure_apache;
	setup_celery_startup;
else
	echo "Executing $1...";
	$1;
fi


echo ""
echo " ** CONFIGURATION OPTIONS CHANGED **"
echo ""
echo " ** If you choose to use heatmaps set the config options"
echo " ** (/opt/metrilyx/etc/metrilyx/metrilyx.conf) and start celerybeat and celeryd."
echo ""

