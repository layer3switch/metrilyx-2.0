"""
    Command line option parser
"""

import sys
import logging

from optparse import OptionParser

DEFAULT_LOG_FORMAT = "%(asctime)s [%(levelname)s %(name)s %(lineno)d] %(message)s"

class DataserverOptionParser(OptionParser):

    def __init__(self, *args, **kwargs):
        OptionParser.__init__(self, *args, **kwargs)

    def __getLogger(self, opts):
        try:
            logging.basicConfig(level=eval("logging.%s" % (opts.logLevel)), 
                                                    format=opts.logFormat)
            return logging.getLogger(__name__)
        except Exception,e:
            print "[ERROR] %s" %(str(e))
            sys.exit(2)

    def parse_args(self):
        opts, args = OptionParser.parse_args(self)
        setattr(opts, "logger", self.__getLogger(opts))
        opts.logger.warning("* Log level: %s" % (opts.logLevel))
        return (opts, args)
        