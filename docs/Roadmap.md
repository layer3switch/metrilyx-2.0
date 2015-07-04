Roadmap
=======
##### v3.0.0
- Support for new version of OpenTSDB
- Multiple OpenTSDB sources
- Pandas analysis.
- Peeling of individual components.
- Copyable components

##### v2.5.1
- Fix for high memory consumption on websocket.
- Fix for client making multiple websocket connections.
- SSL support for websockets.
- CentOS 6.x and Ubuntu 14.04 packages.

##### v2.5.0
- Annotations as a seperate service (no longer part of default metrilyx).

##### v2.4.2
- Fix for Ubuntu 12 and 14 installation.
- Added basic modelmanager and dataserver tests.
- Added preliminary CI configuration for automated tests/builds.

##### v2.4.1
- Fix for alias's

##### v2.4.0 (current)
- Cross metric operations i.e. perform math against metrics to create secondary metrics.
- Perform complex operations on time series data for statistical analysis. (rolling, percentile etc.)
- Additional graph types: bar and column.
- Correctly apply aggregator for bar, column and pie graphs.
- Annotation mappings automatically added when creating new event types.
- Optimization to the websocket layer by using 'wsaccel' and 'ujson'

##### v2.3.4
- Server side code optimization.
- Cleanup of pending calls upon client disconnection.
- Behavioural changes in UI.
- WebSocket auto re-connect (experimental).
- Various bug fixes.

##### v2.3.3
- Major code optimizations for rendering and graphing.
- Date time selector inconsistent behaviour fix.
- Code optimizations in controller.
- Various UI bug fixes.
- Major code refactoring.

##### v2.3.2
- Complex annotation tag queries in particular the OR operator.
- Site analytics
- Toggle annotation detail visibility.

##### v2.3.1
- Enable/Disable cache layer.
- Performance related configuration changes.
- Angularjs unit tests.

##### v2.3.0
- Event annotations for both adhoc and dashboard view.
- Cleaner URL params for user readability.
- Auto updates when viewing adhoc graphs.
- Regex support for metric, tag-key and tag-value searches.
- Additional graph types: spline, area, stacked, pie, line.
- UI changes and fixes.
- Overall performance improvements.

##### v2.2.0
- Major performance improvements.
	- Data delivery system now completely **asynchronous**.
	- Data provided through **websockets**.
	- In flight data **compression** (permessage-deflate).
- **Nginx** used as reverse proxy rather than apache.
- Support for **distributed** and **HA** setup.

##### v2.1.0
- Ability to group pages based on tags.
- Ability to generate heatmaps against a metric.
- Ability to import and export pages.
- Updated graphing library to Highstock 2.0.1
- Improved the ability to move pods around on a page.
- Various performance improvements and bug fixes.
