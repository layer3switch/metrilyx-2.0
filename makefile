all: deps pydeps install

deps:
	for pkg in libuuid uuid httpd mod_wsgi python-setuptools; do \
		rpm -qa | grep $$pkg || yum -y install $$pkg; \
	done;
	chkconfig httpd on;

pydeps:
	which pip || easy_install pip;
	for pypkg in uuid Django djangorestframework Markdown django-filter; do \
		pip list | grep $$pypkg || pip install $$pypkg; \
	done;

clean:
	find . -name '*.pyc' -exec rm -rvf '{}' \;

install: clean
	/etc/init.d/httpd stop;
	if [ -d "/opt/metrilyx" ] then; \
		mv /opt/metrilyx /opt/metrilyx-`date '+%d%b%Y_%H%M'`; \	
	fi;
	mkdir -p /opt/metrilyx;
	cp -a . /opt/metrilyx/;
	cp etc/httpd/conf.d/metrilyx.conf /etc/httpd/conf.d/;
	chown -R apache:apache /opt/metrilyx;
	/etc/init.d/httpd start;


