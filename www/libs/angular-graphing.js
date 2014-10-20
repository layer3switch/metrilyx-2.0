
function relativeToAbsoluteTime(timeStr) {
	numUnit = timeStr.match(/([0-9]+)(m|h|d|w)-ago$/);
	num = parseInt(numUnit[1]);
	switch(numUnit[2]) {
		case "m":
			return num*60;
			break;
		case "h":
			return num*3600;
			break;
		case "d":
			return num*86400
			break;
		case "w":
			return num*604800;
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
			var currTimer;

			function setSerieStatus(newData, status) {
				/* status order: querying, updating, loading, loaded, error */
				for (var ns=0; ns < newData.series.length; ns++) {
					for (var ms=0; ms < ngModel.$modelValue.series.length; ms++) {

						var mdlSerie = ngModel.$modelValue.series[ms];
						
						var qgt = $.extend(true, {}, mdlSerie.query);
						$.extend(qgt.tags, scope.globalTags, true);
						
						if (equalObjects(qgt, newData.series[ns].query)) {
							mdlSerie.status = status;
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

						var mdlSerie = ngModel.$modelValue.series[ms];
						if (equalObjects(mdlSerie.query, series[ns].query)) {
							
							if (mdlSerie.status === undefined || mdlSerie.status !== 'querying') {
								out.push(series[ns]);
								break;
							}
						}
					}
				}
				return out;
			}

			function getUpdateQuery() {
				
				var modelVal = ngModel.$modelValue;
				
				var bq = scope.baseQuery(ngModel.$modelValue);
				bq.series = modelVal.series;

				if(modelVal.graphType === 'pie' || modelVal.graphType === 'bar' || modelVal.graphType === 'column') {
					// Must query the complete window as this is analyzed //
				} else {
					bq.start = Math.floor(((new Date()).getTime() - METRIC_FETCH_TIME_WIN) / 1000);
					delete bq['end'];
				}

				return bq;
			}

			function getUpdates() {
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
					
					var sTags = (new SeriesFormatter(data.series)).seriesTags();
					scope.$apply(function() { scope.updateTagsOnPage(sTags) });
					
					setSerieStatus(data, 'loaded');
				}
				if(data.annoEvents && data.annoEvents.data && data.annoEvents.data.length > 0 && ngModel.$modelValue.graphType !== 'pie') {
					
					anno = new MetrilyxAnnotation(data);
					anno.applyData();
				}
			}

			function getNewlyAddedSeries(val) {
				var out = [];
				for(var i=0; i < val.length; i++) {
					if(val[i].status === undefined) {
						out.push(val[i]);
					}
				}
				return out;
			}

			//exposed public methods
			t.setSerieStatus =  setSerieStatus;
			t.getSeriesInNonQueryState = getSeriesInNonQueryState;
			t.getUpdates = getUpdates;
			t.processRecievedData = processRecievedData;
			t.getNewlyAddedSeries = getNewlyAddedSeries;

			//not used yet, exposed for testing
			t.getUpdateQuery = getUpdateQuery;
			t.checkDataErrors = checkDataErrors;

			scope.$on("$destroy", function( event ) { clearTimeout(currTimer); });
		}
	})
	.directive('wsHighstockGraph', ['WsHighstockGraphHelper', function(WsHighstockGraphHelper) {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;

				var _graphDomNode;
				var wsHelper = new WsHighstockGraphHelper(scope, ngModel);

				if(scope.editMode == " edit-mode") {
					$(elem).find("input[ng-model*=name]").each(function() {
						$(this).attr('disabled', false);
					});
				} else {
					scope.disableDragDrop();
				}

				function connectTestFunc(event) {
					console.log("connect", event);
				}

				// start updates after 50 seconds //
				setTimeout(function() {wsHelper.getUpdates();},50000);

				// Initialize graph object
				scope.$watch(function() {
					return ngModel.$modelValue._id;
				
				}, function(newVal, oldVal) {
					if (newVal === undefined) return;	

					scope.addGraphIdEventListener(newVal, wsHelper.processRecievedData);
					_graphDomNode = $("[data-graph-id='"+ngModel.$modelValue._id+"']");
				});

				// Graph type change
				scope.$watch(function() {
					return ngModel.$modelValue.graphType;
				}, function(newVal, oldVal) {
					if (newVal === undefined || oldVal === undefined) return;

					if(newVal !== oldVal) {
						
						scope.reloadGraph(ngModel.$modelValue);
						wsHelper.setSerieStatus(ngModel.$modelValue, 'querying');
					}
				});

				// Series change
				scope.$watch(function() {
					return ngModel.$modelValue.series;
				}, function(newVal, oldVal) {
					if(newVal === undefined) return;
					//if(newVal.length <= 0) return;

					// Ignore status changes
					if(newVal.length > 0 && oldVal !== undefined && oldVal.length > 0) {
						if(newVal.length === oldVal.length) {
							for(var sl=0; sl < newVal.length; sl++) {
								if(newVal[sl].status !== oldVal[sl].status) return;
							}
						}
					}

					// Initial populate //
					hc = _graphDomNode.highcharts();
					if(hc == undefined) {
						
						var gseries = wsHelper.getSeriesInNonQueryState(newVal);
						if(gseries.length > 0) {
							
							_graphDomNode.html(GRAPH_LOADING_HTML);
							
							var q = scope.baseQuery(ngModel.$modelValue);
							q.series = gseries;
							
							wsHelper.setSerieStatus(q, 'querying');
							scope.requestData(q);
						}
						
						if(scope.modelType == 'adhoc') scope.setURL(ngModel.$modelValue);
						return;
					}

					if(newVal.length == oldVal.length) {
						
						return;
					} else if(newVal.length > oldVal.length) {
						
						var q = scope.baseQuery(ngModel.$modelValue);
						q.series = wsHelper.getNewlyAddedSeries(newVal);
						
						scope.requestData(q);
						wsHelper.setSerieStatus(q,'querying');
						
						if(scope.modelType == 'adhoc') scope.setURL(ngModel.$modelValue);
					} else {
						
						var deltas = getSeriesDeltaByQuery(newVal, oldVal);
						mg = new MetrilyxGraph(ngModel.$modelValue, scope.getTimeWindow(true));
						mg.removeSeries(deltas);

						if(scope.modelType == 'adhoc') scope.setURL(ngModel.$modelValue);
					}
				}, true);

				scope.$on("$destroy", function( event ) {
            		scope.removeGraphIdEventListener(ngModel.$modelValue._id, wsHelper.processRecievedData);	
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
				
				function isStartTime() {
					return attrs.ngModel === "startTime";
				}
				function isEndTime() {
					return attrs.ngModel === "endTime";
				}

				/* initialize datetimepicker */
				$(elem).datetimepicker({
					useStrict: true
				});

				if(scope.timeType === "absolute") {
					if(isStartTime()) {
						
						$(elem).data("DateTimePicker").setDate(new Date(scope.startTime*1000));
					} else if(isEndTime()) {
						
						$(elem).data("DateTimePicker").setDate(new Date(scope.endTime*1000));
					}
				}

				$(elem).on("change.dp",function (e) {
					
					if(e.date != undefined) {
						
						try {

							d = new Date(e.date.valueOf());
							scope.$apply(function() {
								
								if(isStartTime()) {
									
									stime = Math.floor(d.getTime()/1000);
									if(stime != scope.startTime) {

										scope.setStartTime(stime);
										$(elem).data("DateTimePicker").setDate(e.date);
									}
								} else if(isEndTime()) {
									
									etime = Math.ceil(d.getTime()/1000);
									if(etime != scope.endTime) {

										scope.setEndTime(etime);
										$(elem).data("DateTimePicker").setDate(e.date);
									}
								}
							});
						} catch(e) { console.log(e); }
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
					if(newValue === oldValue) return;

					if(newValue == "absolute") {
						
						scope.setTimeType(newValue);
						
						if(scope.modelType !== 'adhoc') scope.setUpdatesEnabled(false);
						
						d = new Date();
						endTime = Math.ceil(d.getTime()/1000);
						startTime = endTime - relativeToAbsoluteTime(oldValue);
						
						scope.setStartTime(startTime);
						$('[ng-model=startTime]').data("DateTimePicker").setDate(new Date(startTime*1000));
						scope.setEndTime(endTime);
						$('[ng-model=endTime]').data("DateTimePicker").setDate(new Date(endTime*1000));
					} else {

						if(scope.modelType === 'adhoc') {
							
							scope.setTimeType(newValue);
							scope.reloadGraph();
						} else {
							
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
