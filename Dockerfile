
FROM centos:7

RUN yum -y install git gcc gcc-c++ gcc-gfortran atlas-devel blas-devel libffi libffi-devel libuuid uuid python-setuptools python-devel

RUN which pip || easy_install pip

RUN pip install git+https://github.com/Ticketmaster/metrilyx-2.0.git@v2.5.2