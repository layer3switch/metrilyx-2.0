/* controllers.js */

var metrilyxControllers = angular.module('metrilyxControllers', []);

metrilyxControllers.controller('staticsController', [
	'$scope', '$route', '$location', 'ComponentTemplates',
	function($scope, $route, $location, ComponentTemplates) {
		
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
	'$scope', 'Schema', 'Model','Tags',
	function($scope, Schema, Model, Tags) {
		
		$scope.modelType = "";
		
		$scope.modelsList = [];
		$scope.modelQuery = "";
		$scope.browseBy = "name"; // name, tags //
		$scope.selectedTag = "";

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

				Tags.listModelsByTag({'model_type': 'graph'}, {'tagname':obj.name}, function(result) {
					$scope.modelsList = result;
				});

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

			switch($scope.browseBy) {
				case "name":
					Model.listModels(function(result) {
						$scope.modelsList = result;
					});
					break;
				case "tags":
					Tags.listTags({'model_type': 'graph'}, function(result) {
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
			freader.onload = function(evt) {
				
				try {

					jobj = JSON.parse(evt.target.result);
					Model.saveModel(jobj, function(rslt) {
						
						setGlobalAlerts({message: 'Imported '+rslt._id});
						flashAlertsBar();
						document.getElementById('side-panel').dispatchEvent(new CustomEvent('refresh-model-list', {'detail': 'refresh model list'}));
					});

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
	'$scope', '$routeParams', '$location', 'Schema', 'Model', 'TimeWindow', 'ComponentTemplates', 'WebSocketDataProvider', 'AnnotationOptions', 'CtrlCommon', 'RouteManager', 'ModelManager',
	function($scope, $routeParams, $location, Schema, Model, TimeWindow, ComponentTemplates, WebSocketDataProvider, AnnotationOptions, CtrlCommon, RouteManager, ModelManager) {

		$scope.modelType = "";
		$scope.modelGraphIds = [];
		
		$scope.tagsOnPage = {};

		var annoOptions 	= new AnnotationOptions($scope);
		var compTemplates 	= new ComponentTemplates($scope);
		var timeWindow 		= new TimeWindow($scope);
		var wsdp 			= new WebSocketDataProvider($scope);
		var ctrlCommon		= new CtrlCommon($scope);
		var routeMgr 		= new RouteManager($scope);
		var mdlMgr 			= new ModelManager($scope);

		clearAllTimeouts();
		
		// Make sure modal window is not lingering around //
		$('#confirm-delete').modal('hide');
		$('.modal-backdrop').remove();
		$('#side-panel').addClass('offstage');

		$scope.metricListSortOpts 	= DNDCONFIG.metricList;
		$scope.graphSortOpts 		= DNDCONFIG.graph;
		$scope.podSortOpts 			= DNDCONFIG.pod;
		$scope.columnSortOpts 		= DNDCONFIG.column;
		$scope.rowSortOpts 			= DNDCONFIG.row;
		$scope.layoutSortOpts 		= DNDCONFIG.layout;

		$scope.metricQuery = "";
		$scope.metricQueryResult = [];

		$scope.reload = false;
		/* pod schema */
		$scope.droppablePodSchema = [];
		/* active model */
		$scope.model = {};

		Schema.get({modelType: 'pod'}, function(podModel) {
			/* used for dropped pod */
			$scope.droppablePodSchema = [ podModel ];
			if( !$routeParams.pageId || $routeParams.pageId == "new" ) {
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
				} else {
					
					console.warn("Page id not provided");
					setGlobalAlerts({"error": "", "message": "Page ID not provided!"});
					flashAlertsBar();
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
			var domNode = $(elemSelector); 
			
			var tagstr = domNode.val();
			var tagsArr = tagstr.split(",");
			for(var t=0; t < tagsArr.length; t++) {
			
				ctag = tagsArr[t].replace(/\s+$/,'');
				ctag = ctag.replace(/^\s+/,'');
				if($scope.model.tags.indexOf(ctag) < 0) $scope.model.tags.push(ctag);
			}
			$('#add-page-tag').modal('hide');
			
			domNode.val('');
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
				$scope.enableEditMode();
			} else {
				$scope.disableEditMode();
			}
			$scope.reflow();
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
			domNode.html(GRAPH_LOADING_HTML);
		}

		$scope.$on('$destroy', function() {
			try { wsdp.closeConnection(); } catch(e){};
		});
		
		submitAnalytics({page: "/"+$routeParams.pageId, title: $routeParams.pageId});
}]);

metrilyxControllers.controller('adhocGraphController', [
	'$scope', 'Schema', 'TimeWindow', 'ComponentTemplates', 'WebSocketDataProvider', 'AnnotationOptions', 'CtrlCommon', 'RouteManager', 'URLSetter',
	function($scope, Schema, TimeWindow, ComponentTemplates, WebSocketDataProvider, AnnotationOptions, CtrlCommon, RouteManager, URLSetter) {
		
		$scope.modelType 		= "adhoc";
		$scope.modelGraphIds 	= [];

		var annoOptions 	= new AnnotationOptions($scope);
		var wsdp 			= new WebSocketDataProvider($scope);
		var compTemplates 	= new ComponentTemplates($scope);
		var timeWindow 		= new TimeWindow($scope);
		var ctrlCommon		= new CtrlCommon($scope);
		var routeMgr 		= new RouteManager($scope);
		var urlSetter 		= new URLSetter($scope);

		$scope.metricListSortOpts 	= DNDCONFIG.metricList;

		$scope.metricQueryResult = [];
		$scope.tagsOnPage = {};
		$scope.graph = {};
		$scope.globalTags = {};

		Schema.get({modelType: 'graph'}, function(graphModel) {

			$.extend(graphModel, routeMgr.getParams(), true);
			$scope.graph = graphModel
			
			if($scope.graph.series.length > 0) {
				$scope.modelGraphIds = [ $scope.graph._id ];
				$scope.reloadGraph();
			}
		});

		$('#side-panel').addClass('offstage');
		
		$scope.metricListSortOpts.disabled = $scope.editMode === "" ? true : false;

		$scope.addGraphIdEventListener = function(graphId, funct) {
			wsdp.addGraphIdEventListener(graphId, funct);
       	}
       	$scope.removeGraphIdEventListener = function(graphId, funct) {
       		wsdp.removeGraphIdEventListener(graphId, funct);
       	}
       	$scope.requestData = function(query) {
        	wsdp.requestData(query);
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

		$scope.setTimeType = function(newRelativeTime, reloadPage) {
			
			timeWindow.setAttribute('timeType', newRelativeTime);
		}

		$scope.setAbsoluteTime = function() {
		
			$scope.reloadGraph();
			$scope.globalAnno.status = 'reload';
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
			urlSetter.setURL(obj);
		}

		$scope.reloadGraph = function(gobj) {
			
			if(!gobj) gobj = $scope.graph;

			$('.adhoc-metric-editor').hide();
			if(gobj.series.length < 1) return;

			$scope.setURL(gobj);

			q = $scope.baseQuery(gobj)
			q.series = gobj.series;

			var domNode = $("[data-graph-id='"+gobj._id+"']"); 
			
			/* Destroy current graph */
			try { domNode.highcharts().destroy(); } catch(e) {};
			domNode.html(GRAPH_LOADING_HTML);
			
			$scope.requestData(q);
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

		$scope.$on('$destroy', function() {
			try { wsdp.closeConnection(); } catch(e){};
		});

		submitAnalytics({title:'adhoc', page:'/graph'});
}]);
