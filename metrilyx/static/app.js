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
			.when('/:pageId/:graphId', {
				templateUrl: 'partials/adhoc-graph.html',
				controller: 'adhocGraphController'
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
			if(outstr === "") return "Tags:";
			return outstr.replace(/\, $/, "");
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
			if(query.rate) {
				return query.aggregator+":rate:"+query.metric;
			} else {
				return query.aggregator+":"+query.metric;
			}
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
	        		console.log(ctrl.$modelValue);
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
	        		var ival = $(elem).val();
	        		kv = ival.split("=");
	        		if(kv.length == 2) {
	        			var tvals = kv[1].split("|");
	        			var retstr = "";
	        			for(var i=0;i<tvals.length-1;i++) {
	        				retstr += tvals[i]+"|";
	        			}
	        			retstr += ui.item.value;
	        			$(elem).val(kv[0]+"="+retstr);
	        			event.preventDefault();
	        		}
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
			ctrl.$formatters.push(function(modelValue) {
				return "";
			});
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
});/*
app.directive('graphStatus', function() {
	return {
		restrict: 'A',
		require: '?ngModel',
		link: function(scope, elem, attrs, ctrl) {
			if(!ctrl) return;
			scope.$watch(function() {
				return ctrl.$modelValue;
			}, function(newVal, oldVal) {
				//if(!newVal.series) return;
				console.log(newVal.series.length);
			}, true);
		}
	};
});*/
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
	        		var tagstring = $(elem).val();
	        		ttagstr = getTagsString(tagstring, ui.item.value, "focus");
	        		if(ttagstr !== undefined) {
	        			$(elem).val(ttagstr);
	        			event.preventDefault();
	        		}
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
        		//console.log(mVal);
        		return mVal;
      		});	 
		}
	};
});
function getWebSocket() {
    if ("WebSocket" in window) {
       return new WebSocket(WS_URI);
    } else if ("MozWebSocket" in window) {
       return new MozWebSocket(WS_URI);
    } else {
       console.error("Browser does not support WebSockets!");
       return null;
    }
}
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
    //return tstr.replace(/\,$/,';');
    return tstr.replace(/\,$/,'');
}
/*
 * args: key1=val1,key2=val2
 * return: { key1: val1, key2: val2 }
 */
function commaSepStrToDict(tagsStr, delim) {
	if(delim === undefined) delim = "=";
	if(tagsStr == "") return {};
	d = {};
	kvpairs = tagsStr.replace(/;$/, '').split(",");
	//kvpairs = tagsStr.split(",");
	for(var i in kvpairs) {
		kv = kvpairs[i].split(delim);
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