/* controllers.js */

var metrilyxControllers = angular.module('metrilyxControllers', []);
metrilyxControllers.controller('staticsController', ['$scope', '$route', '$routeParams', '$location',
	function($scope, $route, $routeParams, $location) {
		//console.log('tutorials')
		clearAllTimeouts();
		$scope.pageMastHtml		= connectionPool.nextConnection()+"/partials/page-mast.html";
		$scope.editPanelHtml	= connectionPool.nextConnection()+"/partials/edit-panel.html";

		$scope.loadHome = function() {
			$location.path('/graph').search({});
			$route.reload();
		}
	}
]);
metrilyxControllers.controller('sidePanelController', ['$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model', 'Heatmap','Tags',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, Heatmap, Tags) {
		$scope.modelsList = [];
		$scope.modelType = "";
		$scope.modelQuery = "";
		$scope.browseBy = "name"; // name, tags //
		$scope.selectedTag = "";

		$scope.loadHeatmapList = function(elem) {
			$('.model-list-btn').removeClass('list-active');
			$(elem).addClass('list-active');
			$scope.modelType = 'heatmap/';
			$scope.loadList();
		}
		$scope.loadPagemodelList = function(elem) {
			$('.model-list-btn').removeClass('list-active');
			$(elem).addClass('list-active');
			$scope.modelType = '';
			$scope.loadList();
		}
		$scope.onChangeBrowseBy = function() {
			$scope.loadList();
		}
		$scope.listItemClicked = function(obj) {
			if($scope.browseBy == 'tags' && $scope.selectedTag == '') {
				if($scope.modelType == 'heatmap/') {	
					Tags.listModelsByTag({'model_type': 'heat'}, {'tagname':obj.name}, function(result){
						$scope.modelsList = result;
					});
				} else {
					Tags.listModelsByTag({'model_type': 'graph'}, {'tagname':obj.name}, function(result){
						$scope.modelsList = result;
					});
				}
				$('#tag-back-btn').show();
				$scope.selectedTag = obj.name;
			} else {
				//console.log(obj);
				location.hash = "#/"+$scope.modelType+obj._id;
			}
		}
		$scope.loadList = function() {
			$scope.selectedTag = '';
			if($scope.modelType === 'heatmap/') mtype = 'heat';
			else mtype = 'graph';
			switch($scope.browseBy) {
				case "name":
					if($scope.modelType === 'heatmap/') {
						Heatmap.listModels(function(result) {
							$scope.modelsList = result;
						});
					} else {
						Model.listModels(function(result) {
							$scope.modelsList = result;
						});
					}
					break;
				case "tags":
					Tags.listTags({'model_type': mtype}, function(result) {
						$scope.modelsList = result;
					});
					break;
				default:
					break;
			};
			$('#tag-back-btn').hide();
		}
		$scope.importModel = function(fileList) {
			var freader = new FileReader();
			//console.log(fileList[0].name);
			freader.onload = function(evt) {	
				try {
					jobj = JSON.parse(evt.target.result);
					if($scope.modelType === "heatmap/") {
						Heatmap.saveModel(jobj, function(rslt) {
							setGlobalAlerts({message: 'Saved '+rslt._id});
							flashAlertsBar();
							document.getElementById('side-panel').dispatchEvent(new CustomEvent('refresh-model-list', {'detail': 'refresh model list'}));
						});
					} else {
						Model.saveModel(jobj, function(rslt) {
							setGlobalAlerts({message: 'Saved '+rslt._id});
							flashAlertsBar();
							document.getElementById('side-panel').dispatchEvent(new CustomEvent('refresh-model-list', {'detail': 'refresh model list'}));
						});
					}
				} catch(e) {
					console.error("Could not import model", fileList[0].name, e);
				}
			};
			freader.readAsText(fileList[0]);
		}

		$scope.loadList();	
		document.getElementById('side-panel').addEventListener('refresh-model-list', function(evt){$scope.loadList();});
	}
]);
metrilyxControllers.controller('pageController', ['$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model','Heatmap',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, Heatmap) {
		var QUEUED_REQS = [];
		$scope.wssock = getWebSocket();

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
		$scope.editPanelHtml	= connectionPool.nextConnection()+"/partials/edit-panel.html";
		$scope.thresholdsHtml	= connectionPool.nextConnection()+"/partials/thresholds.html";
		$scope.queryEditorHtml	= connectionPool.nextConnection()+"/partials/pagegraph-query-editor.html";
		$scope.graphHtml 		= connectionPool.nextConnection()+"/partials/graph.html";
		$scope.heatGraphHtml 	= connectionPool.nextConnection()+"/partials/heat-graph.html"
		$scope.podHtml 			= connectionPool.nextConnection()+"/partials/pod.html";
		$scope.pageHeaderHtml 	= connectionPool.nextConnection()+"/partials/page-header.html";
		$scope.jsonHtml 		= connectionPool.nextConnection()+"/partials/json.html";
		$scope.graphControlsHtml= connectionPool.nextConnection()+"/partials/graph-controls.html";

		$scope.metricListSortOpts 	= dndconfig.metricList;
		$scope.graphSortOpts 		= dndconfig.graph;
		$scope.podSortOpts 			= dndconfig.pod;
		$scope.columnSortOpts 		= dndconfig.column;
		$scope.rowSortOpts 			= dndconfig.row;
		$scope.layoutSortOpts 		= dndconfig.layout;

		$scope.annoEventTypes = ANNO_EVENT_TYPES;

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
					Model.getModel({pageId: $routeParams.pageId}, function(result) {
						if(result.error) {
							console.log(result);
						} else {
							$scope.model = result;
						}
					});
				} else if($routeParams.heatmapId) {
					Heatmap.getModel({pageId: $routeParams.heatmapId}, function(result) {
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
		
        $scope.wssock.onopen = function() {
          console.log("Connected. Extensions: [" + $scope.wssock.extensions + "]");
          console.log("Queued requests:",QUEUED_REQS.length);
          while(QUEUED_REQS.length > 0) $scope.wssock.send(QUEUED_REQS.shift());
       	}
       	$scope.wssock.onclose = function(e) {
          console.log("Disconnected (clean=" + e.wasClean + ", code=" + e.code + ", reason='" + e.reason + "')");
          $scope.wssock = null;
       	}
       	$scope.wssock.onmessage = function(e) {
       		var data = JSON.parse(e.data);
       		//console.log(data._id, data.annoEvents.eventType);
       		if(data.error) {
       			console.warn(data);
       			setGlobalAlerts(data);
       			flashAlertsBar();
       			return;
       		}
       		var ce = new CustomEvent(data._id, {'detail': data });
       		$scope.wssock.dispatchEvent(ce);
       	}
        $scope.requestData = function(query) {
        	try {
				$scope.wssock.send(JSON.stringify(query));	
        	} catch(e) {
        		// in CONNECTING state. //
        		if(e.code === 11) QUEUED_REQS.push(JSON.stringify(query));
        	}
        }
        $scope.isSerieLoaded = function(graph, serie) {
        	hcg = $("[data-graph-id='"+graph._id+"']").highcharts();
        	if(hcg === undefined) return false;
        	if(graph.graphType === 'pie') {
				for(var j in hcg.series) {
					for(var d in hcg.series[j].data) {
						if(equalObjects(hcg.series[j].data[d].query,serie.query)) {
							return true;
						}
					}
				}
			} else {
				for(var j in hcg.series) {
					if(equalObjects(hcg.series[j].options.query,serie.query)) {
						return true;
					}
				}
			}
			return false;
        }
		$scope.onPageHeaderLoad = function() {
			// setTimeout is to account for processing time //
			setTimeout(function() {
				if($scope.editMode === ' edit-mode') {
					$('input.edit-comp').attr('disabled', false);
				} else {
					$('input.edit-comp').attr('disabled', true); 
				}
			}, 150);
		}
		$scope.onEditPanelLoad = function() {
			document.getElementById('edit-panel').addEventListener('refresh-metric-list',
				function() {
					$scope.searchForMetric($('[ng-model=metricQuery]').val());
				}
			);
		}
		$scope.addNewTags = function(elemSelector) {
			tagstr = $(elemSelector).val();
			var tagsArr = tagstr.split(",");
			for(var t in tagsArr) {
				ctag = tagsArr[t].replace(/\s+$/,'');
				ctag = ctag.replace(/^\s+/,'');
				if($scope.model.tags.indexOf(ctag) < 0) 
					$scope.model.tags.push(ctag);
			}
			$('#add-page-tag').modal('hide');
			$(elemSelector).val('');
		}
		$scope.updateGlobalTag = function(tagkey, tagval) {
			$scope.globalTags[tagkey] = tagval;
			$scope.setGlobalTags($scope.globalTags);
		}
		$scope.setGlobalTags = function(gblTags) {
			tagsLoc = dictToCommaSepStr(gblTags, "=");
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
		}
		$scope.delayLoadPageModel = function(pageId, cb) {
			clearAllTimeouts();
			setTimeout(function() {
				Model.getModel({pageId: pageId}, function(result) {
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
				if(Object.prototype.toString.call(obj[k]) === '[object Array]') {
					if(top[k] == undefined) {
						top[k] = obj[k];
						top[k].push("*");
					} else {
						for(var i in obj[k]) {
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
			$scope.tagsOnPage = top;
			//console.log($scope.tagsOnPage);
		}
		$scope.setTimeType = function(newRelativeTime, reloadPage) {
			$scope.timeType = newRelativeTime;
			if(reloadPage !== undefined && reloadPage) 
				$scope.delayLoadPageModel($routeParams.pageId);
		}
		$scope.searchForMetric = function(args) {
			/* 
				'this.metricQuery' must be used rather than '$scope.metricQuery' because 
				edit-panel is ng-include so a new scope gets created.
			*/
			var qstr;
			if(args && args !== "") qstr = args;
			if(this.metricQuery && this.metricQuery !== "") qstr = this.metricQuery;
			if(qstr == "" || qstr == undefined) return;
			Metrics.suggest(qstr, function(result) {
				$scope.metricQuery = qstr;
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
			});
		}
		// Load initial empty page -> pod -> graph //
		$scope.setUpdatesEnabled = function(value) {
			$scope.updatesEnabled = value;
		}
		$scope.setStartTime = function(sTime) {
			if($scope.endTime && ($scope.sTime > $scope.endTime)) return;
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
				$('[data-graph-id]').each(function() {
					hc = $(this).highcharts();
					if(hc != undefined) {
						hc.reflow();
					}
				});
			}, 500);
		}
		$scope.getTimeWindow = function() {
			if($scope.timeType == "absolute"){
				if($scope.endTime) 
					return {
						end: $scope.endTime, 
						start: $scope.startTime
					};
				return {
					start: $scope.startTime, 
					end: Math.ceil((new Date()).getTime()/1000)
				};
			} else {
				return {
					start: Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime($scope.timeType)),
					end: Math.ceil((new Date()).getTime()/1000)
				};
			}
		}
		$scope.baseQuery = function(graphObj) {
			var q = {
				_id: graphObj._id,
				graphType: graphObj.graphType,
				tags: $scope.globalTags,
				thresholds: graphObj.thresholds,
				annoEvents: graphObj.annoEvents,
				multiPane: graphObj.multiPane,
				panes: graphObj.panes,
				totalSeries: graphObj.series.length
			};
			//console.log('series', graphObj.series.length);
			return $.extend(true, q, $scope.getTimeWindow());
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
				$scope.enableEditMode();
			} else {
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
				document.getElementById('side-panel').dispatchEvent(new CustomEvent('refresh-model-list', {'detail': 'refresh model list'}));
			}
		}
		$scope.removeModel = function(callback) {
			if($scope.modelType == "") {
				Model.removeModel({pageId: $scope.model._id}, {}, function(result) {
					_removeModelCallback(result);
				});
			} else {
				//console.log($scope.model._id);
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
				document.getElementById('side-panel').dispatchEvent(new CustomEvent('refresh-model-list', {'detail': 'refresh model list'}));
				if(location.hash === currpath) {
					location.reload(true);
				} else {
					location.hash = currpath;
				}
			}
		}
		$scope.saveModel = function(args) {
			//console.log($scope.model);
			if($scope.modelType == "") {
				if($routeParams.pageId == 'new') {
					Model.saveModel($scope.model, function(result) {
						_saveModelCallback(result);
					});
				} else {
					Model.editModel({'pageId': $scope.model._id}, $scope.model, function(result) {
						_saveModelCallback(result);
					});
				}
			} else {
				if($routeParams.heatmapId == 'new') {
					Heatmap.saveModel($scope.model, 
						function(result) {
							_saveModelCallback(result);
						}
					);
				} else {
					Heatmap.editModel({'pageId': $scope.model._id}, $scope.model, 
						function(result) {
							_saveModelCallback(result);
						}
					);
				}
			}
		}
		$scope.setPlotBands = function(graph) {
			setPlotBands(graph);
			$('#'+graph._id+'-thresholds').collapse('hide');
		}
		$scope.removeTag = function(tags, tagkey) {
			delete tags[tagkey];
		}
		$scope.loadHome = function() {
			$location.path('/graph').search({});
			$route.reload();
		}
		$scope.reloadGraph = function(gobj) {
			$('.adhoc-metric-editor').hide();
			if(gobj.series.length < 1) return;

			//for(var s in gobj.series) {
			//	gobj.series[s].loading = "loading";
			//}
			//$scope.setURL(gobj);

			q = $scope.baseQuery(gobj)
			q.series = gobj.series;
			$scope.requestData(q);
			// destroy current graph //
			try{$('[data-graph-id='+gobj._id+']').highcharts().destroy();}catch(e){}
			$('[data-graph-id='+gobj._id+']').html(
				"<table class='gif-loader-table'><tr><td> \
				<img src='/imgs/loader.gif'></td></tr></table>");
		}
		$scope.$on('$destroy', function() {
			try {$scope.wssock.close();} catch(e){};
			$scope.wssock = null;
		});
}]);

metrilyxControllers.controller('adhocGraphController', ['$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model) {
		var QUEUED_REQS = [];
		$scope.wssock = getWebSocket();

		$scope.annoEventTypes 	= ANNO_EVENT_TYPES;
		$scope.modelType 		= "adhoc";
		$scope.timeType 		= "1h-ago";
		$scope.editMode 		= " edit-mode";
		
		$scope.pageMastHtml		= connectionPool.nextConnection()+"/partials/page-mast.html";
		$scope.editPanelHtml	= connectionPool.nextConnection()+"/partials/edit-panel.html";
		$scope.pageHeaderHtml 	= connectionPool.nextConnection()+"/partials/page-header.html";
		$scope.thresholdsHtml	= connectionPool.nextConnection()+"/partials/thresholds.html";
		$scope.queryEditorHtml	= connectionPool.nextConnection()+"/partials/adhocgraph-query-editor.html";

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
							'tags': commaSepStrToDict(arr[2],":")
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
		$scope.onEditPanelLoad = function() {
			document.getElementById('edit-panel').addEventListener('refresh-metric-list',
				function() {
					$scope.searchForMetric($('[ng-model=metricQuery]').val());
				}
			);
		}
		$scope.removeTag = function(tags, tagkey) {
			delete tags[tagkey];
		}
		$scope.setStatus = function(serieIdx, status) {
			$scope.graph.series[serieIdx].loading = status;
		}
		$scope.getTimeWindow = function() {
			if($scope.timeType == "absolute"){
				if($scope.endTime) 
					return {
						end: $scope.endTime, 
						start: $scope.startTime
					};
				return {
					start: $scope.startTime, 
					end: Math.ceil((new Date()).getTime()/1000)
				};
			} else {
				return {
					start: Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime($scope.timeType)),
					end: Math.ceil((new Date()).getTime()/1000)
				};
			}
		}
		$scope.baseQuery = function(graphObj) {
			var q = {
				_id: graphObj._id,
				graphType: graphObj.graphType,
				tags: {},
				thresholds: graphObj.thresholds,
				annoEvents: graphObj.annoEvents
			};
			$.extend(q, $scope.getTimeWindow(),true);
			return q;
		}

        $scope.wssock.onopen = function() {
          console.log("Connected. Extensions: [" + $scope.wssock.extensions + "]");
          console.log("Queued requests:",QUEUED_REQS.length);
          while(QUEUED_REQS.length > 0) $scope.wssock.send(QUEUED_REQS.shift());
       	}
       	$scope.wssock.onclose = function(e) {
          console.log("Disconnected (clean=" + e.wasClean + ", code=" + e.code + ", reason='" + e.reason + "')");
          $scope.wssock = null;
       	}
       	$scope.wssock.onmessage = function(e) {
       		var data = JSON.parse(e.data);
       		if(data.error) {
       			console.warn(data);
       			setGlobalAlerts(data);
       			flashAlertsBar();
       			return;
       		}
       		var ce = new CustomEvent(data._id, {'detail': data });
       		$scope.wssock.dispatchEvent(ce);
       	}
        $scope.requestData = function(query) {
        	try {
				$scope.wssock.send(JSON.stringify(query));	
        	} catch(e) {
        		// in CONNECTING state. //
        		if(e.code === 11) {
        			QUEUED_REQS.push(JSON.stringify(query));
        		} else {
        			console.error(e)
        		}
        	}
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
				if(Object.prototype.toString.call(obj[k]) === '[object Array]') {
					if(top[k] == undefined) {
						top[k] = obj[k];
						top[k].push("*");
					} else {
						for(var i in obj[k]) {
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
			// this may be very expensive //
			for(var k in top) top[k].sort();
			$scope.tagsOnPage = top;
			//console.log($scope.tagsOnPage);
		}
		$scope.reloadGraph = function(gobj) {
			if(!gobj) gobj = $scope.graph;
			$('.adhoc-metric-editor').hide();
			if(gobj.series.length < 1) return;
			$scope.setURL(gobj);

			q = $scope.baseQuery(gobj)
			q.series = gobj.series;
			$scope.requestData(q);
			// destroy current graph //
			try { $('[data-graph-id='+gobj._id+']').highcharts().destroy(); } catch(e) {};
			$('[data-graph-id='+gobj._id+']').html(
				"<table class='gif-loader-table'><tr><td> \
				<img src='/imgs/loader.gif'></td></tr></table>");
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
			var qstr;
			if(args && args !== "") qstr = args;
			if(this.metricQuery && this.metricQuery !== "") qstr = this.metricQuery;
			if(qstr == "" || qstr == undefined) return;
			Metrics.suggest(qstr, function(result) {
				$scope.metricQuery = qstr;
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
			}, 350);
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
		}
		$scope.updateGlobalTag = function(tagkey, tagval) {
			if(tagkey == undefined || tagkey == "") return;
			for(var s in $scope.graph.series) {
				$scope.graph.series[s].query.tags[tagkey] = tagval;
			}
			$scope.setURL($scope.graph);
			$route.reload();
		}
		$scope.$on('$destroy', function() {
			try {$scope.wssock.close();} catch(e){};
			$scope.wssock = null;
		});
}]);

