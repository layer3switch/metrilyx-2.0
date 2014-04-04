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
				redirectTo: '/new'
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
		return function(epoch) {
			try {
				d = new Date(epoch*1000);
				return d.toLocaleString("en-US", {hour12:false});
			} catch(e) {
				return epoch;
			}
		}
	}).filter('tagsLink', function() {
		return function(obj) {
		    var tstr = '?tags=';
		    for(var i in obj) {
			    tstr += i+":"+obj[i]+",";
			}
		    if(tstr == '?tags=') return "";
		    return tstr.replace(/\,$/,'%3B');
		}
	});
app.directive('stopEvent', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attr) {
            element.bind(attr.stopEvent, function (e) {
                e.stopPropagation();
            });
        }
    };
});
/*
 *
 * Adds global tags to URL
 *
 */
 /*
app.directive('globalTags', [ '$location', function($location) {
	return {
		restrict: 'A',
		require: '?ngModel',
		link: function(scope, elem, attrs, ctrl) {
			if(!ctrl) return;
			scope.$watch(function() {
				return ctrl.$modelValue;
			}, function(newVal, oldVal) {
				if(equalObjects(newVal, oldVal)) return;
				tagsLoc = dictToCommaSepStr(newVal);
				tmp = $location.search();
				if(tagsLoc == "") {
					if(tmp.tags) {
						delete tmp.tags;
						$location.search(tmp);
					}
					return;
				}
				$.extend(tmp, {tags: tagsLoc}, true);
				$location.search(tmp);
				//console.log(scope.globalTags);
				//console.log(newVal);
				scope.globalTagsChanged();
			},true);
			
		}
	};
}]);
*/
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

			$(elem).attr('placeholder', 'tag1:val1,tag2:val2;');
			$(elem).autocomplete({
				source: function(request, response) {
					kvpairs = request.term.split(",");
					lastKvPair = kvpairs[kvpairs.length-1].split(":");
	            	var stype, q;
	            	if(lastKvPair.length <= 1) {
	            		stype = "tagk";
	            		q = lastKvPair[0];
	            	} else {
	            		stype = "tagv";
	            		q = lastKvPair[1];
	            	}
	            	$.getJSON('/api/search','type='+stype+'&q='+q, response);
	        	},
	        	messages: {
	            	noResults: '',
	            	results: function() {}
	        	},
	        	minLength:1,
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
				if(viewValue.search(/;$/) < 0 ) {
					ngModel.$setValidity('keyValuePairs', false);
					return ngModel.$modelValue;
				}
				a = viewValue.replace(/;$/,'').split(",");
				var mVal = {};
				for (var i in a) {
					pair = a[i].split(":");
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
/*
 * args: { key1: val1, key2: val2 }
 * return: key1:val1,key2:val2
 */
function dictToCommaSepStr(obj) {
	//console.log('called', obj);
    tstr = '';
    for(var i in obj) {
        tstr += i+":"+obj[i]+",";
    }
    //return tstr;
    return tstr.replace(/\,$/,';');
}
/*
 * args: key1=val1,key2=val2
 * return: { key1: val1, key2: val2 }
 */
function commaSepStrToDict(tagsStr) {
	d = {};
	kvpairs = tagsStr.replace(/;$/, '').split(",");
	for(var i in kvpairs) {
		kv = kvpairs[i].split(":");
		d[kv[0]] = kv[1];
	}
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
function flashAlertsBar() {
	$('#global-alerts').fadeIn(500);
		setTimeout(function() {
			$('#global-alerts').fadeOut(1000);
		}, 3000);
}