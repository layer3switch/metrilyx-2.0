/* controllers.js */
var metrilyxControllers = angular.module('metrilyxControllers', []);
metrilyxControllers.controller('staticsController', ['$scope', '$routeParams', 
	function($scope, $routeParams) {
		console.log('tutorials')
	}
]);
metrilyxControllers.controller('pageController', ['$scope', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model', 'Graph',
	function($scope, $routeParams, $location, $http, Metrics, Schema, Model, Graph) {
		
		console.log($routeParams.pageId);
		clearAllTimeouts();
		var canceler;

		$scope.graphHtml 		= "partials/graph.html";
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
				$scope.globalTags = commaSepStrToDict(urlParams.tags);
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

		$scope.pageQuery = "";

		$scope.metricQuery = "";
		$scope.metricQueryResult = [];

		$scope.pageModels = [];

		$scope.reload = false;
		/* pod schema */
		$scope.droppablePodSchema = [];
		/* active model */
		$scope.model = {};

		//clearAllTimeouts();
		Schema.get({modelType: 'pod'},function(podModel){
			Schema.get({modelType:'graph'}, function(graphModel) {
				/* used for dropped pod */
				$scope.droppablePodSchema = [ podModel ];
				if(!$routeParams.pageId || $routeParams.pageId == "new") {
					Schema.get({modelType: 'page'}, function(pageModel) {
						$scope.model = pageModel;
						// make a copy of podModel //
						$scope.model.layout[0][0].push(JSON.parse(JSON.stringify(podModel)));
						$scope.enableDragDrop();
					});
				} else {
					// initial page load
					Model.get({pageId: $routeParams.pageId}, function(result) {
						if(result.error) {
							console.log(result);
						} else {
							$scope.model = result;
						}
					});
				}

			});
		});
		/*
		 * Populate page models list
		 */
		Model.listModels(function(models) {
		 	$scope.pageModels = models;
		});
		// close side panel when new page model loaded //
		$('#stage').removeClass('right');


		function clearAllTimeouts() {
			console.log("Clearing timeouts");
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
		$scope.setTimeType = function(newRelativeTime) {
			$scope.timeType = newRelativeTime;
			$scope.delayLoadPageModel($routeParams.pageId);
		}
		$scope.searchForMetric = function(args) {
			Metrics.suggest($scope.metricQuery, function(result) {
				
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
				
				console.log($scope.metricQueryResult.length);
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
		function _getColumnPosition(event) {
			if(event.originalEvent.offsetX <= event.currentTarget.clientWidth/2) {
				return 0;
			} else {
				return -1;
			}
		}
		function _getVerticalPosition(event) {
			if(event.originalEvent.offsetY <= event.currentTarget.clientHeight/2) {
				return 0;
			} else {
				return -1;
			}
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
			//console.log(rowIdx, colIdx, podIdx, graphIdx, metricIdx);
			graph = $scope.model.layout[rowIdx][colIdx][podIdx].graphs[graphIdx];
			graph.series.splice(metricIdx,1);
		}
		/* Reflow all graphs on page */
		$scope.reflow = function(args) {
			console.log("reflow in 500...");
			// This is to compensate for angulars processing time until I can figure out a better way //
			setTimeout(function() {
				console.log("reflow");
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
				tags: $scope.globalTags
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
				console.log("disabling DnD");
				$(this).sortable({disabled: true});
			});
		}
		$scope.enableDragDrop = function() {
			$('[ui-sortable]').each(function() {
				console.log("enabling DnD");
				$(this).sortable({disabled: false});
			});
		}
		$scope.enableEditMode = function() {
			$scope.editMode = " edit-mode";
			$scope.updatesEnabled = false;
			$(".graph-metrics-panel").collapse('show');
			$('input.edit-comp').attr('disabled',false);
			$scope.enableDragDrop();
		}
		$scope.disableEditMode = function() {
			if($scope.timeType != "absolute") $scope.updatesEnabled = true;
			$(".graph-metrics-panel").collapse('hide');
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
		
		$scope.removeModel = function(args) {
			Model.removeModel({pageId: $scope.model._id}, {}, function(result) {
				$('#global-alerts').html(result.message);
				if(result.error) {
					$('#global-alerts').removeClass('alert-success');
					$('#global-alerts').addClass('alert-danger');
					$('#global-alerts').html("<b>Error: </b>"+result.message)
					//$scope.globalAlerts = result.error;
				} else {
					$('#global-alerts').addClass('alert-success');
					$('#global-alerts').removeClass('alert-danger');
					$('#global-alerts').html("<b>Success: </b>"+result.message);
					// reload page model list //
					Model.listModels(function(models) {
		 				$scope.pageModels = models;
					});
				}
				flashAlertsBar();
			});
		}
		$scope.saveModel = function(args) {
			//console.log($scope.model);
			Model.editModel($scope.model, function(result) {
				//$scope.globalAlerts = result;
				$('#global-alerts').html(result.message);
				if(result.error) {
					$('#global-alerts').removeClass('alert-success');
					$('#global-alerts').addClass('alert-danger');
					$('#global-alerts').html("<b>Error: </b>"+result.message)
					//$scope.globalAlerts = result.error;
				} else {
					$('#global-alerts').addClass('alert-success');
					$('#global-alerts').removeClass('alert-danger');
					//$scope.globalAlerts = result.success;
					$('#global-alerts').html("<b>Success: </b>"+result.message);
					$scope.disableEditMode();
					$scope.reflow();
				}
				//console.log("globalAlerts", result);
				flashAlertsBar();
			});
		}
		
		if($routeParams.pageId == "new") {
			setTimeout(function() {
				$scope.enableEditMode();	
			}, 100);
		} else {
			if($scope.editMode == "") {
				$scope.disableDragDrop();	
			}
		}
}]);
