
import os
import sys
import fnmatch
from setuptools import setup, find_packages

from pprint import pprint

DESCRIPTION = '''
A web based dashboard engine to OpenTSDB that allows for analyzing,
cross cutting and viewing of time series data in a simple manner.
'''
LICENSE = "LICENSE.txt"
SETUP_REQUIRES = ["six>=1.7.3"]
INSTALL_REQUIRES = [ p for p in open('REQUIREMENTS.txt').read().split('\n') if p != '' and not p.startswith('#') ]


def fileListBuilder(dirPath, regexp='*'):
    matches = []
    for root, dirnames, filenames in os.walk(dirPath):
        for filename in fnmatch.filter(filenames, regexp):
            matches.append(os.path.join(root, filename))
    return matches

def recursiveFileListBuilder(dirPath, prefix):
    mine = {}
    for root, dirnames, filenames in os.walk('www'):
        if not mine.has_key(root):
            mine[root] = []

        for filename in fnmatch.filter(filenames, '[!.]*'):
            mine[root].append(filename)

    out = []
    for k, values in mine.items():
        out.append((prefix+k, [ k+'/'+val for val in values ]))
    return out


DATA_FILES = [
    ('/etc/init.d',                        fileListBuilder('etc/init.d')),
    ('/opt/metrilyx/docs',                 fileListBuilder('docs')),
    ('/opt/metrilyx/bin',                  fileListBuilder('bin')),
    ('/opt/metrilyx/etc/metrilyx/schemas', fileListBuilder('etc/metrilyx/schemas')),
    ('/opt/metrilyx/data', [
                            'data/metrilyx.sqlite3.default']),
    ('/opt/metrilyx/etc/metrilyx', [
                            'etc/metrilyx/ess-mapping.conf.sample',
                            'etc/metrilyx/metrilyx.conf.sample',
                            'etc/metrilyx/uwsgi.conf',
                            'etc/metrilyx/uwsgi_params.conf']),
    ('/etc/sysconfig',      ['etc/sysconfig/metrilyx-cacher']),
    ('/etc/nginx/conf.d',   ['etc/nginx/conf.d/metrilyx.conf'])
]

## Re-create webroot directory structure
DATA_FILES += recursiveFileListBuilder('www', prefix='/opt/metrilyx/')

setup(
    name='metrilyx',
    version='2.4.0',
    url='https://github.com/TicketMaster/metrilyx-2.0.git',
    description=DESCRIPTION,
    long_description=DESCRIPTION,
    author='euforia',
    author_email='euforia@gmail.com',
    license=LICENSE,
    setup_requires=SETUP_REQUIRES,
    install_requires=INSTALL_REQUIRES,
    data_files=DATA_FILES,
    packages=find_packages()
)