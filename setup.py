from distutils.core import setup
from setuptools import find_packages

setup(
    name='metrilyx',
    version='2.4.0',
    url='https://github.com/TicketMaster/metrilyx-2.0.git',
    description='A web based dashboard engine to OpenTSDB that allows for analyzing, cross cutting and viewing of time series data in a simple manner.',
    long_description='...........',
    author='euforia',
    author_email='euforia@gmail.com',
    license='LICENSE',
    packages=find_packages(),
    include_package_data=True,
    data_files=[
        ('/opt/metrilyx/docs',  [
                                    "docs/Configuration.md",
                                    "docs/Installation.md",
                                    "docs/Roadmap.md",
                                    "docs/UnitTesting.md",
                                    "docs/UserGuide.md",
                                ]),
        ('/opt/metrilyx/etc',   [
                                    'etc/metrilyx/ess-mapping.conf.sample'
                                    'etc/metrilyx/metrilyx.conf.sample', 
                                    'etc/metrilyx/uwsgi.conf',
                                    'etc/metrilyx/uwsgi_params.conf']),
        ('/opt/metrilyx/etc/schemas', [
                                    'etc/metrilyx/schemas/graph.json',
                                    'etc/metrilyx/schemas/metric.json',
                                    'etc/metrilyx/schemas/page.json',
                                    'etc/metrilyx/schemas/pod.json'
                                    ]),
        ('/opt/metrilyx/bin',   [
                                    'bin/fire-event.py',
                                    'bin/metrilyx-cacher',
                                    'bin/mdlmgr.py',
                                    'bin/cfgmgr.py',
                                    'bin/metrilyx-dataserver.py']),
        ('/etc/init.d',         [
                                    'etc/init.d/metrilyx', 
                                    'etc/init.d/metrilyx-cacher', 
                                    'etc/init.d/metrilyx-dataserver', 
                                    'etc/init.d/metrilyx-modelmanager'
                                ]),
        ('/etc/sysconfig',      ['etc/sysconfig/metrilyx-cacher']),
        ('/etc/nginx/conf.d',   ['etc/nginx/conf.d/metrilyx.conf'])
    ],
    install_requires=[ p for p in open('REQUIREMENTS.txt').read().split('\n') if p != '' ],
)