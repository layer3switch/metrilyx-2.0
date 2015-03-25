angular.module("adhoc", [])
.factory('AdhocURLParser', ['$routeParams', function($routeParams) {
    /* Parse URL parameters into datastructures */
    
    var parseMetricParams = function() {
        var series = [];
        if($routeParams.m) {
            var metrics = Object.prototype.toString.call($routeParams.m) === '[object Array]' ? $routeParams.m : [ $routeParams.m ];
            for(var i=0; i < metrics.length; i++) {

                var arr = metrics[i].match(/^(.*)\{(.*)\}\{alias:(.*),yTransform:(.*)\}$/);
                var met = arr[1].split(":");

                var rate = met.length == 3 ? true: false;
                series.push({
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
        }
        return series;
    }

    var parseThresholdParams = function() {
        if($routeParams.thresholds) {
            try {
                var arr = $routeParams.thresholds.split(":");
                if(arr.length == 3) {
                    var dmm = arr[0].split("-");
                    var wmm = arr[1].split("-");
                    var imm = arr[2].split("-");
                    return {
                        'danger':   { max:dmm[0], min:dmm[1] },
                        'warning':  { max:wmm[0], min:wmm[1] },
                        'info':     { max:imm[0], min:imm[1] }
                    };
                }
            } catch(e) {
                console.warn("cannot set thresholds", e);
            }
        }
        return {
            danger: {max:'', min:''},
            warning: {max:'', min:''},
            info: {max:'', min:''}
        };
    }

    return {
        getParams: function() {
            return {
                size       : $routeParams.size ? $routeParams.size : ADHOC_DEFAULT_GRAPH_SIZE,
                thresholds : parseThresholdParams(),
                graphType  : $routeParams.type ? $routeParams.type: ADHOC_DEFAULT_GRAPH_TYPE,
                series     : parseMetricParams()
            };
        }
    }
}])
.directive('adhocQueryEditor',[function() {
    return {
        restrict: 'E',
        templateUrl: 'app/adhoc/adhocgraph-query-editor.html',
        link: function(scope, elem, attrs) {

        }
    }
}])
.directive('metricSearchPanel',['$rootScope', 'Schema', 'Metrics', 'ModeManager', 
    function($rootScope, Schema, Metrics, ModeManager) {
    
        return {
            restrict: 'E',
            controller: function($scope) {
                $scope.editMode = ModeManager.getEditMode();
            },
            templateUrl: 'app/adhoc/metric-search-panel.html',
            link: function(scope, elem, attrs) {

                var timerSearchForMetric;

                var searchForMetric = function(args) {

                    if (timerSearchForMetric) clearTimeout(timerSearchForMetric);

                    var myThis = this;
                    timerSearchForMetric = setTimeout(function() {

                        var qstr;
                        if(args && args !== "") qstr = args;
                        if(myThis.metricQuery && myThis.metricQuery !== "") qstr = myThis.metricQuery;
                        if(qstr == "" || qstr == undefined) return;

                        Metrics.suggest(qstr, function(result) {

                            scope.metricQuery = qstr;
                            Schema.get({modelType:'metric'}, function(graphModel) {

                                var arr = [];
                                for(var i=0; i < result.length; i++) {
                                    //obj = JSON.parse(JSON.stringify(graphModel));
                                    obj = angular.copy(graphModel);
                                    obj.alias = result[i];
                                    obj.query.metric = result[i];
                                    arr.push(obj);
                                }

                                scope.metricQueryResult = arr;
                            });
                        });

                    }, 800);
                }

                var onModeChange = function(data) {
                    scope.editMode = ModeManager.getEditMode();
                    console.log(scope.editMode);
                }

                var init = function() {
                    scope.metricListSortOpts = DNDCONFIG.metricList;
                    scope.metricListSortOpts.disabled = scope.editMode === "" ? true : false;

                    scope.metricQueryResult = [];
                    scope.metricQuery = "";

                    scope.searchForMetric = searchForMetric;

                    $rootScope.$on('mode:changed', onModeChange);
                }

                init();
            }
        }
    }
])
.controller('adhocGraphController', [
    '$scope', '$routeParams', 'Configuration', 'Schema', 'TimeWindow', 'ComponentTemplates', 'AdhocURLParser',
    'WebSocketDataProvider', 'AnnotationsManager', 'CtrlCommon', 'URLSetter', 'ModeManager',
    function($scope, $routeParams, Configuration, Schema, TimeWindow, ComponentTemplates, AdhocURLParser,
        WebSocketDataProvider, AnnotationsManager, CtrlCommon, URLSetter, ModeManager) {

        console.log('Adhoc Controller');

        $scope.modelType     = "adhoc";
        $scope.modelGraphIds = [];

        var annoManager     = new AnnotationsManager($scope);
        var wsdp            = new WebSocketDataProvider($scope);
        var compTemplates   = new ComponentTemplates($scope);
        var timeWindow      = new TimeWindow($scope);
        var ctrlCommon      = new CtrlCommon($scope);
        var urlSetter       = new URLSetter($scope);
        
        $scope.adhocGraphSortOpts   = DNDCONFIG.adhocGraph;

        $scope.tagsOnPage = {};
        $scope.graph = {};
        $scope.globalTags = {};

        //$scope.editMode = ModeManager.setEditMode($routeParams.editMode === "false" ? false : true);

        $('#side-panel').addClass('offstage');

        $scope.addGraphIdEventListener = function(graphId, funct) {
            wsdp.addGraphIdEventListener(graphId, funct);
        }

        $scope.removeGraphIdEventListener = function(graphId, funct) {
            wsdp.removeGraphIdEventListener(graphId, funct);
        }
        
        $scope.requestData = function(query) {
            wsdp.requestData(query);
        }

        $scope.removeTag = function(tags, tagkey) {
            delete tags[tagkey];
        }

        $scope.setTimeType = function(newRelativeTime, reloadPage) {

            timeWindow.setAttribute('timeType', newRelativeTime);
        }

        $scope.setAbsoluteTime = function() {

            $scope.reloadGraph();
            //$scope.globalAnno.status = 'reload';
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

            console.log('reloadGraph: setURL');
            $scope.setURL(gobj);
        }

        $scope.setPlotBands = function(graph) {
            setPlotBands(graph);
            $scope.setURL(graph);
        }

        $scope.enableEditMode = function() {
            $scope.editMode = ModeManager.setEditMode(true);
            $scope.enableDragDrop();
            $scope.reflow();
        }
        $scope.disableEditMode = function() {
            $scope.editMode = ModeManager.setEditMode(false);
            $scope.disableDragDrop();
            $scope.reflow();
        }
        $scope.toggleEditMode = function() {
            if ( !ModeManager.isEditing() ) {
                $scope.enableEditMode();
            } else {
                $scope.disableEditMode();
            }
        }

        $scope.graphSizeChanged = function() {
            console.log('graphSizeChanged: setURL');
            $scope.setURL($scope.graph);
            //$scope.reflow();
        }

        $scope.reflow = function(args) {
            setTimeout(function() {
                $('[data-graph-id]').each(function() {
                    hc = $(this).highcharts();
                    if(hc != undefined) hc.reflow();
                });
            }, 500);
        }

        function _init() {

            if ($routeParams.editMode===true) {
                $scope.enableEditMode();
            } else {
                $scope.enableEditMode();
            }

            Schema.get({modelType: 'graph'}, function(graphModel) {
                //$.extend(graphModel, routeMgr.getParams(), true);
                $.extend(graphModel, AdhocURLParser.getParams(), true);
                $scope.graph = graphModel

                if($scope.graph.series.length > 0) {
                    $scope.modelGraphIds = [ $scope.graph._id ];
                }
            });

            submitAnalytics({title:'adhoc', page:'/graph'});
            
            if(Configuration.annotations.enabled) annoManager.connect(1);
        }

        _init();
    }
]);
