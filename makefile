
METRILYX_HOME = /opt/metrilyx
METRILYX_CONF = $(METRILYX_HOME)/etc/metrilyx/metrilyx.conf
DEFAULT_DB = $(METRILYX_HOME)/data/metrilyx.sqlite3

clean:
	rm -rf /tmp/pip_build_root
	rm -rf /tmp/pip-*
	rm -rf ./build ./dist 
	rm -rf ./numpy-1*
	rm -rf ./Twisted-14*
	rm -rf ./six-1*
	rm -rf ./node_modules
	rm -rf ./metrilyx.egg-info
	find . -name '*.py[c|o]' -exec rm -rvf '{}' \;
#
# Test dataserver and modelmanager after they have been started.
#
test:
	python -m unittest tests.dataserver
	python -m unittest tests.modelmanager

# Copies sample configs if no configs exist
config:
	[ -f $(METRILYX_CONF) ] || cp $(METRILYX_CONF).sample $(METRILYX_CONF)
	[ -f $(DEFAULT_DB) ] || cp $(DEFAULT_DB).default $(DEFAULT_DB)

start:
	/etc/init.d/metrilyx start
	/etc/init.d/nginx restart
