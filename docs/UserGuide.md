## User Guide
-------------

## Global Tags
Tags in the top right corner of the page are global tags.  These tags get applied to every query. For example, to view the **Overview** model for host 'foo.bar.com' you can do:

	host=foo.bar.com

Assuming you have a tag called 'host' with value of 'foo.bar.com' the 'Overview' page will now show the same dashboard stats for the above host only.


## Graph Options

#### MultiPane
--------------
If enabled this option will draw 2 or more y-axis on the same graph with a maximum of the total number of metrics on the graph.  This can be useful when graphing 2 or more metrics with different units.

You can assign metrics to panes by changing the value of paneIndex.

#### Type
---------
This is the graph type to be rendered.  Currently, the following types are supported:

*	line
*	spline (line graph with rounded corners)
*	pie
*	area
*	stacked
*	bar
*	column


## Metric Options

#### rate
---------
This determines whether the metric should be calculated as a rate rather than using the raw datapoints.

#### alias
----------
Alias can be a python lambda function or in python string format.
The following variables are available:

	1. tags.XXX (where XXX is the tag name)
	2. metric

*	**String format:**

	This takes a standard python string format. Any of the above variables can be used.  Each variable when used must be wrapped as so - %(my.variable)s

	**e.g.:**

		##
		# This sets the alias to the hostname followed by the literal 'load1'.
		##

		%(tags.host)s load1

*	**Python function:**

	In order to use a function the line must begin with **!**.  String formatting cannot be used in conjunction with python lambda functions, but the same effect can be acheived using lambda functions.

	**e.g.:**

		##
		# This will extract the shortname followed by 'load1'.
		##

		!lambda x: "%s load1" %(x['tags.host'].split(".")[0])

The above will generate a label with the short name of a host.

#### yTransform
---------------
yTransform is a python lambda function that is applied to the datapoints.  The datapoints are stored in a **pandas DataFrame**, so any function that can be applied to the **DataFrame** from the **pandas** library can theoretically be used.

A **DataFrame** can be thought of as a table with the timestamp as the row index and the metric alias as the column name.

##### Examples
Each lambda variable (**x** in the examples below) refers to a complete DataFrame.  Hence, operations are applied to the complete DataFrame.

* Convert bytes to kilobytes:

		lambda x: x / 1024

* Add 5 to each value:

		lambda x: x + 5

* Get values not equal to 0:

		lambda x: x[ numpy.abs(x) > 0 ]

* Get value greater than 1000:

		lambda x: x[ x > 1000 ]

#### Secondary Metrics
----------------------
Secondary metrics allow the user to create metrics by performing math on the selected metrics.

##### Operation
This defines the operation to perform to create the secondary metric.  This also uses lambda functions.  Each serie is represented by a letter i.e. if you have 3 series in the graph, an example operation would look like this:

	lambda a, b, c: ( a + b ) / c

- You must have 1 letter per serie in the graph regardless of whether you use them.
- The first letter in the lambda definition refers to the first serie in the graph definition and so on.

##### Example
If you have 3 metrics in you graph definition in this order

- mem.active
- mem.inactive
- mem.total

and you want you to graph the amount of free memory, you can perform the operation like so:

	lambda a, b, c: c - ( a + b )

This essentially evaluates out to:

	mem.total - ( mem.active + mem.inactive )

As mem.total is the last in the list it maps to the last letter in the lambda function.

##### alias
This is used to name your secondary serie.  Each serie in a graph must be unique.  This works exactly the same as the metric alias option described above.

##### Pane
When using multi-pane graphs, this refers to the pane which this serie/s belongs to.


## Importing and Exporting Models
Models can be imported and exported if needed through the UI as well as through the api for automation.

#### Importing/Export via UI
In the UI you can find the **import** button just underneath the button to create a new dashboard and the **export** button underneath the edit button.

#### Importing/Export via API
To import a model using the API you can issue a command similar to the one below to import a graphmap i.e. page model replacing the appropriate values:

- curl -u admin:metrilyx http://localhost**/api/graphmaps** -H "Content-Type:application/json" -d @</path/to/json/model>

The above will import a graphmap (i.e. page).  To import a heatmap you can use the following endpoint:

- curl -u admin:metrilyx http://localhost**/api/heatmaps** -H "Content-Type:application/json" -d @</path/to/heatmap/model>

Models can similarly be exported (graphmap or heatmap) as follows:

- curl http://localhost/api/graphmaps/<graphmap_id>?export=true

## Event Annotations
Event annotations are used to mark points on the graph where interesting events have happened.  Events contain a type, tags, message and any arbitrary user data represented as JSON.  Here is a sample of the complete structure of an event:

### Event Structure

	{
		_id: "sha1 of the complete event at the time it was fired"
		timestamp: "timestamp in microseconds"
		eventType: "pre-defined event type"
		message: "Brief description.  This is what will be shown upon hovering."
		tags: {
			"host": "foo.bar.com",
			"tag2": "some_other_tag_use_for_filtering",
			"severity": "Warning"
		},
		data: {
			"Label1": "Some data to display.",
			"Label2": "This data can also be a html link.",
			"MyLink": "Alarm <a href='http://link'>Link to some page with even more details.</a>"
		}
	}

### Firing Events
Events can be submitted to Metrilyx via the API.  The 2 available options are:
- Provided script fire-event.py
- Submitting a HTTP POST request.

##### fire-event.py
This is a helper script that can be used to fire an event. To see the available options issue the following command:

	./bin/fire-event.py -h

##### Using HTTP POST method.
When using POST requests, they should be made to the **/api/annotations** endpoint.  The description of the POST payload is described below.


| Field | Description | Example | Required | Type |
|-------|-------------|---------|----------|------|
| **timestamp** | Epoch time in **milliseconds**.  If not provided the current time is used. | 1408129158000 (Aug 15 11:59:22 2014) | **No** | int |
| **eventType** | A pre-defined event type.  A list of event types can be found at the /api/event_types endpoint. | Maintenance | **Yes** | string |
| **message** | This is the string used when hovering over the event on the graph. | "Scheduled Network Maintenance"| **Yes** | string |
| **tags** | Any arbitrary tags that can be used later for searching/filtering. | {"host":"foo.bar.com","severity":"Warning"}| **Yes** | dict |
| **data** | This can be any arbitrary JSON data.  It must be a single level JSON structure. This is the data used as details which are shown when clicking on the event| {"Priority": "P1", "On Call": "Jon Doe", "Contact Email": "Jon.Doe@bar.com" }| No | dict |

**e.g.:**

	curl -XPOST http://<host>/api/annotations -H "Content-Type: application/json" -d '{
		"tags": {
			"host": "foo.bar.com",
			"appname": "Awesome"
			"datacenter": "au"
		},
		"evenType": "Release",
		"message": "'Awesome v3.3 Release update 2",
		"data": {
			"Priority": "P1",
			"Impact": "Local",
			"Contact": "manager@foo.bar.com",
			"Conference Call": "888-888-8888"
		}
	}'

### Querying Events
When querying for events the following fields are required:

| Field | Description | Required | Type |
|-------|-------------|	----------|------|
|**tags**|Tags to use to filter events.  These work as an **and**| **Yes**| dict|
|**eventTypes**|1 or more event types.  These work as an **or**|**Yes**| array |
|**start**|Start time in milliseconds |**Yes**| int |
|**end**|End time in milliseconds |No| int |

**e.g.:**

	curl -XGET http://<host>/api/annotations -H "Content-Type: application/json" -d '{
		"tags": {
			"host": "foo.bar.com",
		},
		"evenTypes": ["Release", "Maintenance"],
		"start": 1404264459507508
	}'
