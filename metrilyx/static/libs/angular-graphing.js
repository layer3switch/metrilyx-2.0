
function relativeToAbsoluteTime(timeStr) {
	numUnit = timeStr.match(/([0-9]+)(m|h|w)-ago$/);
	num = parseInt(numUnit[1]);
	switch(numUnit[2]) {
		case "m":
			return num*60;
			break;
		case "h":
			return num*3600;
			break;
		case "w":
			return num*86400;
			break;
		default:
			break;
	}
}
angular.module('pageLayout', [])
	.directive('pod', ['Schema', function(Schema) {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;

				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(newValue, oldValue) {
					// enable inputs in edit mode //
					if(scope.editMode == " edit-mode") {
						$(elem).find("input[ng-model*=name]").each(function() {
							$(this).attr('disabled', false);
						});
					}
					// populate graphs array with an empty stub graph //
					if(newValue.graphs && newValue.graphs.length <= 0) {
						Schema.get({modelType: 'graph'}, function(result) {
							ngModel.$modelValue.graphs.push(result);
						});
					};
					if(oldValue.orientation != newValue.orientation) {
						console.log("orientation changed.");
						for(var g in newValue.graphs) {
							if(newValue.graphs[g].series.length <=0 ) continue;
							console.log("re-rendering", newValue.graphs[g]._id);
							q = scope.baseQuery(newValue.graphs[g]);
							q.series = newValue.graphs[g].series;
							scope.reloadGraph(q);
						}
					}
				}, true);
			}
		};
	}])
	.directive('graphs', [function() {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;
				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(newValue, oldValue) {
					// lock graphs if only 1 on pod //
					if(newValue.length <= 1) $(elem).sortable({disabled: true});
				}, true);
			}
		};
	}])
	.directive('column', [function() {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;

				$(elem).dblclick(function(evt) {
					if(scope.editMode == "") return;
					evt.stopPropagation();
					if(! $(evt.target).hasClass('layout-column')) return;

					//ypos = evt.pageY-evt.currentTarget.offsetTop;
					if($(evt.target).hasClass('column-handle')) {
						ngModel.$modelValue.unshift(
							JSON.parse(JSON.stringify(scope.droppablePodSchema[0])));
					} else {
						console.log('bottom')
						ngModel.$modelValue.push(
							JSON.parse(JSON.stringify(scope.droppablePodSchema[0])));
					}
					scope.$apply();
				});
				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(newValue, oldValue) {
					if(scope.editMode == " edit-mode") {
						$(elem).find('.graph-metrics-panel').each(function() {
							$(this).collapse('show');
						});
						scope.enableDragDrop();
					} else {
						scope.disableDragDrop();
					}
				}, true);
			}
		};
	}])
	.directive('row', [function() {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;

				$(elem).dblclick(function(evt) {
					if(scope.editMode == "") return;
					if(evt.offsetX < $(evt.currentTarget).width()/2) {
						ngModel.$modelValue.unshift(
							JSON.parse(JSON.stringify(scope.droppablePodSchema)));
					} else {
						ngModel.$modelValue.push(
							JSON.parse(JSON.stringify(scope.droppablePodSchema)));
					}
					scope.$apply();
					evt.stopPropagation();
				});
				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(newValue, oldValue) {
					// remove empty rows //
					for(var i in newValue) {
						if(newValue[i].length <= 0) newValue.splice(i,1);
					}
					if(newValue.length != oldValue.length) {
						// reflow if column count changes //
						setTimeout(function() {
							$('[data-graph-id]').each(function() {
								hc = $(this).highcharts();
								if(hc != undefined) {
									hc.reflow();
								}
							});
						}, 500);
					}
				}, true); // end scope.$watch //
			}
		};
	}])
	.directive('layout', [function() {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;
				$(elem).dblclick(function(evt) {
					if(scope.editMode == "") return;
					if(evt.offsetY < $(evt.currentTarget).height()/2) {
						ngModel.$modelValue.unshift([
							JSON.parse(JSON.stringify(scope.droppablePodSchema))
							]);
					} else {
						ngModel.$modelValue.push([
							JSON.parse(JSON.stringify(scope.droppablePodSchema))
							]);
					}
					scope.$apply();
				});
				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(newValue, oldValue) {
					// remove empty rows //
					for(var i in newValue) {
						if(newValue[i] == null || newValue[i].length <= 0) newValue.splice(i,1);
					}
				}, true);
			}
		};
	}]);

/* graph initialization and loading */
angular.module('graphing', [])
	angular.module('graphing', [])
	.factory('WsHighstockGraphHelper', function(){
		return function (scope, ngModel) {
			var t = this;

			function setSerieStatus(newData, status) {
				/* status order: querying, updating, loading, loaded, error */
				for (var ns in newData.series) {
					for (var ms in ngModel.$modelValue.series) {
						qgt = $.extend(true, {}, ngModel.$modelValue.series[ms].query);
						$.extend(qgt.tags, scope.globalTags, true);
						if (equalObjects(qgt, newData.series[ns].query)) {
							ngModel.$modelValue.series[ms].status = status;
							break;
						}
					}
				}
			}


			// only get series data that is not in 'querying' state //
			function getSeriesInNonQueryState(series) {
				out = [];
				for (var ns in series) {
					for (var ms in ngModel.$modelValue.series) {
						if (equalObjects(ngModel.$modelValue.series[ms].query, series[ns].query)) {
							if (ngModel.$modelValue.series[ms].status === undefined || ngModel.$modelValue.series[ms].status !== 'querying') {
								out.push(series[ns]);
								break;
							}
						}
					}
				}
				return out;
			}

			function getUpdateQuery() {
				return {
					start: Math.floor(((new Date()).getTime() - METRIC_FETCH_TIME_WIN) / 1000),
					size: ngModel.$modelValue.size,
					_id: ngModel.$modelValue._id,
					name: ngModel.$modelValue.name,
					series: ngModel.$modelValue.series,
					graphType: ngModel.$modelValue.graphType,
					tags: scope.globalTags,
					//annoEvents: ngModel.$modelValue.annoEvents,
					multiPane: ngModel.$modelValue.multiPane,
					panes: ngModel.$modelValue.panes
				};
			}

			function getUpdates() {
				//console.log('requesting metrics updates...', scope.updatesEnabled);
				if (ngModel.$modelValue && scope.updatesEnabled && (ngModel.$modelValue.series.length > 0)) {
					q = getUpdateQuery();
					scope.requestData(q);
					setSerieStatus(q, 'updating');
				}
				if (currTimer) clearTimeout(currTimer);
				currTimer = setTimeout(function() {
					getUpdates();
				}, METRIC_POLL_INTERVAL);
			}

			function checkDataErrors(d) {
				for (var i in d.series) {
					if (d.series[i].data.error) setSerieStatus({
						'series': [d.series[i]]
					}, 'error');
					else setSerieStatus({
						'series': [d.series[i]]
					}, 'loading');
				}
			}

			function processRecievedData(event) {
				var data = event.detail;
				checkDataErrors(data);
				if (data.series) {
					var mg = new MetrilyxGraph(data, scope.getTimeWindow(true));
					mg.applyData();
				}
				if (data.annoEvents && data.annoEvents.data && data.annoEvents.data.length > 0) {
					anno = new MetrilyxAnnotation(data);
					anno.applyData();
				}
				var sTags = (new SeriesFormatter(data.series)).seriesTags();
				scope.$apply(function() {
					scope.updateTagsOnPage(sTags)
				});
				setSerieStatus(data, 'loaded');
			}


			//exposed public method
			t.setSerieStatus =  setSerieStatus;
			t.getSeriesInNonQueryState = getSeriesInNonQueryState;
			t.getUpdates = getUpdates;
			t.processRecievedData = processRecievedData;

			//not used yet, exposed for testing
			t.getUpdateQuery = getUpdateQuery;
			t.checkDataErrors = checkDataErrors;
		}
	})
	//helper factory
	.directive('wsHighstockGraph', ['WsHighstockGraphHelper', function(WsHighstockGraphHelper) {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;

				var currTimer;
				var evtListenerAdded = false;
				var wsHelper = new WsHighstockGraphHelper(scope, ngModel);

				if(scope.editMode == " edit-mode") {
					$(elem).find("input[ng-model*=name]").each(function() {
						$(this).attr('disabled', false);
					});
				} else {
					scope.disableDragDrop();
				}

				// start updates after 50 seconds //
				setTimeout(function() {wsHelper.getUpdates();},50000);

				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(graph, oldValue) {
					if(!evtListenerAdded && graph._id) {
						scope.wssock.addEventListener(graph._id, wsHelper.processRecievedData);
						evtListenerAdded = true;
						if(scope.modelType === "") scope.addEvtListenerGraphId(graph._id);
					}
					if(!graph.series) return;
					if(graph.series.length <= 0 && oldValue.series && oldValue.series.length <= 0) return;
					// ignore threshold changes //
					if(!equalObjects(graph.thresholds, oldValue.thresholds)) return;
					// ignore status changes //
					if(graph.series.length === oldValue.series.length) {
						for(var sl in graph.series) {
							if(graph.series[sl].status !== oldValue.series[sl].status) return;
						}
					}
					// initial populate //
					ehc = $("[data-graph-id='"+graph._id+"']");
					hc = $(ehc).highcharts();
					if(hc == undefined) {
						$(ehc).html("<table class='gif-loader-table'><tr><td><img src='/imgs/loader.gif'></td></tr></table>");
						gseries = wsHelper.getSeriesInNonQueryState(graph.series);
						if(gseries.length > 0) {
							var q = scope.baseQuery(graph);
							q.series = gseries;
							wsHelper.setSerieStatus(q, 'querying');
							scope.requestData(q);
						}
						if(scope.modelType == 'adhoc') scope.setURL(graph);
						return;
					}
					// handle graph change //
					if(graph.graphType != oldValue.graphType) {
						//console.log("graph type changed. re-rendering");
						scope.reloadGraph(graph);
						wsHelper.setSerieStatus(graph, 'querying');
						return;
					};
					// check length //
					if(graph.series.length == oldValue.series.length) {
						return;
					} else if(graph.series.length > oldValue.series.length) {
						var q = scope.baseQuery(graph);
						q.series = [];
						// find the new series that was added //
						for(var gi in graph.series) {
							if(graph.series[gi].status === undefined) {
								q.series.push(graph.series[gi]);
							}
						}
						scope.requestData(q);
						wsHelper.setSerieStatus(q,'querying');
						if(scope.modelType == 'adhoc') scope.setURL(graph);
					} else {
						//console.log("removing series");
						graphing_removeSeries(graph);
						if(scope.modelType == 'adhoc') scope.setURL(graph);
					}
				}, true);

				scope.$on("$destroy", function( event ) {
                	clearTimeout(currTimer);
            		if(scope.wssock != null)
            			scope.wssock.removeEventListener("graphdata", processRecievedData);
                });
			}
		};
	}]);
angular.module('timeframe', [])
	.directive('dateTime', ['$location', function($location) {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ctrl) {
				if(!ctrl) return;
				// initialize datetimepicker //
				$(elem).datetimepicker({
					useStrict: true
				});
				$(elem).on("change.dp",function (e) {
					if(e.date != undefined) {
						try {
							d = new Date(e.date.valueOf());
							if(attrs.ngModel == "startTime") {
								stime = Math.floor(d.getTime()/1000);
								if(stime == scope.startTime) return;
								scope.setStartTime(stime);
								$('[ng-model=endTime]').data("DateTimePicker").setStartDate(e.date);
							} else {
								etime = Math.ceil(d.getTime()/1000);
								if(etime == scope.endTime) return;
								scope.setEndTime(etime);
								$('[ng-model=startTime]').data("DateTimePicker").setEndDate(e.date);
							}
							scope.$apply();
						} catch(e) {
							console.log(e);
						}
					}
				});
			}
		};
	}])
	.directive('relativeTime', ['$location', function($location) {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;
				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(newValue, oldValue) {
					//console.log(newValue,oldValue);
					if(newValue === oldValue) return;
					if(newValue == "absolute") {
						scope.setTimeType(newValue);
						//scope.setTimeType(scope.timeType);
						if(scope.modelType !== 'adhoc') scope.setUpdatesEnabled(false);
							d = new Date();
							endTime = Math.ceil(d.getTime()/1000);
							startTime = endTime - relativeToAbsoluteTime(oldValue);
							scope.setStartTime(startTime);
							$('[ng-model=startTime]').data("DateTimePicker").setDate(new Date(startTime*1000));
							scope.setEndTime(endTime);
							$('[ng-model=startTime]').data("DateTimePicker").setDate(new Date(endTime*1000));
					} else {
						if(scope.modelType === 'adhoc') {
							scope.setTimeType(newValue);
							scope.reloadGraph();
						} else {
							console.log("reloading with:",newValue);
							tmp = $location.search();
							if(tmp.end) delete tmp.end;
							tmp['start'] = newValue;
							$location.search(tmp);
						}
					}
				}, true);
			}
		};
	}]);


function mousePos(e) {
	var x;
	var y;
	if (e.pageX || e.pageY) {
	  x = e.pageX;
	  y = e.pageY;
	} else {
	  x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
	  y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
	}
	x -= e.currentTarget.offsetLeft;
	y -= e.currentTarget.offsetTop;
	return {'x':x,'y':y}
}

function getNumericStyleProperty(style, prop){
    return parseInt(style.getPropertyValue(prop),10) ;
}

function element_position(e) {
    var x = 0, y = 0;
    var inner = true ;
    do {
        x += e.offsetLeft;
        y += e.offsetTop;
        var style = getComputedStyle(e,null) ;
        var borderTop = getNumericStyleProperty(style,"border-top-width") ;
        var borderLeft = getNumericStyleProperty(style,"border-left-width") ;
        y += borderTop ;
        x += borderLeft ;
        if (inner){
          var paddingTop = getNumericStyleProperty(style,"padding-top") ;
          var paddingLeft = getNumericStyleProperty(style,"padding-left") ;
          y += paddingTop ;
          x += paddingLeft ;
        }
        inner = false ;
    } while (e = e.offsetParent);
    return { x: x, y: y };
}
