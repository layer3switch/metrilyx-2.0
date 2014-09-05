var metrilyxHelperFactories = angular.module("metrilyxHelperFactories", []);

metrilyxHelperFactories.factory("ComponentTemplates", function() {
	
	var ComponentTemplates = function(scope) {
		
		var templates = {
			pageMastHtml	: connectionPool.nextConnection()+"/partials/page-mast.html",
		};

		function initialize() {
			if(scope.modelType == "adhoc" || scope.modelType == "") {
				
				$.extend(templates, {
					editPanelHtml			: connectionPool.nextConnection()+"/partials/edit-panel.html",
					thresholdsHtml 			: connectionPool.nextConnection()+"/partials/thresholds.html",
					pageHeaderHtml 			: connectionPool.nextConnection()+"/partials/page-header.html",
					annoControlsHtml		: connectionPool.nextConnection()+"/partials/global-anno-controls.html",
					eventAnnoDetailsHtml 	: connectionPool.nextConnection()+"/partials/event-anno-details.html",
					metricOperationsHtml	: connectionPool.nextConnection()+"/partials/metric-operations.html",
					pageFooterHtml			: connectionPool.nextConnection()+"/partials/page-footer.html",
					graphFooterHtml			: connectionPool.nextConnection()+"/partials/graph-footer.html"
				}, true);

				if(scope.modelType == "adhoc") {
					
					templates['queryEditorHtml'] = connectionPool.nextConnection()+"/partials/adhocgraph-query-editor.html";
				} else {
					
					$.extend(templates, {
						queryEditorHtml		: connectionPool.nextConnection()+"/partials/pagegraph-query-editor.html",
						graphControlsHtml	: connectionPool.nextConnection()+"/partials/graph-controls.html",
						graphHtml 			: connectionPool.nextConnection()+"/partials/graph.html",
						podHtml 			: connectionPool.nextConnection()+"/partials/pod.html",
						heatGraphHtml 		: connectionPool.nextConnection()+"/partials/heat-graph.html"
					}, true);
				}
			}
			$.extend(scope, templates, true);
		}

		initialize();
	}
	return (ComponentTemplates);
});


metrilyxHelperFactories.factory("CtrlCommon", ['Metrics', 'Schema', function(Metrics, Schema) {
	
	var CtrlCommon = function(scope, location, route) {

		var timerSearchForMetric;

		function setUpdatesEnabled(value) {
			scope.updatesEnabled = value;
		}

		function updateTagsOnPage(obj) {
			var top = scope.tagsOnPage;
			for(var k in obj) {
				if(Object.prototype.toString.call(obj[k]) === '[object Array]') {
					if(top[k] == undefined) {
						top[k] = obj[k];
						top[k].push("*");
					} else {
						for(var i=0; i < obj[k].length; i++) {
							if(top[k].indexOf(obj[k][i]) < 0) top[k].push(obj[k][i]);
						}
					}
				} else {
					if(top[k] == undefined) {
						top[k] = ["*"];
						top[k].push(obj[k]);
					} else if(top[k].indexOf(obj[k]) < 0) {
						top[k].push(obj[k]);
					}
				}
			}
			scope.tagsOnPage = top;
		}

		function searchForMetric(args) {
			
			if (timerSearchForMetric) clearTimeout(timerSearchForMetric);

			var myThis = this;
			timerSearchForMetric = setTimeout(function(){
				
				var qstr;
				if(args && args !== "") qstr = args;
				if(myThis.metricQuery && myThis.metricQuery !== "") qstr = myThis.metricQuery;
				if(qstr == "" || qstr == undefined) return;
				
				Metrics.suggest(qstr, function(result) {
					
					scope.metricQuery = qstr;
					Schema.get({modelType:'metric'}, function(graphModel) {
						
						var arr = [];
						for(var i in result) {
							obj = JSON.parse(JSON.stringify(graphModel));
							obj.alias = result[i];
							obj.query.metric = result[i];
							arr.push(obj);
						}
						
						scope.metricQueryResult = arr;
					});
				});
			}, 1000);
		}

		function loadHome() {
			location.path('/graph').search({});
			route.reload();
		}

		scope.loadHome 			= loadHome;
		scope.setUpdatesEnabled = setUpdatesEnabled;
		scope.updateTagsOnPage 	= updateTagsOnPage;
		scope.searchForMetric 	= searchForMetric;

	}

	return (CtrlCommon);
}]);


metrilyxHelperFactories.factory("AnnotationOptions", function() {

	var AnnotationOptions = function(scope, routeParams, location, EventTypesSvc) {
		
		var options = { 
			'globalAnno': {'eventTypes':[], 'tags':{}, 'status': null },
			'selectedAnno': {},
		};

		function initialize() {
			
			if(routeParams.annotationTypes && routeParams.annotationTags) {
				
				try {

					$.extend(true, options['globalAnno'], {
						'eventTypes': routeParams.annotationTypes.split(/\|/),
						'tags': commaSepStrToDict(routeParams.annotationTags),
					}, true);
				} catch(e) { console.warning("failed to parse annotation data", e); }
			}

			if(options.globalAnno.eventTypes.length > 0 && Object.keys(options.globalAnno.tags).length > 0)
				options.globalAnno['status'] = 'load';
			
			// apply this first as the next call will take some time
			$.extend(scope, options, true);

			// get all available event types
			EventTypesSvc.listTypes(function(rslt) {
				
				var evtTypeList = [];
				for(var i in rslt) {
					
					if(rslt[i].name === undefined || options.globalAnno.eventTypes.indexOf(rslt[i].name) >= 0) continue;
					evtTypeList.push(rslt[i].name);
				}

				options['annoEventTypes'] = evtTypeList;
				
				$.extend(scope, {annoEventTypes: evtTypeList}, true);
			});
		}


		this.applyAnnotationOptions = function() {
			
			if(scope.modelType == "adhoc") {
				
				scope.reloadGraph();
				scope.globalAnno.status = 'reload';
				
				$('.graph-control-details.global-anno').hide();
			}

			var tmp = location.search();
			tmp.annotationTypes = scope.globalAnno.eventTypes.join("|");
			tmp.annotationTags = dictToCommaSepStr(scope.globalAnno.tags, ":");
			location.search(tmp);
		}

		initialize();
	}
	return (AnnotationOptions);
});


metrilyxHelperFactories.factory("TimeWindow", function() {
	
	var TimeWindow = function(scope, routeParams) {
		
		var attributes = {
			'timeType': '1h-ago',
			'startTime': '1h-ago',
			'updatesEnabled': true
		};
		function initialize() {
			
			if(scope.modelType === "adhoc") attributes['updatesEnabled'] = false;
			
			if(routeParams.start) {

				if(routeParams.end) {
					
					$.extend(true, attributes, {
						'endTime': parseInt(routeParams.end),
						'timeType': "absolute",
						'updatesEnabled': false
					}, true);
				} else {
					
					attributes['timeType'] = routeParams.start;
				}
				if(Object.prototype.toString.call(routeParams.start) === '[object String]' 
													&& routeParams.start.match(/-ago$/)) {
					attributes['startTime'] = routeParams.start;
				} else {
					attributes['startTime'] = parseInt(routeParams.start);
				}
			}
			$.extend(scope, attributes, true);
		}

		this.getTimeFrame = function(inMilli) {
			if(scope.timeType == "absolute"){
				if(scope.endTime) {
					if(inMilli) {
						return {
							end: scope.endTime*1000,
							start: scope.startTime*1000};
					}
					return {
						end: scope.endTime,
						start: scope.startTime
					};
				}
				if(inMilli) {
					return {
						start: scope.startTime*1000,
						end: Math.ceil((new Date()).getTime())
					};
				}
				return {
					start: scope.startTime,
					end: Math.ceil((new Date()).getTime()/1000)
				};
			} else {
				if(inMilli) {
					return {
						start: (Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime(scope.timeType)))*1000,
						end: Math.ceil((new Date()).getTime())
					};
				} else {
					return {
						start: Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime(scope.timeType)),
						end: Math.ceil((new Date()).getTime()/1000)
					};
				}
			}
		}

		this.setAttribute = function(attr, value) {
			
			switch(attr) {
				
				case "timeType":
					scope.timeType = value;
					break;

				case "startTime":
					if(scope.endTime && (value >= scope.endTime)) return;
					scope.startTime = value;
					break;

				case "endTime":
					if(scope.startTime && (value <= scope.startTime)) return;
					scope.endTime = value;
					break;

				default:
					break;
			}
		}

		initialize();
	};
	return (TimeWindow);
});


metrilyxHelperFactories.factory("WebSocketDataProvider", function() {
	
	var WebSocketDataProvider = function(scope) {
		
		var queuedReqs = [];
		var wssock = null;
		var modelGraphIdIdx = {};


		function getWebSocket() {
			if ("WebSocket" in window) return new WebSocket(WS_URI);
		    else if ("MozWebSocket" in window) return new MozWebSocket(WS_URI);
		    else return null;	
		}

		function onOpenWssock() {
			console.log("Connected. Extensions: [" + wssock.extensions + "]");
			console.log("Submitting queued requests:", queuedReqs.length);
			while(queuedReqs.length > 0) wssock.send(queuedReqs.shift());
		}

		function onCloseWssock(e) {
	     	console.log("Disconnected (clean=" + e.wasClean + ", code=" + e.code + ", reason='" + e.reason + "')");
	    	wssock = null;
	   	}
	   	function onMessageWssock(e) {
       		var data = JSON.parse(e.data);
       		if(data.error) {

       			setGlobalAlerts(data);
       			flashAlertsBar();
       		} else if(data.annoEvents) {
       			// annotations //
   				scope.$apply(function(){scope.globalAnno.status = 'dispatching'});
   				if(scope.modelType === 'adhoc') {
   					data._id = scope.graph._id;
   					var ce = new CustomEvent(data._id, {'detail': data });
   					wssock.dispatchEvent(ce);
   				} else {
   					for(var i in modelGraphIdIdx) {
	       				data._id = i;
	       				var ce = new CustomEvent(data._id, {'detail': data });
	       				wssock.dispatchEvent(ce);
       				}
   				}
       			scope.$apply(function(){scope.globalAnno.status = 'dispatched'});
       		} else {
       			// graph data //
	       		var ce = new CustomEvent(data._id, {'detail': data });
	       		wssock.dispatchEvent(ce);
       		}
		}
		function initializeWebSocket() {
			wssock = getWebSocket();
			if(wssock !== null) {
	    		wssock.onopen 		= onOpenWssock;
	   			wssock.onclose 		= onCloseWssock;
	   			wssock.onmessage 	= onMessageWssock;
	   		}
		}
		this.addGraphIdEventListener = function(graphId, funct) {
			wssock.addEventListener(graphId, funct);
			modelGraphIdIdx[graphId] = true;
			if(Object.keys(modelGraphIdIdx).length === scope.modelGraphIds.length) {
				// trigger annotation request as all graph elems are loaded //
				scope.globalAnno.status = 'load';
			}
		}
		this.removeGraphIdEventListener = function(graphId, funct) {
			if(wssock !== null) wssock.removeEventListener(graphId, funct);
		}
		this.requestData = function(query) {
	    	try {
				wssock.send(JSON.stringify(query));
	    	} catch(e) {
	    		
	    		if(e.code === 11) {
	    			queuedReqs.push(JSON.stringify(query));
	    		} else {
	    			//reconnect
	    			queuedReqs.push(JSON.stringify(query));
	    			initializeWebSocket();
	    		}
	    	}
	    }
	    this.closeConnection = function() {
	    	wssock.close();
	    }
	    initializeWebSocket();
	}
	return (WebSocketDataProvider);
});
