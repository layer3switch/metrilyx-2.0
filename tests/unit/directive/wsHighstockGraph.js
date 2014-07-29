module('wsHighstockGraph directive', {
  setup: function() {
    var t = this;

    // prepare something for all following tests
    t.$compile = getCompiled();

    t.getNewScope = function(g) {
      var $scope = initRootScope();
      $scope = createSpyMethods($scope, ['disableDragDrop', 'requestData']);
      $scope.pod = {
        orientation: 'vertical'
      };
      $scope.wssock = {
        addEventListener: function(graph_id, processRecievedData) {}
      }

      $scope.baseQuery = function(graph) {
        return {};
      }

      if (g !== undefined)
        $scope.graph = g;


      return $scope;
    }


    t.initDirective = function($scope) {
      return t.$compile('<div ng-model="graph" class="{{pod.orientation}}" ws-highstock-graph></div>')($scope);
    }


    //exposed methods
    function mockSerieData(name, status) {
      status = status || 'loading';

      return {
        "alias": name,
        "yTransform": "",
        "query": {
          "aggregator": "sum",
          "rate": false,
          "metric": name + "_metric",
          "tags": {}
        },
        "$$hashKey": "00O",
        "status": status
      }
    }
    t.mockSerieData = mockSerieData;

    t.createMockGraph = function(graphs) {
      var commonMock = {
        "multiPane": false,
        "panes": ["", ""],
        "name": "",
        "thresholds": {
          "danger": {
            "max": "",
            "min": ""
          },
          "warning": {
            "max": "",
            "min": ""
          },
          "info": {
            "max": "",
            "min": ""
          }
        },
        "annoEvents": {
          "eventTypes": [],
          "tags": {}
        },
        "graphType": "line",
        "_id": "cdf5bdb1ca9b4990aca4fb139f30471f",
        "size": "large",
        "$promise": {},
        "$resolved": true
      }

      var series = [];
      angular.forEach(graphs, function(g) {
        if (g.status !== undefined && g.alias !== undefined)
          series.push(mockSerieData(g.alias, g.status));
        else
          series.push(mockSerieData(g));
      });


      return $.extend(commonMock, {
        series: series
      });
    }


    t.assertGraph = function(graph1, graph2, oldSeries, newSeries, operation, expectedChangeSeries) {
      equal(graph1.series.length, oldSeries.length, "graph1.series.length == oldSeries.length");
      equal(graph2.series.length, newSeries.length, "graph2.series.length == newSeries.length");
      deepEqual(graph1.series, oldSeries, "graph1.series == oldSeries");
      deepEqual(graph2.series, newSeries, "graph2.series == newSeries");


      //make sure the difference is the new one
      var oldSeriesHash = {};
      var diffSeries;

      if (operation === 'add') {
        angular.forEach(oldSeries, function(val) {
          oldSeriesHash[val.alias] = true;
        });

        angular.forEach(newSeries, function(val) {
          if (oldSeriesHash[val.alias] !== true) {
            diffSerie = val;
          }
        });

        equal(JSON.stringify(diffSerie), JSON.stringify(t.mockSerieData(expectedChangeSeries, 'querying')), 'Added series must be ' + expectedChangeSeries);
      } else {
        angular.forEach(newSeries, function(val) {
          oldSeriesHash[val.alias] = true;
        });

        angular.forEach(oldSeries, function(val) {
          if (oldSeriesHash[val.alias] !== true) {
            diffSerie = val;
          }
        });

        equal(JSON.stringify(diffSerie), JSON.stringify(t.mockSerieData(expectedChangeSeries, 'loading')), 'Removed series must be ' + expectedChangeSeries);
      }
    }

  },
  teardown: function() {}
});


test('wsHighstockGraph - adding a new series at the end', function() {
  var t = this;

  //prepare data for directive
  var graph1 = t.createMockGraph(['graph_1111', 'graph_2222']),
    graph2 = t.createMockGraph(['graph_1111', 'graph_2222', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = t.initDirective($scope);

  var oldSeries = $scope.graph.series;
  $scope.graph = graph2;
  $scope.$apply();
  var newSeries = $scope.graph.series;


  //assert
  t.assertGraph(graph1, graph2, oldSeries, newSeries, 'add', 'graph_3333');
});

test('wsHighstockGraph - adding a new series in the middle', function() {
  var t = this;

  //prepare data for directive
  var graph1 = t.createMockGraph(['graph_1111', 'graph_3333']),
    graph2 = t.createMockGraph(['graph_1111', 'graph_2222', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = t.initDirective($scope);

  var oldSeries = $scope.graph.series;
  $scope.graph = graph2;
  $scope.$apply();
  var newSeries = $scope.graph.series;


  //assert
  t.assertGraph(graph1, graph2, oldSeries, newSeries, 'add', 'graph_2222');
});


test('wsHighstockGraph - adding a new series in the middle', function() {
  var t = this;

  //prepare data for directive
  var graph1 = t.createMockGraph(['graph_2222', 'graph_3333']),
    graph2 = t.createMockGraph(['graph_1111', 'graph_2222', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = t.initDirective($scope);

  var oldSeries = $scope.graph.series;
  $scope.graph = graph2;
  $scope.$apply();
  var newSeries = $scope.graph.series;

  //assert
  t.assertGraph(graph1, graph2, oldSeries, newSeries, 'add', 'graph_1111');
});



test('wsHighstockGraph - removing a series at the end', function() {
  var t = this;

  //prepare data for directive
  var graph1 = t.createMockGraph(['graph_1111', 'graph_2222', 'graph_3333']),
    graph2 = t.createMockGraph(['graph_1111', 'graph_2222']);

  var $scope = t.getNewScope(graph1);
  var element = t.initDirective($scope);

  var oldSeries = $scope.graph.series;
  $scope.graph = graph2;
  $scope.$apply();
  var newSeries = $scope.graph.series;

  //assert
  t.assertGraph(graph1, graph2, oldSeries, newSeries, 'remove', 'graph_3333');
});



test('wsHighstockGraph - removing a series in the middle', function() {
  var t = this;

  //prepare data for directive
  var graph1 = t.createMockGraph(['graph_1111', 'graph_2222', 'graph_3333']),
    graph2 = t.createMockGraph(['graph_1111', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = t.initDirective($scope);

  var oldSeries = $scope.graph.series;
  $scope.graph = graph2;
  $scope.$apply();
  var newSeries = $scope.graph.series;


  //assert
  t.assertGraph(graph1, graph2, oldSeries, newSeries, 'remove', 'graph_2222');
});




test('wsHighstockGraph - removing a series in the beginning', function() {
  var t = this;

  //prepare data for directive
  var graph1 = t.createMockGraph(['graph_1111', 'graph_2222', 'graph_3333']),
    graph2 = t.createMockGraph(['graph_2222', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = t.initDirective($scope);

  var oldSeries = $scope.graph.series;
  $scope.graph = graph2;
  $scope.$apply();
  var newSeries = $scope.graph.series;


  //assert
  t.assertGraph(graph1, graph2, oldSeries, newSeries, 'remove', 'graph_1111');
});
