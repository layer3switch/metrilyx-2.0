module('wsHighstockGraph directive', {
  setup: function() {
    var t = this;

    // prepare something for all following tests
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

    t.elem = '<div ng-model="graph" class="{{pod.orientation}}" ws-highstock-graph></div>';

    t.assertGraph = function(graph1, graph2, oldSeries, newSeries, operation, expectedChangeSeries) {
      equal(graph1.series.length, oldSeries.length, "graph1.series.length == oldSeries.length");
      equal(graph2.series.length, newSeries.length, "graph2.series.length == newSeries.length");
      strictEqual(graph1.series, oldSeries, "graph1.series == oldSeries");
      strictEqual(graph2.series, newSeries, "graph2.series == newSeries");


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

        equal(JSON.stringify(diffSerie), JSON.stringify(GraphMocker.mockSeries(expectedChangeSeries, 'querying')), 'Added series must be ' + expectedChangeSeries);
      } else {
        angular.forEach(newSeries, function(val) {
          oldSeriesHash[val.alias] = true;
        });

        angular.forEach(oldSeries, function(val) {
          if (oldSeriesHash[val.alias] !== true) {
            diffSerie = val;
          }
        });

        equal(JSON.stringify(diffSerie), JSON.stringify(GraphMocker.mockSeries(expectedChangeSeries, 'loading')), 'Removed series must be ' + expectedChangeSeries);
      }
    }

  },
  teardown: function() {
    var t = this;
    delete t.assertGraph;
    delete t.getNewScope;
    delete t.elem;
  }
});


test('wsHighstockGraph - adding a new series at the end', function() {
  var t = this;

  //prepare data for directive
  var graph1 = GraphMocker.mockGraph(['graph_1111', 'graph_2222']),
    graph2 = GraphMocker.mockGraph(['graph_1111', 'graph_2222', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = getDirective(t.elem, $scope);

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
  var graph1 = GraphMocker.mockGraph(['graph_1111', 'graph_3333']),
    graph2 = GraphMocker.mockGraph(['graph_1111', 'graph_2222', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = getDirective(t.elem, $scope);

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
  var graph1 = GraphMocker.mockGraph(['graph_2222', 'graph_3333']),
    graph2 = GraphMocker.mockGraph(['graph_1111', 'graph_2222', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = getDirective(t.elem, $scope);

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
  var graph1 = GraphMocker.mockGraph(['graph_1111', 'graph_2222', 'graph_3333']),
    graph2 = GraphMocker.mockGraph(['graph_1111', 'graph_2222']);

  var $scope = t.getNewScope(graph1);
  var element = getDirective(t.elem, $scope);

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
  var graph1 = GraphMocker.mockGraph(['graph_1111', 'graph_2222', 'graph_3333']),
    graph2 = GraphMocker.mockGraph(['graph_1111', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = getDirective(t.elem, $scope);

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
  var graph1 = GraphMocker.mockGraph(['graph_1111', 'graph_2222', 'graph_3333']),
    graph2 = GraphMocker.mockGraph(['graph_2222', 'graph_3333']);

  var $scope = t.getNewScope(graph1);
  var element = getDirective(t.elem, $scope);

  var oldSeries = $scope.graph.series;
  $scope.graph = graph2;
  $scope.$apply();
  var newSeries = $scope.graph.series;


  //assert
  t.assertGraph(graph1, graph2, oldSeries, newSeries, 'remove', 'graph_1111');
});
