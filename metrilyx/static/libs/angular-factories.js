angular.module("metrilyxHelperFactories", [])
.factory("ComponentTemplates", function() {
	
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
})
.factory("CtrlCommon", ['Metrics', 'Schema', function(Metrics, Schema) {
	
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

		function disableDragDrop() {
			$('[ui-sortable]').each(function() {
				$(this).sortable({disabled: true});
			});
		}

		function enableDragDrop() {
			$('[ui-sortable]').each(function() {
				$(this).sortable({disabled: false});
			});
		}

		function loadHome() {
			location.path('/graph').search({});
			route.reload();
		}

		scope.disableDragDrop 	= disableDragDrop;
		scope.enableDragDrop	= enableDragDrop;
		scope.loadHome 			= loadHome;
		scope.setUpdatesEnabled = setUpdatesEnabled;
		scope.updateTagsOnPage 	= updateTagsOnPage;
		scope.searchForMetric 	= searchForMetric;

	}

	return (CtrlCommon);
}])
.factory("AnnotationOptions", function() {

	var AnnotationOptions = function(scope, routeParams, location, EventTypesSvc) {
		
		var scopeAttributes = {
			'globalAnno': {'eventTypes':[], 'tags':{}, 'status': null },
			'selectedAnno': {},
			'setAnnotations': applyAnnotationOptions
		};

		function initialize() {
			
			if(routeParams.annotationTypes && routeParams.annotationTags) {
				
				try {

					$.extend(true, scopeAttributes['globalAnno'], {
						'eventTypes': routeParams.annotationTypes.split(/\|/),
						'tags': commaSepStrToDict(routeParams.annotationTags),
					}, true);
				} catch(e) { console.warning("failed to parse annotation data", e); }
			}

			if(scopeAttributes.globalAnno.eventTypes.length > 0 && Object.keys(scopeAttributes.globalAnno.tags).length > 0)
				scopeAttributes.globalAnno['status'] = 'load';
			
			// Apply this first as the next call will take some time
			$.extend(scope, scopeAttributes, true);

			// Get all available event types
			EventTypesSvc.listTypes(function(rslt) {
				
				var evtTypeList = [];
				for(var i in rslt) {
					
					if(rslt[i].name === undefined || scopeAttributes.globalAnno.eventTypes.indexOf(rslt[i].name) >= 0) continue;
					evtTypeList.push(rslt[i].name);
				}

				$.extend(scope, {annoEventTypes: evtTypeList}, true);
			});
		}


		function applyAnnotationOptions() {
			
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
})
.factory("TimeWindow", function() {
	
	var TimeWindow = function(scope, routeParams) {
		var t = this;

		var scopeAttributes = {
			'timeType': '1h-ago',
			'startTime': '1h-ago',
			'updatesEnabled': true,
			'getTimeWindow': getTimeFrame,
			'setStartTime': setStartTime,
			'setEndTime': setEndTime
		};

		function initialize() {
			
			if(scope.modelType === "adhoc") scopeAttributes['updatesEnabled'] = false;
			
			if(routeParams.start) {

				if(routeParams.end) {
					
					$.extend(true, scopeAttributes, {
						'endTime': parseInt(routeParams.end),
						'timeType': "absolute",
						'updatesEnabled': false
					}, true);
				} else {
					
					scopeAttributes['timeType'] = routeParams.start;
				}
				if(Object.prototype.toString.call(routeParams.start) === '[object String]' 
													&& routeParams.start.match(/-ago$/)) {
					scopeAttributes['startTime'] = routeParams.start;
				} else {
					scopeAttributes['startTime'] = parseInt(routeParams.start);
				}
			}
			$.extend(scope, scopeAttributes, true);
		}

		function getTimeFrame(inMilli) {
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

		t.setAttribute = function(attr, value) {
			
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

		function setStartTime(sTime) {			
			t.setAttribute('startTime', sTime);
		}

		function setEndTime(eTime) {
			t.setAttribute('endTime', eTime);
		}

		initialize();
	};
	return (TimeWindow);
})
.factory("RouteManager", function() {
/* IN PROGRESS */
	var RouteManager = function(scope, routeParams) {

		var t = this;

		function setPageGlobalTags() {

			try { 
				scope.$parent.globalTags = routeParams.tags ? commaSepStrToDict(routeParams.tags) : {}; 
			} catch(e) {
				console.warn("Could not parse global tags!");
				scope.globalTags = {};
			}
		}

		function initialize() {
			
			var scopeOpts = {};

			if(scope.modelType === "adhoc") {

				scopeOpts.editMode = routeParams.editMode === "false" ? "" : " edit-mode";
			} else {

				
				scopeOpts.editMode = (!routeParams.editMode || routeParams.editMode === "false") ? scope.editMode = "" : " edit-mode";
				scopeOpts.editMode = routeParams.pageId == "new" ? " edit-mode" : "";
				// Parent global tags scope get's set so it cannot but coupled with the above logic and has to be separately. //
				setPageGlobalTags();
			}
			
			scopeOpts.updatesEnabled = scopeOpts.editMode === " edit-mode" ? false : true;

			$.extend(true, scope, scopeOpts, true);

		}

		function parseAdhocMetricParams() {

			var series = [];
			if(routeParams.m) {
				var metrics = Object.prototype.toString.call(routeParams.m) === '[object Array]' ? routeParams.m : [ routeParams.m ];
				for(var i=0; i < metrics.length; i++) {

					var arr = metrics[i].match(/^(.*)\{(.*)\}\{alias:(.*),yTransform:(.*)\}$/);
					var met = arr[1].split(":");

					var rate = met.length == 3 ? true: false;
					series.push({
						'alias': arr[3],
						'yTransform': arr[4],
						'query':{
							'aggregator': met[0],
							'rate': rate,
							'metric': met[met.length-1],
							'tags': commaSepStrToDict(arr[2])
						}
					});
				}
			}
			return series;
		}

		function parseAdhocThresholdParams() {
			if(routeParams.thresholds) {
				try {
					var arr = routeParams.thresholds.split(":");
					if(arr.length == 3) {
						var dmm = arr[0].split("-");
						var wmm = arr[1].split("-");
						var imm = arr[2].split("-");
						return {
							'danger': 	{ max:dmm[0], min:dmm[1] },
							'warning': 	{ max:wmm[0], min:wmm[1] },
							'info': 	{ max:imm[0], min:imm[1] }
						};
					}
				} catch(e) {
					console.warn("cannot set thresholds", e);
				}
			}
			return {
				danger: {max:'', min:''},
				warning: {max:'', min:''},
				info: {max:'', min:''}
			};
		}

		function parseAdhocParams() {
			
			var gmodel = {};
			gmodel.size 		= routeParams.size ? routeParams.size : ADHOC_DEFAULT_GRAPH_SIZE;
			gmodel.thresholds 	= parseAdhocThresholdParams();
			gmodel.graphType 	= routeParams.type ? routeParams.type: ADHOC_DEFAULT_GRAPH_TYPE;
			gmodel.series 		= parseAdhocMetricParams();

			return gmodel;
		}

		function parsePageParams() {
			
			var out = {};
			out.editMode 		= routeParams.pageId == "new" ? " edit-mode" : "";	
			out.updatesEnabled 	= editMode == " edit-mode" ? false : true;

			
			return out;
		}

		function getParams() {
			
			switch(scope.modelType) {
				case "adhoc":
					return parseAdhocParams();
					break;
				default:
					return parsePageParams();
					break;
			}
		}

		initialize();

		t.getParams = getParams;

	}
	return (RouteManager);
})
.factory("URLSetter", function() {
	
	var URLSetter = function(scope, location) {
		var t = this;

		function parseMetrics(obj) {

			var outarr = [];
			for(var s=0; s < obj.series.length; s++) {
				
				serie = obj.series[s];
				q = serie.query;
				
				var params = q.aggregator+":";
				if(q.rate) params += "rate:";
				
				params += q.metric+"{"
				tagstr = "";
				for(var tk in q.tags) {

					if(tk == "") continue;
					tagstr += tk+":"+q.tags[tk]+","
				}

				tagstr.replace(/\,$/,'');
				if(tagstr !== "") params += tagstr;

				params += "}{alias:"+serie.alias;
				params += ",yTransform:"+serie.yTransform+"}";
				outarr.push(params);
			}
			return outarr;
		}

		function setURL(obj) {

			var srch = {
				'm'			: parseMetrics(obj),
				'thresholds': scope.graph.thresholds.danger.max + "-" + scope.graph.thresholds.danger.min +
								":"+scope.graph.thresholds.warning.max + "-" + scope.graph.thresholds.warning.min +
								":"+scope.graph.thresholds.info.max + "-" + scope.graph.thresholds.info.min,
				'type'		: scope.graph.graphType,
				'size'		: scope.graph.size,
			};

			if(scope.editMode === "") srch.editMode = "false";

			if(scope.timeType === "absolute") {
				
				srch.start = scope.startTime;
				if(scope.endTime) srch.end = scope.endTime;
			} else {
				
				srch.start = scope.timeType;
			}

			var uAnnoTagsStr = dictToCommaSepStr(scope.globalAnno.tags, ":");

			if(scope.globalAnno.eventTypes.length > 0 && uAnnoTagsStr != "") {
				
				srch.annotationTypes = scope.globalAnno.eventTypes.join("|");
				srch.annotationTags = uAnnoTagsStr;
			}

			location.search(srch);
		}

		t.setURL = setURL;
	};

	return (URLSetter);
})
.factory("WebSocketDataProvider", function() {
	
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
