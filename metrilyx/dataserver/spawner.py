
import multiprocessing
import resource
import os
import sys

from twisted.internet import reactor
from autobahn.twisted.websocket import listenWS
from metrilyx.dataserver.protocols import acceptedCompression


DEFAULT_MEM_CHECK_INTERVAL = 30


class MemoryMonitoredProcess(multiprocessing.Process):

    def __init__(self, logger, queue, checkInterval=DEFAULT_MEM_CHECK_INTERVAL):
        super(MemoryMonitoredProcess, self).__init__()
        self.logger = logger
        self.queue = queue
        self.checkInterval = checkInterval


    def __getMemUsage(self):
        """
            Get memory usage for the calling process.

            Return:
                memory consumption for calling process in MB's.
        """
        rusage_denom = 1024.00
        if sys.platform == 'darwin':
            # OS X unit is KB
            rusage_denom = rusage_denom * rusage_denom     
        return float(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss) / rusage_denom


    def __checkMemory(self, logger, queue):
        mem = self.__getMemUsage()
        logger.info("%s PID: %s; Memory: %f MBs" % (self.name, self.pid, mem))
        
        self.queue.put((self.pid, mem))

        reactor.callLater(self.checkInterval, self.__checkMemory, 
                                            self.logger, self.queue)

    def run(self):
        reactor.callLater(self.checkInterval, self.__checkMemory, 
                                            self.logger, self.queue)
        self.logger.warning("Memory check (pid %d) interval: %d secs" % 
                                    (self.pid, self.checkInterval))


class MemoryMonitoredProcessPool(object):
    """
        Respawns long running processes when a X amount of memory has been consumed.


        Args:
            maxMemPerProc : Maximum allowed memory before process is respawned. (default 1GB)
    """
    def __init__(self, logger, maxMemPerProc=1024.00, **kwargs):
        # Receives memory stats from client
        self.queue = multiprocessing.Queue()
        self.logger = logger

        self.maxMemPerProc = maxMemPerProc

        # Process and their configs
        self.managedProcs = []

    def addProcess(self, process, procArgs):
        """
            Instantiate process and add.
        """
        mProc = {
            "process": process,
            "opts": procArgs,
            "instance": process(self.logger, self.queue, **procArgs)
            }
        mProc["instance"].daemon = True

        self.managedProcs.append(mProc)
        return mProc["instance"]

    def __getProcessByPid(self, pid):
        for p in self.managedProcs:
            if p["instance"].pid == pid:
                return p
        return None

    def __stopProcess(self, proc):
        self.logger.warning("Requesting termination (pid): %d" % (proc.pid))
        proc.join(5)
        if proc.is_alive():
            self.logger.debug("Terminating (pid): %d" % (proc.pid))
            proc.terminate()
        self.logger.warning("PID terminate: %d" % (proc.pid))

    def __respawnProcess(self, managedProc):
        
        self.__stopProcess(managedProc["instance"])       
        self.managedProcs.remove(managedProc)

        proc = self.addProcess(managedProc["process"], managedProc["opts"])
        self.logger.debug("Respawning...")
        proc.start()
        self.logger.warning("Respawned process (pid %d): %s" % (proc.pid, proc.name))

    def __listenForStats(self):
        # Infinitely loop for stats sent by child procs.
        self.logger.warning("Waiting for memory stats...")       
        while True:
            try:
                (pid, memUsage) = self.queue.get()
                if memUsage > self.maxMemPerProc:
                    p = self.__getProcessByPid(pid)
                    # Should NEVER be here.
                    if p == None:
                        self.logger.error("PID not found: %d" % (pid))
                        continue

                    self.logger.warning("Triggering respawn: %s (pid %d) - %f MB" % 
                                                (p["instance"].name, pid, memUsage))
                    self.__respawnProcess(p)         

            except Exception, e:
                self.logger.error("Could not read memory queue: %s" % (e))
                continue

    def start(self):
        if len(self.managedProcs) < 1:
            self.logger.error("No processes registered!")
            return
        
        # Spawn processes
        self.logger.warning("Spawning %d processes..." % (len(self.managedProcs)))
        for rProc in self.managedProcs:
            rProc["instance"].start()
            self.logger.warning("Started process (pid %d): %s" % 
                    (rProc["instance"].pid, rProc["instance"].name))

        self.__listenForStats()


class WebSocketServer(MemoryMonitoredProcess):
    """
        Single websocket server process.

        Args:
            queue : process safe queue to send stats.
    """
    def __init__(self, logger, queue, factory, protocol, uri, extPort=None, 
                                    checkInterval=DEFAULT_MEM_CHECK_INTERVAL):
        super(WebSocketServer, self).__init__(logger, queue, checkInterval)
        
        self.factory = factory
        self.protocol = protocol
        self.uri = uri
        self.extPort = extPort
        #self.factory = factory(uri, extPort)
        #self.factory.protocol = protocol
        #self.factory.setProtocolOptions(perMessageCompressionAccept=acceptedCompression)

    def run(self):
        #import gc
        #gc.enable()
        #gc.set_debug(gc.DEBUG_LEAK)
        
        # Registers the memory statistics function
        super(WebSocketServer, self).run()

        factory = self.factory(self.uri, self.extPort)
        factory.protocol = self.protocol
        factory.setProtocolOptions(perMessageCompressionAccept=acceptedCompression)

        # This has to be in the child process        
        listener = listenWS(factory)

        def tearDown():
            # callback to stopListening
            def stopReactor():
                if reactor.running:
                    reactor.stop
            
            d = listener.stopListening()
            d.addCallback(stopReactor)

        reactor.addSystemEventTrigger('before', 'shutdown', tearDown)
        reactor.run()

        # Show garbages
        #print "gc.collect()"
        #gc.collect()
        #print 'gc.garbage:', len(gc.garbage)

        #for i, item in enumerate(gc.garbage):
        #    print '%d) %r' % (i + 1, item)

