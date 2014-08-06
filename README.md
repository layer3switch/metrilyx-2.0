Metrilyx v2.3.0
===============
Metrilyx is a web based dashboard engine to OpenTSDB, a time series database used to store large amounts of data.  It allows for analyzing, cross cutting and viewing of time series data in a simple manner.

#### Features:
- Easy to use UI for dashboard creation.
- Annotate various events.
- Multiple graph types: spline, area, stacked, pie, line.
- Data provided via websockets for low protocol overhead.
- Regex support for metric, tag key and tag value searches.
- Supports distributed and HA setup

#### Screenshots
##### Overview
![Alt text](metrilyx/static/imgs/readme/screenshot_1.png)
##### Page listing
![Alt text](metrilyx/static/imgs/readme/screenshot_2.png)
##### Edit Mode
![Alt text](metrilyx/static/imgs/readme/screenshot_3.png)

**Notes**

- Please be aware that although the project has a MIT license, the graphing library is under the creative commons license.
- The default username and password for the site are admin and metrilyx respectively. Changing these will cause the application to stop functioning as other configurations also need to be updated.  This should not be harmful as metrilyx does not store any sensitive information.