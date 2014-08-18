/* controllers.js */

var metrilyxControllers = angular.module('metrilyxControllers', []);
metrilyxControllers.controller('staticsController', ['$scope', '$route', '$routeParams', '$location',
	function($scope, $route, $routeParams, $location) {
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
				$('#selected-tag').show();
				$('#selected-tag').parent().addClass('padb10');
				$('.model-list-container').addClass('tag-selected');
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
			$('#selected-tag').hide();
			$('.model-list-container').removeClass('tag-selected');
			$('#selected-tag').parent().removeClass('padb10');
		}
		$scope.importModel = function(fileList) {
			var freader = new FileReader();
			//console.log(fileList[0].name);
			freader.onload = function(evt) {
				try {
					jobj = JSON.parse(evt.target.result);
					if($scope.modelType === "heatmap/") {
						Heatmap.saveModel(jobj, function(rslt) {
							setGlobalAlerts({message: 'Imported '+rslt._id});
							flashAlertsBar();
							document.getElementById('side-panel').dispatchEvent(new CustomEvent('refresh-model-list', {'detail': 'refresh model list'}));
						});
					} else {
						Model.saveModel(jobj, function(rslt) {
							setGlobalAlerts({message: 'Imported '+rslt._id});
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
metrilyxControllers.controller('pageController', ['$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model','Heatmap', 'EventTypes',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, Heatmap, EventTypes) {
		var QUEUED_REQS = [];
		var modelGraphIds = [];

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
		$('#side-panel').addClass('offstage');

		$scope.pageMastHtml			= connectionPool.nextConnection()+"/partials/page-mast.html";
		$scope.editPanelHtml		= connectionPool.nextConnection()+"/partials/edit-panel.html";
		$scope.thresholdsHtml		= connectionPool.nextConnection()+"/partials/thresholds.html";
		$scope.queryEditorHtml		= connectionPool.nextConnection()+"/partials/pagegraph-query-editor.html";
		$scope.graphHtml 			= connectionPool.nextConnection()+"/partials/graph.html";
		$scope.heatGraphHtml 		= connectionPool.nextConnection()+"/partials/heat-graph.html"
		$scope.podHtml 				= connectionPool.nextConnection()+"/partials/pod.html";
		$scope.pageHeaderHtml 		= connectionPool.nextConnection()+"/partials/page-header.html";
		$scope.graphControlsHtml	= connectionPool.nextConnection()+"/partials/graph-controls.html";
		$scope.annoControlsHtml		= connectionPool.nextConnection()+"/partials/global-anno-controls.html";
		$scope.eventAnnoDetailsHtml = connectionPool.nextConnection()+"/partials/event-anno-details.html";
		$scope.metricOperationsHtml	= connectionPool.nextConnection()+"/partials/metric-operations.html";

		$scope.metricListSortOpts 	= DNDCONFIG.metricList;
		$scope.graphSortOpts 		= DNDCONFIG.graph;
		$scope.podSortOpts 			= DNDCONFIG.pod;
		$scope.columnSortOpts 		= DNDCONFIG.column;
		$scope.rowSortOpts 			= DNDCONFIG.row;
		$scope.layoutSortOpts 		= DNDCONFIG.layout;

		$scope.selectedAnno = {};
		$scope.globalAnno = {'eventTypes':[], 'tags':{}, 'status': null};
		$scope.modelGraphIdIdx = {};

		// set default to relative time //
		$scope.timeType = "1h-ago";
		// relative time or 'absolute' //
		var urlParams = $location.search();
		if(urlParams.start) {
			if(urlParams.end) {
				$scope.endTime = parseInt(urlParams.end);
				$scope.timeType = "absolute";
				$scope.updatesEnabled = false;
			} else {
				$scope.timeType = urlParams.start;
			}
			$scope.startTime = urlParams.start;
		}
		if(urlParams.annotationTypes && urlParams.annotationTags) {
			try {
				$scope.globalAnno = {
					'eventTypes': urlParams.annotationTypes.split(/\|/),
					'tags': commaSepStrToDict(urlParams.annotationTags),
					'status': $scope.globalAnno.status,
				}
			} catch(e) {console.warning("failed to parse annotation data", e);}
		}
		EventTypes.listTypes(function(rslt) {
			out = [];
			for(var i in rslt) {
				if(rslt[i].name === undefined || $scope.globalAnno.eventTypes.indexOf(rslt[i].name) >= 0) continue;
				out.push(rslt[i].name);
			}
			$scope.annoEventTypes = out;
		});
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
							modelGraphIds = getModelGraphIds();
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
		// index graph id's for the model //
		function getModelGraphIds() {
			out = [];
   			for(var r in $scope.model.layout) {
   				for(var c in $scope.model.layout[r]) {
   					for(var p in $scope.model.layout[r][c]) {
   						for(var g in $scope.model.layout[r][c][p].graphs) {
   							out.push($scope.model.layout[r][c][p].graphs[g]._id);
   						}
   					}
   				}
   			}
       		return out;
		}
		function onOpenWssock() {
          console.log("Connected. Extensions: [" + $scope.wssock.extensions + "]");
          console.log("Queued requests:",QUEUED_REQS.length);
          while(QUEUED_REQS.length > 0) $scope.wssock.send(QUEUED_REQS.shift());
       	}
       	function onCloseWssock(e) {
          console.log("Disconnected (clean=" + e.wasClean + ", code=" + e.code + ", reason='" + e.reason + "')");
          $scope.wssock = null;
       	}
       	function onMessageWssock(e) {
       		var data = JSON.parse(e.data);
       		if(data.error) {
       			console.warn(data);
       			setGlobalAlerts(data);
       			flashAlertsBar();
       		} else if(data.annoEvents) {
       			// annotations //
       			$scope.globalAnno.status = 'dispatching';
       			for(var i in $scope.modelGraphIdIdx) {
       				data._id = i;
       				var ce = new CustomEvent(data._id, {'detail': data });
       				$scope.wssock.dispatchEvent(ce);
       			}
       			$scope.globalAnno.status = 'dispatched';
       		} else {
       			// graph data //
	       		var ce = new CustomEvent(data._id, {'detail': data });
	       		$scope.wssock.dispatchEvent(ce);
       		}
       	}
       	function setupWebSocket() {
			$scope.wssock = getWebSocket();
        	$scope.wssock.onopen = onOpenWssock;
       		$scope.wssock.onclose = onCloseWssock;
       		$scope.wssock.onmessage = onMessageWssock;
		}
		setupWebSocket();
        $scope.requestData = function(query) {
        	try {
				$scope.wssock.send(JSON.stringify(query));
        	} catch(e) {
        		// in CONNECTING state. //
        		if(e.code === 11) {
        			QUEUED_REQS.push(JSON.stringify(query));
        		} else {
        			//QUEUED_REQS.push(JSON.stringify(query));
        			//console.log('Reconnecting...')
        			//setupWebSocket();
        			// TODO: display alert
        		}
        	}
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
		// called when a graph adds a ws evt listener //
		$scope.addEvtListenerGraphId = function(graphId) {
			$scope.modelGraphIdIdx[graphId] = true;
			if(Object.keys($scope.modelGraphIdIdx).length === modelGraphIds.length) {
				// trigger annotation request as all graph elems are loaded //
				$scope.globalAnno.status = 'load';
			}
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
			tagsLoc = dictToCommaSepStr(gblTags, ":");
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

		var timerSearchForMetric;
		$scope.searchForMetric = function(args) {
			/*
				'this.metricQuery' must be used rather than '$scope.metricQuery' because
				edit-panel is ng-include so a new scope gets created.
			*/
			if (timerSearchForMetric)
				clearTimeout(timerSearchForMetric);

			var myThis = this;
			timerSearchForMetric = setTimeout(function(){
				var qstr;
				if(args && args !== "") qstr = args;
				if(myThis.metricQuery && myThis.metricQuery !== "") qstr = myThis.metricQuery;
				if(qstr == "" || qstr == undefined) {
					$scope.metricQueryResult = [];
					return;
				}
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
			}, 1000);
		}
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
		$scope.setAnnotations = function() {
			tmp = $location.search();
			tmp.annotationTypes = $scope.globalAnno.eventTypes.join("|");
			tmp.annotationTags = dictToCommaSepStr($scope.globalAnno.tags, ":");
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
			}, 600);
		}
		$scope.getTimeWindow = function(inMilli) {
			if($scope.timeType == "absolute"){
				if($scope.endTime) {
					if(inMilli) {
						return {
							end: $scope.endTime*1000,
							start: $scope.startTime*1000};
					}
					return {
						end: $scope.endTime,
						start: $scope.startTime
					};
				}
				if(inMilli) {
					return {
						start: $scope.startTime*1000,
						end: Math.ceil((new Date()).getTime())
					};
				}
				return {
					start: $scope.startTime,
					end: Math.ceil((new Date()).getTime()/1000)
				};
			} else {
				if(inMilli) {
					return {
						start: (Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime($scope.timeType)))*1000,
						end: Math.ceil((new Date()).getTime())
					};
				} else {
					return {
						start: Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime($scope.timeType)),
						end: Math.ceil((new Date()).getTime()/1000)
					};
				}
			}
		}
		$scope.baseQuery = function(graphObj) {
			var q = {
				_id: graphObj._id,
				name: graphObj.name,
				graphType: graphObj.graphType,
				tags: $scope.globalTags,
				thresholds: graphObj.thresholds,
				//annoEvents: graphObj.annoEvents,
				multiPane: graphObj.multiPane,
				panes: graphObj.panes,
				secondaries: graphObj.secondaries
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
		}
		$scope.hideGraphControls = function(graph) {
			$("[data-graph-controls='"+graph._id+"']").hide();
		}
		$scope.removeTag = function(tags, tagkey) {
			delete tags[tagkey];
		}
		$scope.loadHome = function() {
			$location.path('/graph').search({});
			$route.reload();
		}
		$scope.previewGraph = function(graph) {
			$scope.reloadGraph(graph);
			$("[data-query-set='"+graph._id+"']").collapse('hide');
		}
		$scope.reloadGraph = function(gobj) {
			$('.adhoc-metric-editor').hide();
			if(gobj.series.length < 1) return;
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
		submitAnalytics({page: "/"+$routeParams.pageId, title: $routeParams.pageId});
}]);

metrilyxControllers.controller('adhocGraphController', ['$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model', 'EventTypes',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, EventTypes) {
		var QUEUED_REQS = [];

		$scope.modelType 		= "adhoc";
		$scope.timeType 		= "1h-ago";
		$scope.editMode 		= " edit-mode";
		$scope.updatesEnabled 	= false;

		$scope.pageMastHtml			= connectionPool.nextConnection()+"/partials/page-mast.html";
		$scope.editPanelHtml		= connectionPool.nextConnection()+"/partials/edit-panel.html";
		$scope.pageHeaderHtml 		= connectionPool.nextConnection()+"/partials/page-header.html";
		$scope.thresholdsHtml		= connectionPool.nextConnection()+"/partials/thresholds.html";
		$scope.queryEditorHtml		= connectionPool.nextConnection()+"/partials/adhocgraph-query-editor.html";
		$scope.annoControlsHtml		= connectionPool.nextConnection()+"/partials/global-anno-controls.html";
		$scope.eventAnnoDetailsHtml = connectionPool.nextConnection()+"/partials/event-anno-details.html";

		$scope.metricListSortOpts 	= DNDCONFIG.metricList;

		$scope.metricQueryResult = [];
		$scope.tagsOnPage = {};
		$scope.graph = {};
		$scope.globalAnno = {'eventTypes':[], 'tags':{}, 'status': null};
		$scope.globalTags = {};

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
							dmm = arr[0].split("-");
							wmm = arr[1].split("-");
							imm = arr[2].split("-");
							graphModel.thresholds = {
								'danger': {max:dmm[0],min:dmm[1]},
								'warning': {max:wmm[0],min:wmm[1]},
								'info': {max:imm[0],min:imm[1]}
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
							'tags': commaSepStrToDict(arr[2])
						}
					});
				}
				//console.log(graphModel);
				$scope.graph = graphModel;
				$scope.reloadGraph();
				/*
				setTimeout(function() {
					$("[data-graph-id='"+$scope.graph._id+"']").html(
						"<table class='gif-loader-table'><tr><td> \
						<img src='/imgs/loader.gif'></td></tr></table>");
				},400);
				*/
			} else {
				// initial empty page
				graphModel.thresholds.danger.max = '';
				graphModel.thresholds.danger.min = '';
				graphModel.thresholds.warning.max = '';
				graphModel.thresholds.warning.min = '';
				graphModel.thresholds.info.max = '';
				graphModel.thresholds.info.min = '';
				$scope.graph = graphModel;
			}
		});
		if($routeParams.annotationTypes && $routeParams.annotationTags) {
			try {
				$scope.globalAnno = {
					'eventTypes': $routeParams.annotationTypes.split(/\|/),
					'tags': commaSepStrToDict($routeParams.annotationTags),
					'status': 'load',
				}
			} catch(e) {console.warning("failed to parse annotation data", e);}
		}
		EventTypes.listTypes(function(rslt) {
			out = [];
			for(var i in rslt) {
				if(rslt[i].name === undefined || $scope.globalAnno.eventTypes.indexOf(rslt[i].name) >= 0) continue;
				out.push(rslt[i].name);
			}
			$scope.annoEventTypes = out;
		});
		$('#side-panel').addClass('offstage');
		if($scope.editMode === "") {
			$scope.metricListSortOpts.disabled = true;
		} else {
			$scope.metricListSortOpts.disabled = false;
		}
		function onOpenWssock() {
			console.log("Connected. Extensions: [" + $scope.wssock.extensions + "]");
          	console.log("Queued requests:",QUEUED_REQS.length);
          	setTimeout(function() {
          		while(QUEUED_REQS.length > 0) $scope.wssock.send(QUEUED_REQS.shift());
          	}, 750);
		}
		function onCloseWssock(e) {
			console.log("Disconnected (clean=" + e.wasClean + ", code=" + e.code + ", reason='" + e.reason + "')");
			$scope.wssock = null;
			/*
			setGlobalAlerts({'error': 'Disconnected', 'message': "Disconnected (clean=" + e.wasClean + ", code=" +
					e.code + ", reason='" + e.reason + "')"});
			flashAlertsBar();*/
		}
		function onMessageWssock(e) {
       		var data = JSON.parse(e.data);
       		if(data.error) {
       			console.warn(data);
       			setGlobalAlerts(data);
       			flashAlertsBar();
       		} else if(data.annoEvents) {
       			// annotations //
       			$scope.globalAnno.status = 'dispatching';
   				data._id = $scope.graph._id;
   				var ce = new CustomEvent(data._id, {'detail': data });
   				$scope.wssock.dispatchEvent(ce);
       			$scope.globalAnno.status = 'dispatched';
       		} else {
       			// graph data //
	       		var ce = new CustomEvent(data._id, {'detail': data });
	       		$scope.wssock.dispatchEvent(ce);
       		}
		}
		function setupWebSocket() {
			$scope.wssock = getWebSocket();
        	$scope.wssock.onopen = onOpenWssock;
       		$scope.wssock.onclose = onCloseWssock;
       		$scope.wssock.onmessage = onMessageWssock;
		}
        setupWebSocket();

        $scope.setUpdatesEnabled = function(value) {
			$scope.updatesEnabled = value;
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
		}/*
		$scope.getTimeWindow = function() {
			if($scope.timeType == "absolute"){
				if($scope.endTime)
					return {
						start: parseFloat($scope.startTime),
						end: parseFloat($scope.endTime)
					};
				return {
					start: parseFloat($scope.startTime),
					end: Math.ceil((new Date()).getTime()/1000)
				};
			} else {
				return {
					start: Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime($scope.timeType)),
					end: Math.ceil((new Date()).getTime()/1000)
				};
			}
		}*/
		$scope.getTimeWindow = function(inMilli) {
			if($scope.timeType == "absolute"){
				if($scope.endTime) {
					if(inMilli) {
						return {
							end: $scope.endTime*1000,
							start: $scope.startTime*1000};
					}
					return {
						end: $scope.endTime,
						start: $scope.startTime
					};
				}
				if(inMilli) {
					return {
						start: $scope.startTime*1000,
						end: Math.ceil((new Date()).getTime())
					};
				}
				return {
					start: $scope.startTime,
					end: Math.ceil((new Date()).getTime()/1000)
				};
			} else {
				if(inMilli) {
					return {
						start: (Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime($scope.timeType)))*1000,
						end: Math.ceil((new Date()).getTime())
					};
				} else {
					return {
						start: Math.floor(((new Date()).getTime()/1000)-relativeToAbsoluteTime($scope.timeType)),
						end: Math.ceil((new Date()).getTime()/1000)
					};
				}
			}
		}
		$scope.baseQuery = function(graphObj) {
			var q = {
				_id: graphObj._id,
				name: graphObj.name,
				graphType: graphObj.graphType,
				tags: {},
				thresholds: graphObj.thresholds,
				annoEvents: graphObj.annoEvents,
				secondaries: graphObj.secondaries
			};
			$.extend(q, $scope.getTimeWindow(),true);
			return q;
		}

        $scope.requestData = function(query) {
        	jsonQuery = JSON.stringify(query);
        	try {
				$scope.wssock.send(jsonQuery);
        	} catch(e) {
        		// in CONNECTING state. //
        		if(e.code === 11) {
        			QUEUED_REQS.push(jsonQuery);
        		} else {
        			//console.warn(e);
        			console.log("Queueing request...");
        			QUEUED_REQS.push(jsonQuery);
        			console.log('Reconnecting...')
        			setupWebSocket();
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
				'thresholds': $scope.graph.thresholds.danger.max + "-" + $scope.graph.thresholds.danger.min +
					":"+$scope.graph.thresholds.warning.max + "-" + $scope.graph.thresholds.warning.min +
					":"+$scope.graph.thresholds.info.max + "-" + $scope.graph.thresholds.info.min,
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
			srch.annotationTypes = $scope.globalAnno.eventTypes.join("|");
			srch.annotationTags = dictToCommaSepStr($scope.globalAnno.tags, ":");
			$location.search(srch);
		}
		$scope.setAnnotations = function() {
			// re-initialize graph //
			$scope.reloadGraph();
			$scope.globalAnno.status = 'reload';
			tmp = $location.search();
			tmp.annotationTypes = $scope.globalAnno.eventTypes.join("|");
			tmp.annotationTags = dictToCommaSepStr($scope.globalAnno.tags, ":");
			$location.search(tmp);
			$('.graph-control-details.global-anno').hide();
		}
		// called when a graph adds a ws evt listener //
		$scope.addEvtListenerGraphId = function(graphId) {
			// in adhoc mode there is only 1 graph //
			//$scope.globalAnno.status = 'load';
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
		}
		$scope.reloadGraph = function(gobj) {
			if(!gobj) gobj = $scope.graph;
			$('.adhoc-metric-editor').hide();
			if(gobj.series.length < 1) return;
			$scope.setURL(gobj);

			q = $scope.baseQuery(gobj)
			q.series = gobj.series;
			
			// destroy current graph //
			try { $("[data-graph-id='"+gobj._id+"']").highcharts().destroy(); } catch(e) {};
			$("[data-graph-id='"+gobj._id+"']").html(
				"<table class='gif-loader-table'><tr><td> \
				<img src='/imgs/loader.gif'></td></tr></table>");
			$scope.requestData(q);
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


		var timerSearchForMetric;
		$scope.searchForMetric = function(args) {
			if (timerSearchForMetric)
				clearTimeout(timerSearchForMetric);

			var myThis = this;
			timerSearchForMetric = setTimeout(function(){
				var qstr;
				if(args && args !== "") qstr = args;
				if(myThis.metricQuery && myThis.metricQuery !== "") qstr = myThis.metricQuery;
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
			}, 1000);
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
			}, 500);
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
		submitAnalytics({title:'adhoc',page:'/graph'});
}]);
