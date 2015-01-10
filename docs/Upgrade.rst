Upgrading
---------

* Stop all metrilyx related services::

    $ /etc/init.d/metrilyx stop

* Backup the current installation::

    $ cp -a /opt/metrilyx /opt/metrilyx.backup

* Clean 'pip' tmp directories::

    $ rm -rf /tmp/pip*

    You can replace the '*' with your pip tmp directory.

* Install metrilyx as mentioned in the installation or quick start guide.

* Copy your db back in place.  If you are NOT using sqlite3 then you can skip this step::

    cp /opt/metrilyx.backup/metrilyx.sqlite3 /opt/metrilyx/data/

* Edit the configuration with your settings - /opt/metrilyx/etc/metrilyx/metrilyx.conf

* Start metrilyx services::

    $ /etc/init.d/metrilyx start

* Update models::

    $ cd /opt/metrilyx
    $ METRILYX_HOME=$(pwd) ./bin/mdlmgr.py

    This will output a report of which models will need to be updated.  Once you are satisfied, commit the changes.

    $ METRILYX_HOME=$(pwd) ./bin/mdlmgr.py --commit
