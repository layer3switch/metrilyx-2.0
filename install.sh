#!/usr/bin/env bash

INSTALL_ROOT="/opt";
INSTALL_TIME=$(date '+%d%b%Y_%H%M%S');
APP_HOME="${INSTALL_ROOT}/metrilyx";

if [[ -f "/etc/redhat-release" ]]; then
	HTTPD="nginx"
	HTTP_USER="nginx"
elif [[ -f "/etc/debian_version" ]]; then
	HTTPD="nginx"
	HTTP_USER="nginx"
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
configure_app() {
	echo "- Importing existing data...";
	echo "  configs...";
	if [ -f "${APP_HOME}-${INSTALL_TIME}/etc/metrilyx/metrilyx.conf" ]; then
        cp ${APP_HOME}-${INSTALL_TIME}/etc/metrilyx/metrilyx.conf ${APP_HOME}/etc/metrilyx/metrilyx.conf;
    else
        cp etc/metrilyx/metrilyx.conf.sample ${APP_HOME}/etc/metrilyx/metrilyx.conf;
    fi
    ${EDITOR:-vi} ${APP_HOME}/etc/metrilyx/metrilyx.conf;

	if [ -f "${APP_HOME}-${INSTALL_TIME}/metrilyx/static/config.js" ]; then
		cp ${APP_HOME}-${INSTALL_TIME}/metrilyx/static/config.js ${APP_HOME}/metrilyx/static/config.js;
	else
		cp ${APP_HOME}/metrilyx/static/config.js.sample ${APP_HOME}/metrilyx/static/config.js;
	fi
	${EDITOR:-vi} ${APP_HOME}/metrilyx/static/config.js;

	echo "  dashboards..."
	[ -d "${APP_HOME}-${INSTALL_TIME}/pagemodels" ] && cp -a ${APP_HOME}-${INSTALL_TIME}/pagemodels ${APP_HOME}/;
	
	echo "  heatmaps..."
	[ -d "${APP_HOME}-${INSTALL_TIME}/pagemodels" ] && cp -a ${APP_HOME}-${INSTALL_TIME}/heatmaps ${APP_HOME}/;
}

configure_webserver() {
	echo "- Installing web components..."
	cp etc/nginx/conf.d/metrilyx.conf /etc/nginx/conf.d/;
	chown -R $HTTP_USER ${APP_HOME};
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
	configure_app;
	configure_webserver;
	setup_celery_startup;
else
	echo "Executing $1...";
	$1;
fi


echo ""
echo " ** If you choose to use heatmaps set the config options"
echo " ** (/opt/metrilyx/etc/metrilyx/metrilyx.conf) and start celerybeat and celeryd."
echo ""

