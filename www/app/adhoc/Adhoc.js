angular.module("adhoc", [])
.controller('adhocGraphController', [
    '$scope', 'Configuration', 'Schema', 'TimeWindow', 'ComponentTemplates', 
    'WebSocketDataProvider', 'AnnotationsManager', 'CtrlCommon', 'RouteManager', 'URLSetter',
    function($scope, Configuration, Schema, TimeWindow, ComponentTemplates, 
        WebSocketDataProvider, AnnotationsManager, CtrlCommon, RouteManager, URLSetter) {

        $scope.modelType     = "adhoc";
        $scope.modelGraphIds = [];

        var annoManager     = new AnnotationsManager($scope);
        var wsdp            = new WebSocketDataProvider($scope);
        var compTemplates   = new ComponentTemplates($scope);
        var timeWindow      = new TimeWindow($scope);
        var ctrlCommon      = new CtrlCommon($scope);
        var routeMgr        = new RouteManager($scope);
        var urlSetter       = new URLSetter($scope);
        

        $scope.metricListSortOpts   = DNDCONFIG.metricList;
        $scope.adhocGraphSortOpts   = DNDCONFIG.adhocGraph;

        $scope.metricQueryResult = [];
        $scope.tagsOnPage = {};
        $scope.graph = {};
        $scope.globalTags = {};

        //console.log($scope.eventAnnoTypes);

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

        /*
        $scope.onEditPanelLoad = function() {
            document.getElementById('edit-panel').addEventListener('refresh-metric-list',
                function() {
                    $scope.searchForMetric($('[ng-model=metricQuery]').val());
                }
            );
        }
        */
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
            $scope.editMode = " edit-mode";
            $scope.reflow();
        }
        $scope.disableEditMode = function() {
            $scope.editMode = "";
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

        $scope.$on('$destroy', function() {
            try { wsdp.closeConnection(); } catch(e){};
        });

        function _init() {
            Schema.get({modelType: 'graph'}, function(graphModel) {

                $.extend(graphModel, routeMgr.getParams(), true);
                $scope.graph = graphModel

                if($scope.graph.series.length > 0) {
                    $scope.modelGraphIds = [ $scope.graph._id ];
                }
            });
            submitAnalytics({title:'adhoc', page:'/graph'});
            
            if(Configuration.annotations.enabled) annoManager.connect(1);
        }

        _init();
}]);
