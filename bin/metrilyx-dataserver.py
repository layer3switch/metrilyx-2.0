#!/usr/bin/env python

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from metrilyx.dataserver import cli
from metrilyx.dataserver.server import ServerManager


def parseCliOptions():

    parser = cli.DataserverOptionParser()
    parser.add_option("-l", "--log-level", dest="logLevel", default="INFO",
        help="Log level. (default: INFO)")
    parser.add_option("--log-format", dest="logFormat", default=cli.DEFAULT_LOG_FORMAT,
        help="Log output format. (default: '"+cli.DEFAULT_LOG_FORMAT+"')")
    parser.add_option("--log-dir", dest="logDir", default=None,
        help="Log directory.")

    parser.add_option("--hostname", dest="hostname", default="localhost",
        help="Resolvable hostname  of the server. (default: localhost)")
    parser.add_option("-p", "--port", dest="port", type="int", default=9000,
        help="Port to listen on. (default: 9000)")
    parser.add_option("-e", "--external-port", dest="extPort", type="int", default=None,
        help="External port if running behind a proxy such as nginx. This would be the port of the proxy, usually port 80.")

    parser.add_option("--check-interval", dest="checkInterval", default=15.0, type="float", 
        help="Interval to check for process stats. (default: 15.0 secs)")
    parser.add_option("--max-memory", dest="maxAllowedMemory", type="float", default=1500.0,
        help="Maximum allowed memory (MB) before server is gracefully respawned. (default: 1500.0 MB)")

    return parser.parse_args()


if __name__ == "__main__":

    (opts, args) = parseCliOptions()

    smgr = ServerManager(opts)
    smgr.start()




