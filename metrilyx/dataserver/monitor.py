
import sys
import resource

from twisted.internet import reactor


class ProcessMonitor(object):
    """ Monitor various metrics for the process """

    def __init__(self, checkInterval, logger):
        self.checkInterval = checkInterval
        self.logger = logger

    def getCurrMemUsage(self):
        """
            Get memory usage for the calling process.

            Return:
                memory consumption for calling process in MB's.
        """
        rusage_denom = 1024.00
        if sys.platform == "darwin":
            # OS X unit is KB
            rusage_denom = rusage_denom * rusage_denom     
        return float(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss) / rusage_denom

    def startMonitoringMemory(self, callback=None):
        """ Check memory at specified interval """
        mem = self.getCurrMemUsage()
        self.logger.info("Memory used: %f MBs" % (mem))

        if callback != None:
            callback({'mem_used': mem})

        reactor.callLater(self.checkInterval, self.startMonitoringMemory, callback)

    def start(self, callback=None):
        self.startMonitoringMemory(callback)