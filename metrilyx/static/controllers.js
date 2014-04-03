/* controllers.js */
var metrilyxControllers = angular.module('metrilyxControllers', []);
metrilyxControllers.controller('staticsController', ['$scope', '$routeParams', 
	function($scope, $routeParams) {
		console.log('tutorials')
		clearAllTimeouts();
	}
]);
metrilyxControllers.controller('sidePanelController', ['$scope', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model', 'Heatmap',
	function($scope, $routeParams, $location, $http, Metrics, Schema, Model, Heatmap) {
		$scope.modelsList = [];
		$scope.modelType = "";
		$scope.modelQuery = "";
		Model.listModels(function(result) {
			$scope.modelsList = result;
		});
		$scope.loadHeatmapList = function() {
			Heatmap.listModels(function(result) {
				$scope.modelType = "heatmap/";
				$scope.modelsList = result;
			});
		}
		$scope.loadPagemodelList = function() {
			Model.listModels(function(result) {
				$scope.modelType = "";
				$scope.modelsList = result;
			});
		}
	}
]);
metrilyxControllers.controller('pageController', ['$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model', 'Graph','Heatmap',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, Graph, Heatmap) {
		//console.log($routeParams);
		if($routeParams.heatmapId) {
			$scope.modelType = "heatmap/";
		} else {
			$scope.modelType = "";
			$scope.tagsOnPage = {};
		}

		clearAllTimeouts();
		var canceler;

		$scope.editPanelHtml	= "partials/edit_panel.html";
		$scope.thresholdsHtml	= "partials/thresholds.html";
		$scope.graphHtml 		= "partials/graph.html";
		$scope.heatGraphHtml 	= "partials/heat-graph.html"
		$scope.podHtml 			= "partials/pod.html";
		$scope.pageHeaderHtml 	= "partials/page-header.html";
		$scope.jsonHtml 		= "partials/json.html";
		
		$scope.relativeTimes = [
						"24h-ago",
						"12h-ago",
						"6h-ago",
						"3h-ago",
						"2h-ago",
						"1h-ago",
						"Custom Range"
						];

		$scope.metricListSortOpts 	= dndconfig.metricList;
		$scope.graphSortOpts 		= dndconfig.graph;
		$scope.podSortOpts 			= dndconfig.pod;
		$scope.columnSortOpts 		= dndconfig.column;
		$scope.rowSortOpts 			= dndconfig.row;
		$scope.layoutSortOpts 		= dndconfig.layout;

		// set default to relative time //
		$scope.timeType = "1h-ago";
		// relative time or 'absolute' //
		var urlParams = $location.search();
		if(urlParams.start) {
			if(urlParams.end) {
				$scope.endTime = urlParams.end;
				$scope.timeType = "absolute";
				//$('#absolute-time').fadeIn(300);
			} else {
				$scope.timeType = urlParams.start;
				//console.log($('#absolute-time'));//.fadeOut(300);
			}
			$scope.startTime = urlParams.start;
		}
		 
		if(urlParams.tags) {
			try {
				$scope.$parent.globalTags = commaSepStrToDict(urlParams.tags);
			} catch(e) {
				console.log("error: could not set global tags");
				console.log("  reason:", e);
				$scope.globalTags = {}
			}
		} /*else {
			$scope.globalTags = {};
		}*/
		//disableDragDrop();
		$scope.editMode = "";
		$scope.updatesEnabled = true;

		$scope.metricQuery = "";
		$scope.metricQueryResult = [];

		$scope.reload = false;
		/* pod schema */
		$scope.droppablePodSchema = [];
		/* active model */
		$scope.model = {};

		//clearAllTimeouts();
		Schema.get({modelType: 'pod'},function(podModel){
			/* used for dropped pod */
			$scope.droppablePodSchema = [ podModel ];
			//Schema.get({modelType:'graph'}, function(graphModel) {
				/* used for dropped pod */
				//$scope.droppablePodSchema = [ podModel ];
				if((!$routeParams.pageId && !$routeParams.heatmapId) || $routeParams.pageId == "new" || $routeParams.heatmapId == "new") {
					Schema.get({modelType: 'page'}, function(pageModel) {
						$scope.model = pageModel;
						// make a copy of podModel //
						$scope.model.layout[0][0].push(JSON.parse(JSON.stringify(podModel)));
						$scope.enableDragDrop();
					});
				} else {
					// initial page load
					//console.log("mt", $scope.modelType, "dd", this.modelType);
					if($scope.modelType == "") {
						Model.get({pageId: $routeParams.pageId}, function(result) {
							if(result.error) {
								console.log(result);
							} else {
								$scope.model = result;
							}
						});
					} else {
						Heatmap.get({pageId: $routeParams.heatmapId}, function(result) {
							if(result.error) {
								console.log(result);
							} else {
								$scope.model = result;
								//console.log($scope.model);
							}
						});
					}
				}
			//});
		});
		// close side panel when new page model loaded //
		//$('#stage').removeClass('right');
		$scope.updateGlobalTag = function(tagkey, tagval) {
			$scope.$parent.globalTags[tagkey] = tagval;
			//console.log($scope.globalTags);
		}
		function flashAlertsBar() {
			$('#global-alerts').fadeIn(500);
				setTimeout(function() {
					$('#global-alerts').fadeOut(1000);
				}, 3000);
		}
		$scope.delayLoadPageModel = function(pageId, cb) {
			clearAllTimeouts();
			setTimeout(function() {
				Model.get({pageId: pageId}, function(result) {
					if(result.error) {
						console.log(result);
					} else {
						$scope.model = result;
						console.log(result);
						console.log("delayLoadPageModel: model set");
						if(cb) cb();
					}
				});
			}, 500);
		}
		$scope.updateTagsOnPage = function(obj) {
			var top = $scope.tagsOnPage;
			for(var k in obj) {
				if(top[k]) {
					for(var i in obj[k]) {
						if(top[k].indexOf(obj[k][i]) >= 0) {
							continue;
						} else {
							top[k].push(obj[k][i]);
						}
					}
				} else {
					top[k] = obj[k];
					top[k].push("*");
				}
			}
			$scope.tagsOnPage = top;
			//console.log($scope.tagsOnPage);
		}
		$scope.importModel = function(fileList) {
			var freader = new FileReader();
			//console.log(fileList[0].name);
			freader.onload = function(evt) {	
				try {
					jobj = JSON.parse(evt.target.result);
					//console.log(jobj);
					Model.saveModel(jobj, function(rslt) {
						//$('#global-alerts').html(rslt.message);
						if(rslt.error) {
							$('#global-alerts').removeClass('alert-success');
							$('#global-alerts').addClass('alert-danger');
							$('#global-alerts').html("<b>Error: </b>"+rslt.message);
						} else {
							$('#global-alerts').removeClass('alert-danger');
							$('#global-alerts').addClass('alert-success');
							$('#global-alerts').html("<b>Success: </b>"+rslt.message);
						}
						flashAlertsBar();
					});
				} catch(e) {
					console.error("Could not import model", fileList[0].name, e);
				}
			};
			freader.readAsText(fileList[0]);
		}
		$scope.setTimeType = function(newRelativeTime, reloadPage) {
			$scope.timeType = newRelativeTime;
			if(reloadPage !== undefined && reloadPage) 
				$scope.delayLoadPageModel($routeParams.pageId);
		}
		$scope.searchForMetric = function(args) {
			//console.log("|",this.metricQuery,"|");
			/* 
				'this.metricQuery' must be used rather than '$scope.metricQuery' because 
				edit-panel is ng-include so a new scope gets created.
			*/
			if(this.metricQuery == "") return;
			Metrics.suggest(this.metricQuery, function(result) {
				$scope.metricQuery = this.metricQuery;
				Schema.get({modelType:'metric'}, function(graphModel) {
					var arr = [];
					for(var i in result) {
						obj = JSON.parse(JSON.stringify(graphModel));
						obj.alias = result[i];
						obj.query.metric = result[i];
						arr.push(obj);
					}
					$scope.metricQueryResult = arr;
				});
				//console.log($scope.metricQueryResult.length);
			});
		}
		// Load initial empty page -> pod -> graph //
		$scope.setUpdatesEnabled = function(value) {
			$scope.updatesEnabled = value;
			//console.log($scope.updatesEnabled);
		}
		$scope.setStartTime = function(sTime) {
			//console.log("setStartTime");
			if($scope.endTime) {
				if($scope.sTime > $scope.endTime) return;
			}
			$scope.startTime = sTime;
		}
		$scope.setEndTime = function(eTime) {
			//console.log("setEndTime");
			if($scope.startTime) {
				if($scope.eTime < $scope.startTime) return
			}
			$scope.endTime = eTime;
		}
		$scope.setAbsoluteTime = function() {
			tmp = $location.search();
			tmp.start = $scope.startTime;
			tmp.end = $scope.endTime;
			$location.search(tmp);
		}

		$scope.removePod = function(rowIdx, colIdx, podIdx) {
			console.log("removing", rowIdx, colIdx, podIdx);
			$scope.model.layout[rowIdx][colIdx].splice(podIdx,1);
		}

		$scope.addGraph = function(rowIdx, colIdx, podIdx) {
			//console.log("addGraph", rowIdx, colIdx, podIdx);
			Schema.get({modelType:'graph'}, function(result) {
				$scope.model.layout[rowIdx][colIdx][podIdx].graphs.push(result);				
			});
		}
		$scope.removeGraph = function(rowIdx, colIdx, podIdx, graphIdx) {
			//console.log(rowIdx, colIdx,  podIx, graphIdx);
			$scope.model.layout[rowIdx][colIdx][podIdx].graphs.splice(graphIdx,1);
		}
		/*
		 * Remove metric from graph as well as data structure
		 *
		 */
		$scope.removeMetric = function(rowIdx, colIdx, podIdx, graphIdx, metricIdx) {
			console.log(rowIdx, colIdx, podIdx, graphIdx, metricIdx);
			graph = $scope.model.layout[rowIdx][colIdx][podIdx].graphs[graphIdx];
			graph.series.splice(metricIdx,1);
		}
		/* Reflow all graphs on page */
		$scope.reflow = function(args) {
			// This is to compensate for angulars processing time until I can figure out a better way //
			setTimeout(function() {
				//console.log("reflow");
				$('[data-graph-id]').each(function() {
					hc = $(this).highcharts();
					if(hc != undefined) {
						hc.reflow();
					}
				});
			}, 500);
		}
		$scope.baseQuery = function(graphObj) {
			var q = {
				_id: graphObj._id,
				graphType: graphObj.graphType,
				tags: $scope.globalTags,
				thresholds: graphObj.thresholds
			};
			if($scope.timeType == "absolute") {
				q['start'] = $scope.startTime;
				if($scope.endTime) q.end = $scope.endTime;
			} else {
				q['start'] = $scope.timeType;
			}
			return q;
		}
		$scope.disableDragDrop = function() {
			$('[ui-sortable]').each(function() {
				//console.log("disabling DnD");
				$(this).sortable({disabled: true});
			});
		}
		$scope.enableDragDrop = function() {
			$('[ui-sortable]').each(function() {
				//console.log("enabling DnD");
				$(this).sortable({disabled: false});
			});
		}
		$scope.enableEditMode = function() {
			$scope.editMode = " edit-mode";
			$scope.updatesEnabled = false;
			$(".graph-metrics-panel").collapse('show');
			if($scope.modelType == "") {
				$("[ng-include='thresholdsHtml']").collapse('show');
			}
			$('input.edit-comp').attr('disabled',false);
			$scope.enableDragDrop();
		}
		$scope.disableEditMode = function() {
			if($scope.timeType != "absolute") $scope.updatesEnabled = true;
			$(".graph-metrics-panel").collapse('hide');
			if($scope.modelType == "") {
				$("[ng-include='thresholdsHtml']").collapse('hide');	
			}
			$('input.edit-comp').attr('disabled',true);
			$scope.editMode = "";
			$scope.disableDragDrop();
		}
		$scope.toggleEditMode = function() {
			if($scope.editMode == "") {
				// enable edit mode
				$scope.enableEditMode();
			} else {
				// disable edit mode
				$scope.disableEditMode();
			}
			$scope.reflow();
		}
		function _removeModelCallback(rslt) {
			$('#global-alerts').html(rslt.message);
			if(rslt.error) {
				$('#global-alerts').removeClass('alert-success');
				$('#global-alerts').addClass('alert-danger');
				$('#global-alerts').html("<b>Error: </b>"+rslt.message)
				//$scope.globalAlerts = result.error;
			} else {
				$('#global-alerts').addClass('alert-success');
				$('#global-alerts').removeClass('alert-danger');
				$('#global-alerts').html("<b>Success: </b>"+rslt.message);
				// reload page model list //
				/*
				Model.listModels(function(models) {
	 				$scope.pageModels = models;
				});*/
			}
			flashAlertsBar();
		}
		$scope.removeModel = function(args) {
			if($scope.modelType == "") {
				Model.removeModel({pageId: $scope.model._id}, {}, function(result) {
					_removeModelCallback(result)
				});
			} else {
				console.log($scope.model._id);
				Heatmap.removeModel({pageId: $scope.model._id}, {}, function(result) {
					_removeModelCallback(result)
				});
			}
		}
		function _saveModelCallback(rslt) {
			$('#global-alerts').html(rslt.message);
			if(rslt.error) {
				$('#global-alerts').removeClass('alert-success');
				$('#global-alerts').addClass('alert-danger');
				$('#global-alerts').html("<b>Error: </b>"+rslt.message)
				//$scope.globalAlerts = result.error;
				flashAlertsBar();
			} else {
				$('#global-alerts').addClass('alert-success');
				$('#global-alerts').removeClass('alert-danger');
				//$scope.globalAlerts = result.success;
				$('#global-alerts').html("<b>Success: </b>"+rslt.message);
				//$scope.disableEditMode();
				//$scope.reflow();
				if(location.hash === ("#/" + $scope.model._id)) { 
					$location.reload(true);
				} else {
					location.hash = $scope.model._id;
				}
			}
		}
		$scope.saveModel = function(args) {
			//console.log($scope.model);
			if($scope.modelType == "") {
				Model.editModel($scope.model, function(result) {
					_saveModelCallback(result);
				});
			} else {
				Heatmap.editModel($scope.model, function(result) {
					_saveModelCallback(result);
				});
			}
		}
		$scope.setPlotBands = function(graph) {
			setPlotBands(graph);
		}

		// close side panel //
		$('#stage').removeClass('right');
		if($routeParams.pageId == "new" || $routeParams.heatmapId == 'new') {
			setTimeout(function() {
				$scope.enableEditMode();	
			}, 100);
		} else {
			if($scope.editMode == "") {
				$scope.disableDragDrop();	
			}
		}
}]);
