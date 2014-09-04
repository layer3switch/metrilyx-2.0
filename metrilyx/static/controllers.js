/* controllers.js */

var metrilyxControllers = angular.module('metrilyxControllers', []);

metrilyxControllers.controller('staticsController', [
	'$scope', '$route', '$routeParams', '$location', 'ComponentTemplates',
	function($scope, $route, $routeParams, $location, ComponentTemplates) {
		
		$scope.modelType = "static";

		clearAllTimeouts();
		
		var compTemplates = new ComponentTemplates($scope);

		$scope.loadHome = function() {
			$location.path('/graph').search({});
			$route.reload();
		}
	}
]);
metrilyxControllers.controller('sidePanelController', [
	'$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model', 'Heatmap','Tags',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, Heatmap, Tags) {
		
		$scope.modelType = "";
		
		$scope.modelsList = [];
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
metrilyxControllers.controller('pageController', [
	'$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model','Heatmap', 'EventTypes', 'TimeWindow', 'ComponentTemplates', 'WebSocketDataProvider', 'AnnotationOptions',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, Heatmap, EventTypes, TimeWindow, ComponentTemplates, WebSocketDataProvider, AnnotationOptions) {

		$scope.modelType = "";
		$scope.modelGraphIds = [];

		if($routeParams.heatmapId) $scope.modelType = "heatmap/";
		else $scope.tagsOnPage = {};

		var annoOptions = new AnnotationOptions($scope, $routeParams, $location, EventTypes);

		var compTemplates = new ComponentTemplates($scope);

		var timeWindow = new TimeWindow($scope, $routeParams);

		var wsdp = new WebSocketDataProvider($scope);

		if($routeParams.pageId == "new" || $routeParams.heatmapId == 'new') {
			
			$scope.editMode = " edit-mode";
			$scope.updatesEnabled = false;
		} else {
			
			$scope.editMode = "";
		}

		clearAllTimeouts();
		// make sure modal window is not lingering around //
		$('#confirm-delete').modal('hide');
		$('.modal-backdrop').remove();
		$('#side-panel').addClass('offstage');

		$scope.metricListSortOpts 	= DNDCONFIG.metricList;
		$scope.graphSortOpts 		= DNDCONFIG.graph;
		$scope.podSortOpts 			= DNDCONFIG.pod;
		$scope.columnSortOpts 		= DNDCONFIG.column;
		$scope.rowSortOpts 			= DNDCONFIG.row;
		$scope.layoutSortOpts 		= DNDCONFIG.layout;

		var urlParams = $location.search();

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

		$scope.enableDragDrop = function() {
			$('[ui-sortable]').each(function() {
				$(this).sortable({disabled: false});
			});
		}

		Schema.get({modelType: 'pod'},function(podModel){
			/* used for dropped pod */
			$scope.droppablePodSchema = [ podModel ];
			if((!$routeParams.pageId && !$routeParams.heatmapId) || $routeParams.pageId == "new" || $routeParams.heatmapId == "new") {
				Schema.get({modelType: 'page'}, function(pageModel) {
					$scope.model = pageModel;
					$scope.model.layout[0][0][0] = JSON.parse(JSON.stringify(podModel));
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
							$scope.modelGraphIds = getModelGraphIds();
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
   			for(var r=0; r < $scope.model.layout.length; r++) {
   				for(var c=0; c < $scope.model.layout[r].length; c++) {
   					for(var p=0; p < $scope.model.layout[r][c].length; p++) {
   						for(var g=0; g < $scope.model.layout[r][c][p].graphs.length; g++) {
   							out.push($scope.model.layout[r][c][p].graphs[g]._id);
   						}
   					}
   				}
   			}
       		return out;
		}
		$scope.isTimeSeriesGraph = function(graphType) {
			return !(graphType === 'pie' ||graphType === 'column' || graphType === 'bar');
		}

		$scope.requestData = function(query) {
			wsdp.requestData(query);
		}
		$scope.addGraphIdEventListener = function(graphId, funct) {
			wsdp.addGraphIdEventListener(graphId, funct);
       	}
       	$scope.removeGraphIdEventListener = function(graphId, funct) {
       		wsdp.removeGraphIdEventListener(graphId, funct);
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
			for(var t=0; t < tagsArr.length; t++) {
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
						for(var i=0; i < result.length; i++) {
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
			
			timeWindow.setAttribute('startTime', sTime);
		}
		$scope.setEndTime = function(eTime) {
			
			timeWindow.setAttribute('endTime', eTime);
		}
		$scope.setAbsoluteTime = function() {
			
			var tmp = $location.search();
			tmp.start = $scope.startTime;
			tmp.end = $scope.endTime;
			$location.search(tmp);
		}
		$scope.setTimeType = function(newRelativeTime, reloadPage) {
			
			timeWindow.setAttribute('timeType', newRelativeTime);
			if(reloadPage !== undefined && reloadPage) $scope.delayLoadPageModel($routeParams.pageId);
		}
		$scope.getTimeWindow = function(inMilli) {

			return timeWindow.getTimeFrame(inMilli);
		}

		$scope.setAnnotations = function() {

			annoOptions.applyAnnotationOptions();
		}
		
		$scope.addGraph = function(toPod) {
			Schema.get({modelType:'graph'}, function(result) {
				toPod.graphs.push(result);
				$scope.reflow();
			});
		}

		$scope.addSecondaryMetric = function(toGraph) {
			Schema.get({modelType:'metric'}, function(result) {
				toGraph.secondaries.push(result);
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
		
		$scope.baseQuery = function(graphObj) {
			var q = {
				_id: graphObj._id,
				name: graphObj.name,
				graphType: graphObj.graphType,
				tags: $scope.globalTags,
				thresholds: graphObj.thresholds,
				multiPane: graphObj.multiPane,
				panes: graphObj.panes,
				secondaries: graphObj.secondaries
			};

			return $.extend(true, q, $scope.getTimeWindow());
		}
		$scope.disableDragDrop = function() {
			$('[ui-sortable]').each(function() {
				$(this).sortable({disabled: true});
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
				document.getElementById('side-panel').dispatchEvent(
					new CustomEvent('refresh-model-list', {'detail': 'refresh model list'}));
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
				$route.reload();
			}
		}
		$scope.saveModel = function(args) {
			//console.log($scope.model);
			if($scope.modelType == "") {
				if($routeParams.pageId == 'new') {
					Model.saveModel($scope.model, 
						function(result) {
							_saveModelCallback(result);
						}, modelManagerErrback);
				} else {
					Model.editModel({'pageId': $scope.model._id}, $scope.model, 
						function(result) {
							_saveModelCallback(result);
						}, modelManagerErrback);
				}
			} else {
				if($routeParams.heatmapId == 'new') {
					Heatmap.saveModel($scope.model,
						function(result) {
							_saveModelCallback(result);
						}, modelManagerErrback);
				} else {
					Heatmap.editModel({'pageId': $scope.model._id}, $scope.model,
						function(result) {
							_saveModelCallback(result);
						}, modelManagerErrback);
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

			var domNode = $('[data-graph-id='+gobj._id+']');
			try { domNode.highcharts().destroy(); } catch(e) {}
			domNode.html("<table class='gif-loader-table'><tr><td><img src='/imgs/loader.gif'></td></tr></table>");
		}

		$scope.$on('$destroy', function() {
			try { wsdp.closeConnection(); } catch(e){};
		});
		
		submitAnalytics({page: "/"+$routeParams.pageId, title: $routeParams.pageId});
}]);
metrilyxControllers.controller('adhocGraphController', [
	'$scope', '$route', '$routeParams', '$location', '$http', 'Metrics', 'Schema', 'Model', 'EventTypes', 'TimeWindow', 'ComponentTemplates', 'WebSocketDataProvider', 'AnnotationOptions',
	function($scope, $route, $routeParams, $location, $http, Metrics, Schema, Model, EventTypes, TimeWindow, ComponentTemplates, WebSocketDataProvider, AnnotationOptions) {
		
		$scope.modelType 		= "adhoc";
		$scope.modelGraphIds 	= [];

		var annoOptions = new AnnotationOptions($scope, $routeParams, $location, EventTypes);

		var wsdp = new WebSocketDataProvider($scope);
		
		var compTemplates = new ComponentTemplates($scope);

		var timeWindow = new TimeWindow($scope, $routeParams);

		if($routeParams.editMode === "false") $scope.editMode = "";
		else $scope.editMode = " edit-mode";

		$scope.metricListSortOpts 	= DNDCONFIG.metricList;

		$scope.metricQueryResult = [];
		$scope.tagsOnPage = {};
		$scope.graph = {};
		$scope.globalTags = {};

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
				//
				$scope.graph = graphModel;
				$scope.modelGraphIds = [ $scope.graph._id ];
				$scope.reloadGraph();
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

		$('#side-panel').addClass('offstage');
		
		if($scope.editMode === "") {
			$scope.metricListSortOpts.disabled = true;
		} else {
			$scope.metricListSortOpts.disabled = false;
		}

		$scope.addGraphIdEventListener = function(graphId, funct) {
			wsdp.addGraphIdEventListener(graphId, funct);
       	}
       	$scope.removeGraphIdEventListener = function(graphId, funct) {
       		wsdp.removeGraphIdEventListener(graphId, funct);
       	}
       	$scope.requestData = function(query) {
        	wsdp.requestData(query);
        }
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
		}

		$scope.setStartTime = function(sTime) {

			timeWindow.setAttribute('startTime', sTime);
		}
		$scope.setEndTime = function(eTime) {
			
			timeWindow.setAttribute('endTime', eTime);
		}
		$scope.setTimeType = function(newRelativeTime, reloadPage) {
			
			timeWindow.setAttribute('timeType', newRelativeTime);
		}
		$scope.setAbsoluteTime = function() {
		
			$scope.reloadGraph();
			$scope.globalAnno.status = 'reload';
		}
		$scope.getTimeWindow = function(inMilli) {
			return timeWindow.getTimeFrame(inMilli);
		}

		$scope.baseQuery = function(graphObj) {
			var q = {
				_id: graphObj._id,
				name: graphObj.name,
				graphType: graphObj.graphType,
				tags: {},
				thresholds: graphObj.thresholds,
				secondaries: graphObj.secondaries
			};

			$.extend(q, $scope.getTimeWindow(),true);
			return q;
		}

		$scope.setURL = function(obj) {

			var outarr = [];
			for(var s=0; s < obj.series.length; s++) {
				
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

				params += "}{alias:"+serie.alias;
				params += ",yTransform:"+serie.yTransform+"}";
				outarr.push(params);
			}

			var srch = {
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

			var uAnnoTagsStr = dictToCommaSepStr($scope.globalAnno.tags, ":");

			if($scope.globalAnno.eventTypes.length > 0 && uAnnoTagsStr != "") {
				
				srch.annotationTypes = $scope.globalAnno.eventTypes.join("|");
				srch.annotationTags = uAnnoTagsStr;
			}
			
			$location.search(srch);
		}
		$scope.setAnnotations = function() {
			annoOptions.applyAnnotationOptions();
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

			var domNode = $("[data-graph-id='"+gobj._id+"']"); 
			/* destroy current graph */
			try { domNode.highcharts().destroy(); } catch(e) {};
			domNode.html("<table class='gif-loader-table'><tr><td><img src='/imgs/loader.gif'></td></tr></table>");
			
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
		
		$scope.updateGlobalTag = function(tagkey, tagval) {
			if(tagkey == undefined || tagkey == "") return;
			for(var s in $scope.graph.series) {
				$scope.graph.series[s].query.tags[tagkey] = tagval;
			}
			$scope.setURL($scope.graph);
			$route.reload();
		}

		$scope.$on('$destroy', function() {
			try { wsdp.closeConnection(); } catch(e){};
		});

		submitAnalytics({title:'adhoc', page:'/graph'});
}]);
