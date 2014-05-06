
function relativeToAbsoluteTime(timeStr) {
	//tPart = timeStr.replace(/-ago$/,'');
	numUnit = timeStr.match(/([0-9]+)(m|h|w)-ago$/);
	//console.log(numUnit);	
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
	.directive('pod', ['Schema', 'Graph', function(Schema, Graph) {
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
						//console.log(newValue.graphs);
						console.log("orientation changed.");
						for(var g in newValue.graphs) {
							if(newValue.graphs[g].series.length <=0 ) continue;
							console.log("re-rendering", newValue.graphs[g]._id);
							q = scope.baseQuery(newValue.graphs[g]);
							q.series = newValue.graphs[g].series;
							Graph.getData(q, function(result) {
								graphing_newGraph(result);
							});
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
/*
				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(newValue, oldValue) {
					// lock graphs if only 1 on pod //
					//console.log("[graphs]: graphs changed");
					if(newValue.length <= 1) {
						//console.log(elem);
						$(elem).sortable({disabled: true});
					}
				}, true);
*/
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
					if(! $(evt.target).hasClass('dblclick-helper')) return;

					ypos = evt.pageY-evt.currentTarget.offsetTop;
					//console.log($(evt.target).hasClass('column-handle'));
					if($(evt.target).hasClass('column-handle')) {
						ngModel.$modelValue.unshift(
							JSON.parse(JSON.stringify(scope.droppablePodSchema[0])));
					} else {
					//} else {
						console.log('bottom')
						ngModel.$modelValue.push(
							JSON.parse(JSON.stringify(scope.droppablePodSchema[0])));
					}
					scope.$apply();
					
					//console.log(ngModel.$modelValue);
				});
				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(newValue, oldValue) {
					if(scope.editMode == " edit-mode") {
						//console.log(elem);
						/*
						$(elem).find('.graph-metrics-panel').each(function(){
							$(this).collapse('show');
						});*/
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
					//console.log(ngModel.$modelValue);
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
					//console.log(ngModel.$modelValue);
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
	.directive('highstockAdhocGraph', ['Graph', function(Graph) {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;

				function getGraphData(graph, callback) {
					var q = scope.baseQuery(graph);
					q.series = graph.series;
					Graph.getData(q, function(result) {
						//graphing_newGraph(result);
						callback(result);
					});
				}
				function updateTagsOnPage(result) {
					sf = new SeriesFormatter(result.series);
					sTags = sf.seriesTags();
					// write to links object //
					scope.updateTagsOnPage(sTags);
				}
				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(newVal, oldVal) {
					//console.log(newVal, oldVal);
					if(!newVal.series || !oldVal.series) return;
					if((newVal.series.length <= 0) && (oldVal.series.length <= 0)) return;
					if(!equalObjects(newVal.thresholds, oldVal.thresholds)) return;

					hc = $("[data-graph-id='"+newVal._id+"']").highcharts();
					if(hc == undefined) {
						$("[data-graph-id='"+newVal._id+"']").html(
							"<table class='gif-loader-table'><tr><td> \
							<img src='/imgs/loader.gif'></td></tr></table>");
						scope.setStatus(newVal.series.length-1, 'loading');
						scope.setURL(newVal);
						getGraphData(newVal, function(result) {
							graphing_newGraph(result);
							scope.setStatus(newVal.series.length-1, 'done-loading');
						});
						return;
					}
					if(newVal.graphType !== oldVal.graphType) {					
						scope.reloadGraph();
						scope.setURL(newVal);
						return;
					};
					if(newVal.series.length == oldVal.series.length) {
						return;
					} else if(newVal.series.length > oldVal.series.length) {
						scope.setURL(newVal);
						var q = scope.baseQuery(newVal);	
						q.series = [ newVal.series[newVal.series.length-1] ];
						scope.setStatus(newVal.series.length-1, 'loading');
						Graph.getData(q, function(result) {
							scope.setStatus(newVal.series.length-1, 'done-loading');
							graphing_upsertSeries(result);
							scope.setStatus(newVal.series.length-1, 'done-loading');
						});
					} else {
						graphing_removeSeries(newVal);
						scope.setURL(newVal);
					}
				}, true);
			}
		};
	}])
	.directive('highstockGraph', [ '$timeout', 'Graph', function($timeout, Graph) {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				if(!ngModel) return;
				// returns query with complete time window
				// enable all inputs in edit mode //
				if(scope.editMode == " edit-mode") {
					$(elem).find("input[ng-model*=name]").each(function() {
						$(this).attr('disabled', false);
					});
				} else {
					scope.disableDragDrop();
				}
				var currTimer;
				function getUpdates() {
					if(ngModel.$modelValue && scope.updatesEnabled && (ngModel.$modelValue.series.length > 0)) {
						console.log("issuing update...");
						var q = {
							start: "10m-ago",
							size: ngModel.$modelValue.size,
							_id: ngModel.$modelValue._id,
							series: ngModel.$modelValue.series,
							graphType: ngModel.$modelValue.graphType,
							tags: scope.globalTags
						};
						Graph.getData(q, function(gData) {
							renderGraph(gData);
						}); // END Graph.getData //
					}
					if(currTimer) clearTimeout(currTimer);
					currTimer = setTimeout(function() { 
						getUpdates();
					}, 50000);
				}
				function changeGraphType(graph) {
					var q = scope.baseQuery(graph);
					q.series = graph.series;
					Graph.getData(q, function(result) {
						//console.log(result);
						graphing_newGraph(result);
					});
				}

				getUpdates();
				
				scope.$watch(function() {
					return ngModel.$modelValue;
				}, function(graph, oldValue) {
					//console.log(oldValue.series.length);
					if(graph.series.length <= 0 && oldValue.series.length <= 0) return;
					if(!equalObjects(graph.thresholds, oldValue.thresholds)) return;
					
					// initial populate //
					hc = $("[data-graph-id='"+graph._id+"']").highcharts();
					if(hc == undefined) {
						$("[data-graph-id='"+graph._id+"']").html(
							"<table class='gif-loader-table'><tr><td> \
							<img src='/imgs/loader.gif'></td></tr></table>");

						var q = scope.baseQuery(graph);
						q.series = graph.series;

						Graph.getData(q, function(result) {
							for(var i in q.series) {
								q.series[i].loading = "done-loading";
							}
							sf = new SeriesFormatter(result.series);
							sTags = sf.seriesTags();
							// write to links object //
							scope.updateTagsOnPage(sTags);
							graphing_newGraph(result);
						});
						return;
					}
					// handle graph change //
					if(graph.graphType != oldValue.graphType) {
						console.log("graph type changed. re-rendering");
						changeGraphType(graph);
						return;
					};
					
					// check length //
					if(graph.series.length == oldValue.series.length) {
						return;
					} else if(graph.series.length > oldValue.series.length) {
						//console.log("add new series");
						var q = scope.baseQuery(graph);	
						q.series = [ graph.series[graph.series.length-1] ];
						// series gets appended which is why we use 'graph.series.length-1' //
						Graph.getData(q, function(result) {
							// use upsert to void dupes
							graphing_upsertSeries(result);
						});
					} else {
						//console.log("removing series");
						graphing_removeSeries(graph);
					}
				}, true);
				// clear timeout's //
				scope.$on("$destroy", function( event ) {
                	clearTimeout(currTimer);
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
							//$(elem).data("DateTimePicker").setDate(d);
							scope.$apply();		
						} catch(e) {
							console.log(e);
						}
					}
				});
			}
		};
	}])
	.directive('relativeTime', ['$location', 'Graph', function($location, Graph) {
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