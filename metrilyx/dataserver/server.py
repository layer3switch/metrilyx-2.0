
import os
import sys

from twisted.internet import reactor

from metrilyx.dataserver.monitor import ProcessMonitor
from metrilyx.dataserver.wsfactory import setupWebSocketFactory


class ServerManager(object):

    def __init__(self, options):
        """
            Manage server including starting and restarting based on memory consumption.

            Args:
                opts : DataserverOptionParser
                        checkInterval    : Interval in seconds to check stats.
                        maxAllowedMemory : Max memory consumption before respawning.
                        logger
                        hostname
                        port
                        extPort
        """
        self.logger = options.logger
        self.logger.warning("* Initializing server...")
        self.__processMon = ProcessMonitor(options.checkInterval, self.logger)
        
        self.__stopInitiated = None

        self.__maxAllowedMemory = options.maxAllowedMemory
        self.logger.warning("* Memory threshold: %.2f MBs" % (self.__maxAllowedMemory))
        self.factory, self.listener = setupWebSocketFactory(options.hostname, options.port, options.extPort)

    def start(self):
        """
            Start process stats monitor and reactor.
        """
        self.__processMon.start(self.__checkThresholdOrRestart)
        reactor.run()

    def respawn(self, *args):
        """ 
            Respawn process. 
        """
        self.logger.warning("*")
        self.logger.warning("* Restarting... cmd: %s" % (sys.argv))
        self.logger.warning("*")
        os.execv(sys.argv[0], sys.argv[1:])

    def __onListenerStopped(self, *args):
        """
            Called when we've stopped listening, which starts the drain.
        """
        self.logger.warning("Listener stopped!")
        dfd = self.factory.drainClients()
        # Add callback to respawn after all clients are drained and removed.
        dfd.addCallback(self.respawn)

    def __onListenerStoppedErr(self, *args):
        self.logger.error("Could not stop listener. Forcing shutdown...")
        self.respawn()

    def __checkThresholdOrRestart(self, memUsed):
        """
            Args:
                memUsed dict : Used memory in megabytes.
        """
        # stopInitiated will only be None if a stop hasn't already been issued.
        if memUsed["mem_used"] > self.__maxAllowedMemory and self.__stopInitiated == None:
            self.logger.warning("==> Memory threshold (%f) exceeded: %f MBs. Initiating restart..." % (
                                                    self.__maxAllowedMemory, memUsed["mem_used"]))
            
            self.logger.warning("Stopping listener...")
            self.__stopInitiated = self.listener.stopListening()
            self.__stopInitiated.addCallback(self.__onListenerStopped)
            self.__stopInitiated.addErrback(self.__onListenerStoppedErr)
