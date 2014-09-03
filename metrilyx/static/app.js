
var app = angular.module('app', [
	'filters',
	'ngRoute',
	'ui.sortable',
	'timeframe',
	'graphing',
	'pageLayout',
	'heatmaps',
	'metrilyxControllers',
	'metrilyxServices'
]);

app.config(['$sceProvider', function($sceProvider) {
    $sceProvider.enabled(false);
}]);
/* Django specific */
app.config(['$httpProvider', function($httpProvider) {
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
}]);
app.config(['$routeProvider',
	function($routeProvider) {
		$routeProvider.
			when('/tutorials', {
				templateUrl: 'partials/tutorials.html',
				controller: 'staticsController'
			})
			.when('/graph', {
				templateUrl: 'partials/adhoc-graph.html',
				controller: 'adhocGraphController',
				reloadOnSearch: false
			})
			.when('/heatmap/:heatmapId', {
				templateUrl: 'partials/page.html',
				controller: 'pageController',
			})
			.when('/:pageId', {
				templateUrl: 'partials/page.html',
				controller: 'pageController',
				/*reloadOnSearch: false*/
			})
			.otherwise({
				redirectTo: '/graph'
			});
	}
]);

angular.module('filters',[]).
	filter('invert', function() { /* returns boostrap specific col-md-X */
		return function(input) {
			return !input;
		}
	}).filter('columnWidth', function() { /* returns boostrap specific col-md-X */
		return function(input) {
			return Math.floor(12/input);
		}
	}).filter('graphWidth', function() {
		return function(input) {
			return 0;
		}
	}).filter('dotsToDashes', function() {
		return function (text) {
			return text.replace(/\./g, "-");
		}
	}).filter('dateTime', function() {
		return function(epoch, millisecs) {
			try {
				var d;
				if(millisecs) {
					d = new Date(epoch);
				} else {
					d = new Date(epoch*1000);	
				}
				return d.toLocaleString("en-US", {hour12:false});
			} catch(e) {
				return epoch;
			}
		}

	}).filter('rateString', function() {
		return function(rate) {
			if(rate) return "rate:";
			return "";
		}
	}).filter('tagsString', function() {
		return function(obj, html) {
			return tagsString(obj, html);
		};
	}).filter('tagsLink', function() {
		return function(obj) {
		    var tstr = '?tags=';
		    for(var i in obj) {
			    tstr += i+":"+obj[i]+",";
			}
		    if(tstr == '?tags=') return "";
		    return tstr.replace(/\,$/,'%3B');
		}
	}).filter('metricQuery', function() {
		return function(query) {
			return metricQueryString(query);
		}
	}).filter('loadedSeries', function() {
		/*
			Returns number of queries loaded in highcharts.  In other words,
			which queries have returned data.
		*/
		return function(graph, inPercent) {
			//var n = 0;
			var l = 0;
			for(var i in graph.series) {
				if(graph.series[i].status !== 'querying') l++;
			}
			if(inPercent) return (l/graph.series.length)*100;
			return l;
		}
	});

app.directive('eventTypes', function() {
	return {
		restrict: 'A',
		require: '?ngModel',
		link: function(scope, elem, attrs, ctrl) {
			
			if(!ctrl) return;
			
			ctrl.$formatters.push(function(modelValue){return "";});
			ctrl.$parsers.unshift(function(viewValue){return ctrl.$modelValue;});
			
			$(elem).autocomplete({
				/*source: ANNO_EVENT_TYPES,*/
				source: function(request, response) {
	            	$.getJSON('/api/search/event_types?q='+request.term, 
	            		function(a,b,c) {
		            		for(var o in a) {
		            			a[o].label = a[o].name;
		            			a[o].value = a[o].name;
		            		}
		            		response(a);
	            	});
	        	},
				messages: {
	            	noResults: '',
	            	results: function() {}
	        	},
	        	minLength:1,
	        	select: function( event, ui ) {
	        		for(var i in ctrl.$modelValue) {
	        			if(ctrl.$modelValue[i] === ui.item.value) {
	        				$(elem).val('');
	        				event.preventDefault();	
	        				return;	
	        			}
	        		}
	        		scope.$apply(ctrl.$modelValue.push(ui.item.value));
	        		$(elem).val('');
	        		event.preventDefault();
	        	}
			});
			$(elem).keyup(function(e) {
				if(e.keyCode === 13) {
					// clear input & close autocomplete on 'enter' //
					$(elem).val('');
					$(elem).autocomplete('close');	
				}
			});
		}
	};
});

app.directive('tagkeyvalue', function() {
	return {
		restrict: 'A',
		require: '?ngModel',
		link: function(scope, elem, attrs, ctrl) {
			if(!ctrl) return;

			$(elem).attr('placeholder', 'tagkey=tagvalue');
			$(elem).autocomplete({
				source: function(request, response) {
					kvpairs = request.term.split(",");
					lastKvPair = kvpairs[kvpairs.length-1].split("=");
	            	var stype, q;
	            	if(lastKvPair.length <= 1) {
	            		stype = "tagk";
	            		q = lastKvPair[0];
	            	} else {
	            		stype = "tagv";
	            		tvals = lastKvPair[1].split("|");
	            		q = tvals[tvals.length-1];
	            		if(q === '') return;
	            	}
	            	$.getJSON('/api/search/'+stype,'q='+q, response);
	        	},
	        	messages: {
	            	noResults: '',
	            	results: function() {}
	        	},
	        	minLength:1,
	        	select: function( event, ui ) {
	        		var ival = $(elem).val();
	        		kv = ival.split("=");
	        		if(kv.length == 1) {
	        			$(elem).val(ui.item.value+"=");
	        			return false;
	        		} else if(kv.length == 2) {
	        			var tvals = kv[1].split("|");
	        			var retstr = "";
	        			for(var i=0;i<tvals.length-1;i++) {
	        				retstr += tvals[i]+"|";
	        			}
	        			retstr += ui.item.value;
	        			
	        			// this throws en error due to | character //
	        			scope.$apply(ctrl.$modelValue[kv[0]] = retstr);
	        			
	        			$(elem).val('');
	        			event.preventDefault();
	        			//return false;	
	        		}
	        	},
	        	focus: function( event, ui ) {
	        		//var ival = $(elem).val();
	        		//kv = ival.split("=");
	        		//if(kv.length == 2) {
	        		//	var tvals = kv[1].split("|");
	        		//	var retstr = "";
	        		//	for(var i=0;i<tvals.length-1;i++) {
	        		//		retstr += tvals[i]+"|";
	        		//	}
	        		//	retstr += ui.item.value;
	        		//	$(elem).val(kv[0]+"="+retstr);
	        			event.preventDefault();
	        		//}
	        	}
			});
			$(elem).keyup(function(e) {
				// clear input & close autocomplete on 'enter' //
				if(e.keyCode === 13) {
					var ival = $(elem).val();
					var arr = ival.split("=");
					if(arr.length == 2 && arr[1] !== "") {
						$(elem).val('');
						$(elem).autocomplete('close');	
					}
				}
			});
			// model --> view
			ctrl.$formatters.push(function(modelValue) { return ""; });
			// view --> model
			ctrl.$parsers.unshift(function(viewValue) {
				var kv = viewValue.split("=");
				if(kv.length == 1) {
					ctrl.$setValidity('tagkeyvalue', false);
					return ctrl.$modelValue;
				} else if(kv.length == 2) {
					if(kv[1] === undefined || kv[1] === ''){
						ctrl.$setValidity('tagkeyvalue', false);
						return ctrl.$modelValue;
					}
					ctrl.$setValidity('tagkeyvalue', true);
					var obj = ctrl.$modelValue;
					obj[kv[0]] = kv[1];
					//console.log();
					return obj;
				} else {
					ctrl.$setValidity('tagkeyvalue', false);
					return ctrl.$modelValue;
				}
			});
		}
	};
});
// page id validator //
app.directive('pageId', function() {
	return {
		restrict: 'A',
		require: '?ngModel',
		link: function(scope, elem, attrs, ctrl) {
			if(!ctrl) return;
			// view -- > model //
			ctrl.$parsers.unshift(function(viewValue) {
				if(viewValue == "") {
					ctrl.$setValidity('pageId', false);
					return ctrl.$modelValue;
				}
				if(viewValue.search(/(\.|\s|\\|\/)/) > 0) {
					ctrl.$setValidity('pageId', false);
					setGlobalAlerts({
						error: "Invalid ID",
						message:"ID's cannot contain '.', '\\', '/', and spaces"
					});
					flashAlertsBar();
					return ctrl.$modelValue;
				} else {
					ctrl.$setValidity('pageId', true);
					return viewValue;
				}
			});
		}
	};
});
app.directive('globalAnnotations', function() {
	return {
		restrict: 'A',
		require: '?ngModel',
		link: function(scope, elem, attrs, ctrl) {
			
			if(!ctrl) return;
			var currTimer;
			
			function getAnnoQuery(sVal, timeWindow) {
				
				annoq = {
					'annoEvents': {
						'eventTypes': sVal.eventTypes,
						'tags': sVal.tags
					},
					'_id': 'annotations'
				};

				if(timeWindow && timeWindow.start) return $.extend(timeWindow, annoq);
				else return $.extend(scope.getTimeWindow(), annoq);
			}
			
			function hasOptions(annoOptions) {
				return (annoOptions.eventTypes.length > 0) 
					&& (Object.keys(annoOptions.tags).length > 0);
			}

			function getUpdates() {

				if(scope.updatesEnabled) {
					if(ctrl.$modelValue && hasOptions(ctrl.$modelValue)) {

						q = getAnnoQuery(ctrl.$modelValue, {
							'start': Math.floor(((new Date()).getTime() - ANNO_FETCH_TIME_WIN)/1000)
						});

						scope.requestData(q);
					}
				}

				if(currTimer) clearTimeout(currTimer);
				currTimer = setTimeout(function() { 
					getUpdates();
				}, ANNO_POLL_INTERVAL-1000);
			}

			scope.$watch(function() {
				return ctrl.$modelValue;
			}, function(newVal, oldVal) {
				
				if(!newVal) return;
				
				if(!hasOptions(newVal)) return;
				
				// load, reload, dispatched, dispatching //
				if(newVal.status === 'load' || newVal.status === 'reload') {
					
					scope.requestData(getAnnoQuery(newVal));
					setTimeout(function() {getUpdates();}, ANNO_FETCH_TIME_WIN);
				}
			}, true);
		}
	};
});
app.directive('tooltipArrow', function() {
	return {
		restrict: 'A',
		require: '?ngModel',
		link: function(scope, elem, attrs, ctrl) {
			
			if(!ctrl) return;

			var canvas = document.createElement('canvas');
			canvas.width = attrs.width;
			canvas.height = attrs.height;
			
			$(elem).append(canvas);
			drawTriOnCanvas(canvas, attrs.color, attrs.direction);
		}
	}
});
/*
 * Parse tags object to 'tag1=val1,tag2=val2;'
 * Error checking and validity setting.
 */
app.directive('keyValuePairs', function() {
	return {
		restrict: 'A',
		require: '?ngModel',
		link: function(scope, elem, attrs, ngModel) {
			// no model - do nothing
			if(!ngModel) return;

			function getTagsString(tagstr, lastVal, eventType) {
				tkvs = tagstr.split(",");
        		var baseTags = "";
        		for(var i=0;i<tkvs.length-1;i++) {
    				baseTags += tkvs[i]+",";
        		}
        		kv = tkvs[tkvs.length-1].split("=");
        		if(kv.length == 1) {
        			if(eventType === 'select') return baseTags+lastVal+"=";
        			return baseTags+lastVal;
        			//event.preventDefault();
        		} else if(kv.length == 2) {
        			var tvals = kv[1].split("|");
        			var retstr = "";
        			for(var i=0;i<tvals.length-1;i++) {
        				retstr += tvals[i]+"|";
        			}
        			retstr += lastVal;
        			return baseTags+kv[0]+"="+retstr;
        		}
			}
			$(elem).attr('placeholder', 'tag1=val1,tag2=val2');
			$(elem).autocomplete({
				source: function(request, response) {
					kvpairs = request.term.split(",");
					lastKvPair = kvpairs[kvpairs.length-1].split("=");
	            	var stype, q;
	            	if(lastKvPair.length <= 1) {
	            		stype = "tagk";
	            		q = lastKvPair[0];
	            	} else {
	            		stype = "tagv";
	            		tvals = lastKvPair[1].split("|");
	            		q = tvals[tvals.length-1];
	            		if(q === '') return;
	            	}
	            	$.getJSON('/api/search/'+stype,'&q='+q, response);
	        	},
	        	messages: {
	            	noResults: '',
	            	results: function() {}
	        	},
	        	minLength:1,
	        	select: function(event, ui) {
	        		var tagstring = $(elem).val();
	        		ttagstr = getTagsString(tagstring, ui.item.value, "select");
	        		if(ttagstr !== undefined) {
						ngModel.$setViewValue(ttagstr);
						$(elem).val(ttagstr);
	        			event.preventDefault();	
	        		}
	        	},
	        	focus: function(event, ui) {
	        		//var tagstring = $(elem).val();
	        		//ttagstr = getTagsString(tagstring, ui.item.value, "focus");
	        		//if(ttagstr !== undefined) {
	        		//	$(elem).val(ttagstr);
	        			event.preventDefault();
	        		//}
	        	}
			});
			// model --> view
			ngModel.$formatters.push(dictToCommaSepStr);
			// view --> model
			ngModel.$parsers.unshift(function(viewValue) {
				//console.log(viewValue);
				if(viewValue == "") {
					ngModel.$setValidity('keyValuePairs', true);
          			return {};
				}

				a = viewValue.split(",");
				var mVal = {};
				for (var i in a) {
					pair = a[i].split("=");
					// return original model value if user input is invalid
					// this is to ensure active queries keep running
					if(pair.length != 2) {
						ngModel.$setValidity('keyValuePairs', false);
						return ngModel.$modelValue;
					} else if(pair[1] == "" || pair[1] == undefined) {
						ngModel.$setValidity('keyValuePairs', false);
          				return ngModel.$modelValue;
					} else {
						mVal[pair[0]] = pair[1];
					}
				}
        		ngModel.$setValidity('keyValuePairs', true);
        		return mVal;
      		});	 
		}
	};
});

app.factory("AnnotationOptions", function() {

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

app.factory("TimeWindow", function() {
	
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
app.factory("ComponentTemplates", function() {
	
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

app.factory("WebSocketDataProvider", function() {
	
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

function getLoadedSeries(graph, inPercent) {
	hcg = $("[data-graph-id='"+graph._id+"']").highcharts();
	if(hcg === undefined) return 0;
	var cnt = 0;
	if(graph.graphType === 'pie') {
		for(var i in graph.series) {
			for(var j in hcg.series) {
				for(var d in hcg.series[j].data) {
					if(equalObjects(hcg.series[j].data[d].query,graph.series[i].query)) {
						cnt++;
						break;
					}
				}
			}
		}
	} else {
		for(var i in graph.series) {
			for(var j in hcg.series) {
				//console.log(hcg.series[j].options.query,graph.series[i].query);
				//q = $.extend({}, graph.series[i].query);
				// $.extend(true, q.tags, globalTags);
				if(equalObjects(hcg.series[j].options.query,graph.series[i].query)) {
					cnt++;
					break;
				}
			}
		}
	}
	//console.log(cnt);
	if(inPercent) return (cnt/graph.series.length)*100;
	return cnt;
}

function metricQueryString(query) {
	if(query.rate) {
		return query.aggregator+":rate:"+query.metric;
	} else {
		return query.aggregator+":"+query.metric;
	}
}

function tagsString(obj, html) {
	html=true;
	var outstr = "";
	if(html) {
		for(var k in obj) {
			outstr += k+"="+obj[k]+", ";
		}
	} else {
		for(var k in obj) {
			outstr += k+"="+obj[k]+", ";
		}
	}
	if(outstr === "") return "";
	return "{ " + outstr.replace(/\, $/, "") + " }"; 
};

/*
 * args: { key1: val1, key2: val2 }
 * return: key1=val1,key2=val2
 */
function dictToCommaSepStr(obj, delim) {
	if(delim === undefined) delim = "="; 
	tstr = '';
    for(var i in obj) {
        tstr += i+delim+obj[i]+",";
    }
    return tstr.replace(/\,$/,'');
}
/*
 * args: key1=val1,key2=val2
 * return: { key1: val1, key2: val2 }
 */
function commaSepStrToDict(tagsStr, delim) {
	//if(delim === undefined) delim = "=";
	if(tagsStr == "") return {};
	var d = {};
	kvpairs = tagsStr.replace(/;$/, '').split(",");
	for(var i in kvpairs) {
		kv = kvpairs[i].split(/:|=/);
		if(kv.length != 2) continue;
		if(kv[0] == "") continue;
		d[kv[0]] = kv[1];
	}
	if(equalObjects(d,{})) return;
	return d;
}
function clearAllTimeouts() {
	//console.log("Clearing timeouts");
	var id = window.setTimeout(function() {}, 0);
	while (id--) {
		// will do nothing if no timeout with id is present //
		window.clearTimeout(id); 
	}
}
function modelManagerErrback(error) {
	if(error.data && Object.prototype.toString.call(error.data) === '[object Object]')
		setGlobalAlerts({
			'error': error.status,
			'message': "code: "+error.status+" "+JSON.stringify(error.data)
		});
	else
		setGlobalAlerts({
			'error': error.status,
			'message': "code: "+error.status+" "+error.data
		});
	flashAlertsBar();
}
function setGlobalAlerts(rslt) {
	if(rslt.error) {
		$('#global-alerts').removeClass('alert-success')
							.addClass('alert-danger')
							.html("<b>Error: </b>"+rslt.message);
	} else {
		$('#global-alerts').removeClass('alert-danger')
							.addClass('alert-success')
							.html("<b>Success: </b>"+rslt.message);
	}
}
function flashAlertsBar() {
	var ga = $('#global-alerts');
	$(ga).fadeIn(500);
	setTimeout(function() {
		$(ga).fadeOut(1000);
	}, 3000);
}
// wrapper to drawTriOnCanvas //
function drawTriBySelector(selector, color, direction) {
	direction = typeof direction !== 'undefined' ? direction : 'up';
	var canvas = $(selector)[0];
	drawTriOnCanvas(canvas, color, direction);
}
// draw triangle on canvas //
function drawTriOnCanvas(canvas, color, direction) {
	if (canvas.getContext){
	    var ctx = canvas.getContext('2d');
	    ctx.beginPath();
	    switch(direction) {
	    	case 'left':
				ctx.moveTo(canvas.width,0);
			    ctx.lineTo(canvas.width,canvas.height);
			    ctx.lineTo(0,canvas.height/2);
	    		break;
	    	default:
			    ctx.moveTo(canvas.width/2,0);
			    ctx.lineTo(canvas.width,canvas.height);
			    ctx.lineTo(0,canvas.height);
			    break;
		}
	    ctx.fillStyle = color;
	    ctx.fill();
	}
}
function submitAnalytics(args) {
	if(SITE_ANALYTICS.enabled) SITE_ANALYTICS.send(args);
}