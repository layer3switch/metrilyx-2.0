##
## Most make commands will require 'sudo'.
##

SHELL = /bin/bash
UNAME = $(shell uname)

## Release file to determin distro and os
UBUNTU_REL_F := /etc/lsb-release
DEBIAN_REL_F := /etc/debian_version
ORACLE_REL_F := /etc/oracle-release
REDHAT_REL_F := /etc/redhat-release
## Determine OS and Distribution
ifeq ($(UNAME),Darwin)
	DISTRO := osx
	CODENAME = $(shell sw_vers -productVersion  | sed "s/\./_/g")
## Check oracle first as it also has the redhat-release file
else ifneq ("$(wildcard $(ORACLE_REL_F))", "")
	DISTRO := oracle
else ifneq ("$(wildcard $(REDHAT_REL_F))", "")
	DISTRO := redhat
## Check ubuntu first as it also has the debian_version file
else ifneq ("$(wildcard $(UBUNTU_REL_F))","")
	DISTRO := ubuntu
	CODENAME = $(shell grep 'DISTRIB_CODENAME=' $(UBUNTU_REL_F) | cut -d '=' -f 2 | tr '[:upper:]' '[:lower:]')
else ifneq ("$(wildcard $(DEBIAN_REL_F))", "")
	DISTRO := debian
	CODENAME = $(shell cat $(DEBIAN_REL_F))
endif

ifeq ("$(DISTRO)","")
	echo "Could not determine distro!"
	exit 1
endif

START_DATETIME := `date`

NGINX_URL := http://nginx.org
NGINX_CONF_DIR := /etc/nginx/conf.d
NGINX_CONF := $(NGINX_CONF_DIR)/default.conf

# nginx deb confs
NGINX_KEY = nginx_signing.key
NGINX_KEY_URL = $(NGINX_URL)/keys/$(NGINX_KEY)
NGINX_SOURCES_LIST := /etc/apt/sources.list.d/nginx.list
# nginx rhel confs
NGINX_RPM := nginx-release-centos-6-0.el6.ngx.noarch.rpm
NGINX_REPORPM_URL := $(NGINX_URL)/packages/centos/6/noarch/RPMS/$(NGINX_RPM)
EPEL_REPORPM_URL := http://mirror.pnl.gov/epel/6/i386/epel-release-6-8.noarch.rpm

RPM_DEPS := git gcc gcc-c++ gcc-gfortran atlas-devel blas-devel libffi libffi-devel libuuid uuid python-setuptools python-devel
DEB_DEPS := build-essential make g++ gfortran libuuid1 uuid-runtime python-setuptools python-dev libpython2.7 python-pip git-core libffi-dev libatlas-dev libblas-dev python-numpy

MIN_NUMPY_VERSION := "numpy>=1.6.1"

METRILYX_HOME := /opt/metrilyx
METRILYX_CONF := $(METRILYX_HOME)/etc/metrilyx/metrilyx.conf
DEFAULT_DB := $(METRILYX_HOME)/data/metrilyx.sqlite3


USER = metrilyx

INSTALL_DIR = $(shell pwd)/build/metrilyx-2.0
PYTHONPATH = ./build/metrilyx-2.0/opt/metrilyx/usr/lib/python2.6/site-packages:./build/metrilyx-2.0/opt/metrilyx/usr/lib64/python2.6/site-packages:./build/metrilyx-2.0/usr/lib/python2.6/site-packages:./build/metrilyx-2.0/usr/lib64/python2.6/site-packages

.clean:
	rm -rf /tmp/pip_build_root
	rm -rf /tmp/pip-*
	rm -rf ./build ./dist 
	rm -rf ./numpy-1*
	rm -rf ./Twisted-14*
	rm -rf ./six-1*
	rm -rf ./node_modules
	rm -rf ./metrilyx.egg-info
	find . -name '*.py[c|o]' -exec rm -rvf '{}' \;

# Install nginx
# TODO: add check for exising nginx
.nginx:
	if [[ ( "$(DISTRO)" == "ubuntu" ) || ( "$(DISTRO)" == "debian" ) ]]; then \
		[ -f $(NGINX_SOURCES_LIST) ] || { \
			wget "$(NGINX_KEY_URL)" && apt-key add $(NGINX_KEY) && rm -rf $(NGINX_KEY); \
			$(SHELL) -c "echo -e '#\n# Updated By Metrilyx: $(START_DATETIME)\n#\ndeb $(NGINX_URL)/packages/$(DISTRO)/ $(CODENAME) nginx\ndeb-src $(NGINX_URL)/packages/$(DISTRO)/ $(CODENAME) nginx\n' > $(NGINX_SOURCES_LIST)"; \
			apt-get update -qq; \
		}; \
		apt-get install -y nginx; \
	else \
		yum -y install "$(NGINX_REPORPM_URL)" && yum -y install nginx && chkconfig nginx on; \
	fi;


#
# Install each pkg individually in case any fail the others still install.
#
.deps:
	if [[ ( "$(DISTRO)" == "ubuntu" ) || ( "$(DISTRO)" == "debian" ) ]]; then \
		apt-get update -qq; \
		for pkg in $(DEB_DEPS); do \
			apt-get install -q -y $$pkg; \
		done; \
	else \
		for pkg in $(RPM_DEPS); do \
			yum -y install $$pkg; \
		done; \
		which pip || easy_install pip; \
		pip install $(MIN_NUMPY_VERSION); \
	fi;	

deps:
	which pip || easy_install pip
	[ -e "$(INSTALL_DIR)$(METRILYX_HOME)" ] || mkdir -p "$(INSTALL_DIR)$(METRILYX_HOME)"
	export PYTHONPATH=$(PYTHONPATH)
	for pkg in `cat requirements.txt`; do \
		pip install --root $(INSTALL_DIR)$(METRILYX_HOME) $$pkg; \
	done;
	find $(INSTALL_DIR)$(METRILYX_HOME) -name 'zope' -type d -exec touch '{}'/__init__.py \;

.build:
	python setup.py install --root $(INSTALL_DIR)

install:	
	rsync -aHP $(INSTALL_DIR)/ /

.package:
	cd `dirname $(INSTALL_DIR)` && tar -czf metrilyx-$(DISTRO).tgz metrilyx ; cd -

.post_install:
	( id $(USER) > /dev/null 2>&1 ) || ( useradd $(USER) > /dev/null 2>&1 )
	chown -R $(USER) $(METRILYX_HOME)
	
	find $(METRILYX_HOME)/usr -type d -name 'site-packages' -exec echo export PYTHONPATH='{}':\$$PYTHONPATH >> ~$(USER)/.bashrc \;

#
# Test dataserver and modelmanager after they have been started.
#
.test:
	python -m unittest tests.dataserver
	python -m unittest tests.modelmanager

# Copies sample configs if no configs exist
.config:
	[ -f $(METRILYX_CONF) ] || cp $(METRILYX_CONF).sample $(METRILYX_CONF)
	[ -f $(DEFAULT_DB) ] || cp $(DEFAULT_DB).default $(DEFAULT_DB)


.start-service:
	/etc/init.d/metrilyx start
	/etc/init.d/nginx restart
