/* controllers.js */

var metrilyxControllers = angular.module('metrilyxControllers', []);
metrilyxControllers.controller('staticsController', ['$scope', '$route', '$routeParams', '$location',
	function($scope, $route, $routeParams, $location) {
		//console.log('tutorials')
		clearAllTimeouts();
		$scope.pageMastHtml		= connectionPool.nextConnection()+"/partials/page-mast.html";
		$scope.editPanelHtml	= connectionPool.nextConnection()+"/partials/edit_panel.html";

		$scope.loadHome = function() {
			$location.path('/graph').search({});
			$route.reload();
		}
	}
]);
metrilyxControllers.controller('sidePanelController', ['$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model', 'Heatmap',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, Heatmap) {
		$scope.modelsList = [];
		$scope.modelType = "";
		$scope.modelQuery = "";
		Model.listModels(function(result) {
			$scope.modelsList = result;
		});
		$scope.loadHeatmapList = function(elem) {
			$('.model-list-btn').removeClass('list-active');
			$(elem).addClass('list-active');
			Heatmap.listModels(function(result) {
				$scope.modelType = "heatmap/";
				$scope.modelsList = result;
			});
		}
		$scope.loadPagemodelList = function(elem) {
			$('.model-list-btn').removeClass('list-active');
			$(elem).addClass('list-active');
			Model.listModels(function(result) {
				$scope.modelType = "";
				$scope.modelsList = result;
			});
		}
		$scope.importModel = function(fileList) {
			var freader = new FileReader();
			//console.log(fileList[0].name);
			freader.onload = function(evt) {	
				try {
					jobj = JSON.parse(evt.target.result);
					if($scope.modelType === "heatmap/") {
						Heatmap.saveModel(jobj, function(rslt) {
							setGlobalAlerts(rslt);
							flashAlertsBar();
						});
					} else {
						Model.saveModel(jobj, function(rslt) {
							setGlobalAlerts(rslt);
							flashAlertsBar();
						});
					}
				} catch(e) {
					console.error("Could not import model", fileList[0].name, e);
				}
			};
			freader.readAsText(fileList[0]);
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
		if($routeParams.pageId == "new" || $routeParams.heatmapId == 'new') {
			$scope.editMode = " edit-mode";
			$scope.updatesEnabled = false;
		} else {
			$scope.editMode = "";
			$scope.updatesEnabled = true;
		}
		clearAllTimeouts();
		// make sure modal window is not lingering around //
		$('#confirm-delete').modal('hide');
		$('.modal-backdrop').remove();

		$scope.pageMastHtml		= connectionPool.nextConnection()+"/partials/page-mast.html";
		$scope.editPanelHtml	= connectionPool.nextConnection()+"/partials/edit_panel.html";
		$scope.thresholdsHtml	= connectionPool.nextConnection()+"/partials/thresholds.html";
		$scope.queryEditorHtml	= connectionPool.nextConnection()+"/partials/query-editor.html";
		$scope.graphHtml 		= connectionPool.nextConnection()+"/partials/graph.html";
		$scope.heatGraphHtml 	= connectionPool.nextConnection()+"/partials/heat-graph.html"
		$scope.podHtml 			= connectionPool.nextConnection()+"/partials/pod.html";
		$scope.pageHeaderHtml 	= connectionPool.nextConnection()+"/partials/page-header.html";
		$scope.jsonHtml 		= connectionPool.nextConnection()+"/partials/json.html";

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
				$scope.updatesEnabled = false;
			} else {
				$scope.timeType = urlParams.start;
			}
			$scope.startTime = urlParams.start;
		}
		 
		if(urlParams.tags) {
			try {
				//$scope.$parent
				$scope.$parent.globalTags = commaSepStrToDict(urlParams.tags);
			} catch(e) {
				console.log("error: could not set global tags");
				console.log("  reason:", e);
				$scope.globalTags = {}
			}
		} else {
			$scope.globalTags = {};
		}

		$scope.metricQuery = "";
		$scope.metricQueryResult = [];

		$scope.reload = false;
		/* pod schema */
		$scope.droppablePodSchema = [];
		/* active model */
		$scope.model = {};

		Schema.get({modelType: 'pod'},function(podModel){
			/* used for dropped pod */
			$scope.droppablePodSchema = [ podModel ];
			if((!$routeParams.pageId && !$routeParams.heatmapId) || $routeParams.pageId == "new" || $routeParams.heatmapId == "new") {
				Schema.get({modelType: 'page'}, function(pageModel) {
					$scope.model = pageModel;
					// make a copy of podModel //
					$scope.model.layout[0][0].push(JSON.parse(JSON.stringify(podModel)));
					$scope.enableDragDrop();
				});
			} else {
				// initial page load
				if($routeParams.pageId) {
					Model.get({pageId: $routeParams.pageId}, function(result) {
						if(result.error) {
							console.log(result);
						} else {
							$scope.model = result;
						}
					});
				} else if($routeParams.heatmapId) {
					Heatmap.get({pageId: $routeParams.heatmapId}, function(result) {
						if(result.error) {
							console.log(result);
						} else {
							$scope.model = result;
						}
					});
				} else {
					console.warn("Heatmap or Page id not provided");
				}
			}
		});
		$scope.onPartialComponentLoad = function() {
			// this is to account for processing time //
			setTimeout(function() {
				if($scope.editMode === ' edit-mode') {
					$('input.edit-comp').attr('disabled', false);
				} else {
					$('input.edit-comp').attr('disabled', true); 
				}
			}, 150);
		}
		$scope.updateGlobalTag = function(tagkey, tagval) {
			$scope.globalTags[tagkey] = tagval;
			//$scope.$parent.globalTags[tagkey] = tagval;
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
		}
		$scope.setStartTime = function(sTime) {
			if($scope.endTime) {
				if($scope.sTime > $scope.endTime) return;
			}
			$scope.startTime = sTime;
		}
		$scope.setEndTime = function(eTime) {
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
		$scope.addGraph = function(toPod) {
			Schema.get({modelType:'graph'}, function(result) {
				toPod.graphs.push(result);	
				$scope.reflow();			
			});
		}
		$scope.graphSizeChanged = function() {
			$scope.reflow();
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
				$(this).sortable({disabled: true});
			});
		}
		$scope.enableDragDrop = function() {
			$('[ui-sortable]').each(function() {
				$(this).sortable({disabled: false});
			});
		}
		$scope.enableEditMode = function() {
			$scope.editMode = " edit-mode";
			$scope.updatesEnabled = false;
			$(".graph-metrics-panel").collapse('show');
			if($scope.modelType == "") {
				setTimeout(function() {
					$("[ng-include=thresholdsHtml]").collapse('show');
				}, 250);
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
			setGlobalAlerts(rslt);
			if(rslt.error) {
				flashAlertsBar();
			} else {
				if($scope.modelType == "") {
					location.hash = "#/new";
				} else {
					location.hash = "#/heatmap/new";
				}
			}
		}
		$scope.removeModel = function(callback) {
			if($scope.modelType == "") {
				Model.removeModel({pageId: $scope.model._id}, {}, function(result) {
					_removeModelCallback(result);
				});
			} else {
				console.log($scope.model._id);
				Heatmap.removeModel({pageId: $scope.model._id}, {}, function(result) {
					_removeModelCallback(result);
				});
			}
		}
		function _saveModelCallback(rslt) {
			setGlobalAlerts(rslt);
			if(rslt.error) {
				flashAlertsBar();
			} else {
				var currpath;
				if($scope.modelType === "") {
					currpath = "#/"+$scope.model._id;
				} else {
					currpath = "#/" + $scope.modelType + $scope.model._id;
				}
				console.log(currpath);
				if(location.hash === currpath) { 
					//console.log($location);
					location.reload(true);
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
		$scope.loadHome = function() {
			$location.path('/graph').search({});
			$route.reload();
		}

		// close side panel //
		/*
		$('#stage').removeClass('right');
		if($routeParams.pageId == "new" || $routeParams.heatmapId == 'new') {
			setTimeout(function() {
				$scope.enableEditMode();	
			}, 300);
		} else {
			if($scope.editMode == "") {
				$scope.disableDragDrop();	
			}
		}*/
}]);
metrilyxControllers.controller('adhocGraphController', ['$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model', 'Graph',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, Graph) {
		//console.log($routeParams);
		
		$scope.modelType 		= "graph";
		//$scope.relativeTimes 	= ["24h-ago","12h-ago","6h-ago","3h-ago","2h-ago","1h-ago","Custom Range"];
		$scope.timeType 		= "1h-ago";
		$scope.editMode 		= " edit-mode";
		
		$scope.pageMastHtml		= connectionPool.nextConnection()+"/partials/page-mast.html";
		$scope.editPanelHtml	= connectionPool.nextConnection()+"/partials/edit_panel.html";
		$scope.pageHeaderHtml 	= connectionPool.nextConnection()+"/partials/page-header.html";
		$scope.thresholdsHtml	= connectionPool.nextConnection()+"/partials/thresholds.html";
		$scope.queryEditorHtml	= connectionPool.nextConnection()+"/partials/query-editor.html";

		$scope.metricListSortOpts 	= dndconfig.metricList;

		$scope.metricQueryResult = [];
		$scope.tagsOnPage = {};
		$scope.graph = {};

		if($routeParams.editMode==="false") {
			$scope.editMode = "";
		} else {
			$scope.editMode = " edit-mode";
		}

		if($routeParams.start) {
			if($routeParams.end) {
				$scope.endTime = $routeParams.end;
				$scope.timeType = "absolute";
			} else {
				$scope.timeType = $routeParams.start;
			}
			$scope.startTime = $routeParams.start;
		}

		Schema.get({modelType: 'graph'}, function(graphModel) {
			if($routeParams.size){ 
				graphModel.size = $routeParams.size;
			} else {
				graphModel.size = "large";
			}
			if($routeParams.type) graphModel.graphType = $routeParams.type;
			if($routeParams.thresholds) {
					try {
						arr = $routeParams.thresholds.split(":");
						if(arr.length == 3) {
							graphModel.thresholds = {
								'danger': arr[0],
								'warning': arr[1],
								'info': arr[2]
							}
						} 
					} catch(e) {
						console.warn("cannot set thresholds", e);
					}
			}
			if($routeParams.m) {
				var metrics;
				if(Object.prototype.toString.call($routeParams.m) === '[object Array]') {
					//console.log('arr');
					metrics = $routeParams.m;
				} else {
					metrics = [ $routeParams.m ];
				}
				for(var i in metrics) {
					arr = metrics[i].match(/^(.*)\{(.*)\}\{alias:(.*),yTransform:(.*)\}$/);
					met = arr[1].split(":");
					rate = false;
					if(met.length == 3) rate = true;
					graphModel.series.push({	
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
				$scope.graph = graphModel;
				$scope.reloadGraph();
			} else {
				// initial empty page
				$scope.graph = graphModel;
			}
		});

		if($scope.editMode === "") {
			$scope.metricListSortOpts.disabled = true;
		} else {
			$scope.metricListSortOpts.disabled = false;
		}
		$scope.removeTag = function(tags, tagkey) {
			delete tags[tagkey];
		}

		$scope.setStatus = function(serieIdx, status) {
			//console.log(serieIdx, status);
			$scope.graph.series[serieIdx].loading = status;
		}

		$scope.baseQuery = function(graphObj) {
			var q = {
				_id: graphObj._id,
				graphType: graphObj.graphType,
				tags: {},
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
		$scope.setURL = function(obj) {
			var outarr = [];
			for(var s in obj.series) {
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
				if(tagstr !== "") {
					params += tagstr;
				}
				params += "}";
				params += "{alias:"+serie.alias;
				params += ",yTransform:"+serie.yTransform+"}";
				outarr.push(params);
			}
			srch = {
				'm': outarr,
				'thresholds': $scope.graph.thresholds.danger+":"+$scope.graph.thresholds.warning+":"+$scope.graph.thresholds.info,
				'type': $scope.graph.graphType,
				'size': $scope.graph.size,
			};
			if($scope.editMode === "") {
				srch.editMode = "false";
			}
			if($scope.timeType === "absolute") {
				srch.start = $scope.startTime;
				if($scope.endTime) srch.end = $scope.endTime;
			} else {
				srch.start = $scope.timeType;
			}
			//console.log(srch.m);
			$location.search(srch);
		}
		$scope.updateTagsOnPage = function(obj) {
			var top = $scope.tagsOnPage;
			for(var k in obj) {
				if(top[k] == undefined) {
					top[k] = ["*"];
					top[k].push(obj[k]);
					continue;
				}
				if(top[k].indexOf(obj[k]) >= 0) {
					continue;
				} else {
					top[k].push(obj[k]);
				}
			}
			$scope.tagsOnPage = top;
		}
		$scope.reloadGraph = function() {
			$('.adhoc-metric-editor').hide();
			if($scope.graph.series.length < 1) return;

			for(var s in $scope.graph.series) {
				$scope.graph.series[s].loading = "loading";
			}
			//console.log($scope.graph.series[0].query.tags);
			$scope.setURL($scope.graph);

			q = $scope.baseQuery($scope.graph)
			q.series = $scope.graph.series;
			Graph.getData(q, function(result) {
				graphing_newGraph(result);
				for(var s in $scope.graph.series) {
					$scope.graph.series[s].loading = "done-loading";
					for(var d in result.series[s].data) {
						$scope.updateTagsOnPage(result.series[s].data[d].tags);
						//console.log(result.series[s].data[d].tags);
					}
				}
			});
		}

		$scope.disableDragDrop = function() {
			$('[ui-sortable]').each(function() {
				$(this).sortable({disabled: true});
			});
		}
		$scope.enableDragDrop = function() {
			$('[ui-sortable]').each(function() {
				$(this).sortable({disabled: false});
			});
		}

		$scope.setPlotBands = function(graph) {
			setPlotBands(graph);
			$scope.setURL(graph);
		}
		$scope.enableEditMode = function() {
			$scope.editMode = " edit-mode";
			$scope.enableDragDrop();
			$scope.reflow();
		}
		$scope.disableEditMode = function() {
			$scope.editMode = "";
			$scope.disableDragDrop();
			$scope.reflow();
		}
		$scope.toggleEditMode = function() {
			if($scope.editMode == "") {
				$scope.enableEditMode();
			} else {
				$scope.disableEditMode();
			}
		}

		$scope.searchForMetric = function(args) {
			if(this.metricQuery == "") return;
			Metrics.suggest(this.metricQuery, function(result) {
				$scope.metricQuery = this.metricQuery;
				Schema.get({modelType:'metric'}, function(graphModel) {
					var arr = [];
					for(var i in result) {
						obj = JSON.parse(JSON.stringify(graphModel));
						obj.alias = result[i];
						obj.loading = "loading";
						obj.query.metric = result[i];
						arr.push(obj);
					}
					$scope.metricQueryResult = arr;
				});
			});
		}
		
		$scope.loadHome = function() {
			$location.path('/graph').search({});
			$route.reload();
		}
		$scope.graphSizeChanged = function() {
			$scope.setURL($scope.graph);
			$scope.reflow();
		}
		$scope.reflow = function(args) {
			setTimeout(function() {
				$('[data-graph-id]').each(function() {
					hc = $(this).highcharts();
					if(hc != undefined) hc.reflow();
				});
			}, 300);
		}
		$scope.setStartTime = function(sTime) {
			if($scope.endTime) {
				if($scope.sTime > $scope.endTime) return;
			}
			$scope.startTime = sTime;
		}
		$scope.setEndTime = function(eTime) {
			if($scope.startTime) {
				if($scope.eTime < $scope.startTime) return
			}
			$scope.endTime = eTime;
		}
		$scope.setTimeType = function(newRelativeTime, reloadPage) {
			$scope.timeType = newRelativeTime;
		}
		$scope.setAbsoluteTime = function() {
			$scope.reloadGraph();
			//console.log($scope.startTime, $scope.endTime, $scope.timeType);
		}
		$scope.updateGlobalTag = function(tagkey, tagval) {
			if(tagkey == undefined || tagkey == "") return;
			for(var s in $scope.graph.series) {
				$scope.graph.series[s].query.tags[tagkey] = tagval;
			}
			$scope.setURL($scope.graph);
			$route.reload();
		}
	}
]);

