#!/usr/bin/env python
import os
import sys

DEFAULT_ADMIN_USER = "admin"
DEFAULT_ADMIN_PASS = "metrilyx"
DEFAULT_ADMIN_EMAIL = "metrilyx@metrilyx.inc"


def createCredentials(username, password, email):
    '''
    This function can only be called after the Django settings file is available
    in the environment variables.
    '''

    from django.contrib.auth.management.commands import changepassword
    from django.core import management
    
    # Run the syncdb
    management.call_command('syncdb', interactive=False)

    # Create the super user and sets his password.
    management.call_command('createsuperuser', interactive=False, username=username, email=email)
    command = changepassword.Command()
    command._get_pass = lambda *args: password
    command.execute(username)

def printCredentials(username, password, email):

    print ""
    print " --"
    print ""
    print " Username: %s" %(username)
    print " Password: %s" %(password)
    print " Email   : %s" %(email)
    print ""
    print " --"
    print ""

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "metrilyx.settings")

    if "syncdb" in sys.argv:    
        
        from django.db.utils import IntegrityError
        
        try:
            createCredentials(DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS, DEFAULT_ADMIN_EMAIL)
            printCredentials(DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS, DEFAULT_ADMIN_EMAIL)
            sys.exit(0)
        except IntegrityError:
            pass
        except Exception,e:
            print e
            sys.exit(1)


    from django.core.management import execute_from_command_line
    
    execute_from_command_line(sys.argv)

