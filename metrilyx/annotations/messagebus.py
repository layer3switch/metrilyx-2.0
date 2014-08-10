
import multiprocessing

from kafka.client import KafkaClient
from kafka.producer import SimpleProducer
from kafka.consumer import SimpleConsumer
#from kafka.partitioner import HashedPartitioner, RoundRobinPartitioner

from pprint import pprint

BUS_CLIENT_TYPES = ('producer', 'consumer')

class BasicBusClient(object):
	'''
		client_type: possible values 'producer' or 'consumer'
	'''
	def __init__(self, client_type, config):
		if client_type not in BUS_CLIENT_TYPES:
			raise RuntimeError("Invalid client type: %s." %(client_type))
		self.client_type = client_type

		for k,v in config.items():
			setattr(self, k, v)


class KafkaBusClient(BasicBusClient):
	def __init__(self, client_type, config):
		super(KafkaBusClient, self).__init__(client_type, config)
		self.address = str(self.address)
		self.topic = str(self.topic)
		self.client = KafkaClient("%s:%d" %(self.address, self.port))
		if config.has_key('async'):
			self.async = config['async']
		else:
			self.async = True

		if self.client_type == 'producer':
			self.producer = SimpleProducer(self.client, async=self.async)
		else:
			self.consumer_group = str(self.consumer_group)
			if not config.has_key('consumer_procs'):
				self.consumer_procs = multiprocessing.cpu_count()
				#print "Using %d processes" %(self.consumer_procs)
				
			self.consumer = SimpleConsumer(self.client, 
							self.consumer_group, self.topic)
							#num_procs=self.consumer_procs)

	def close(self):
		self.client.close()

class KafkaProducer(KafkaBusClient):
	def __init__(self, config):
		super(KafkaProducer,self).__init__('producer', config)

	def send(self, message):
		ret = self.producer.send_messages(self.topic, str(message))

class KafkaConsumer(KafkaBusClient):
	def __init__(self, config):
		super(KafkaConsumer,self).__init__('consumer', config)


	


