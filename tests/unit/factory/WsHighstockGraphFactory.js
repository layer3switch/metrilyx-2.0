module('WsHighstockGraphHelper Test', {
  setup: function() {
    // prepare something for all following tests
    var t = this;

    t.getInstance = function(model) {
      model = model || t.ngmodel;

      var WsHighstockGraphHelper = getInjector().get('WsHighstockGraphHelper');
      return new WsHighstockGraphHelper(t.scope, model);
    }

    t.scope = {
      updatesEnabled: false,
      "$on" : function(event, cb){}
    }


    t.ngmodel = {
      $modelValue: GraphMocker.mockGraph(['graph_1111', 'graph_2222', {
        alias: 'graph_3333',
        status: 'querying'
      }, {
        alias: 'graph_4444'
      }])
    };
  },
  teardown: function() {
    var t = this;

    //cleanup
    delete t.getInstance;
    delete t.scope;
    delete t.ngmodel;
  }
});


test('WsHighstockGraphHelper : setSerieStatus', function() {
  var t = this;
  var instance = t.getInstance();
  var newGraph, newStatus;

  //changing from loading to querying
  newGraph = {
    series: [GraphMocker.mockSeries('graph_2222')]
  },
  newStatus = 'querying';

  equal(t.ngmodel.$modelValue.series[1].status, 'loading', 'changing from loading to querying : Before status = loading');
  instance.setSerieStatus(newGraph, newStatus);
  equal(t.ngmodel.$modelValue.series[1].status, 'querying', 'changing from loading to querying : After status = querying');


  //changing from undefined to querying
  newGraph = {
    series: [GraphMocker.mockSeries('graph_4444')]
  },
  newStatus = 'querying';
  equal(t.ngmodel.$modelValue.series[3].status, undefined, 'changing from undefined to querying : Before status = undefined');
  instance.setSerieStatus(newGraph, newStatus);
  equal(t.ngmodel.$modelValue.series[3].status, 'querying', 'changing from undefined to querying: After status = querying');
});



test('WsHighstockGraphHelper : getSeriesInNonQueryState', function() {
  var t = this;
  var instance = t.getInstance();

  //notice that undefined status is also true
  var nonQueryingSeries = instance.getSeriesInNonQueryState(t.ngmodel.$modelValue.series);
  equal(nonQueryingSeries.length, 3, 'NonQuery Series length = 2');

  //loop through the series and make sure nothing is in querying status
  angular.forEach(nonQueryingSeries, function(series) {
    notEqual(series.status, 'querying', 'status != querying')
  });
});


test('WsHighstockGraphHelper : getUpdateQuery', function() {
  var t = this;
  var instance = t.getInstance();

  var updateQueryObject = instance.getUpdateQuery();
  var expectedData = {"start":updateQueryObject.start,"size":"large","_id":"cdf5bdb1ca9b4990aca4fb139f30471f","name":"","series":[{"alias":"graph_1111","yTransform":"","query":{"aggregator":"sum","rate":false,"metric":"graph_1111_metric","tags":{}},"status":"loading","data":{"error":false}},{"alias":"graph_2222","yTransform":"","query":{"aggregator":"sum","rate":false,"metric":"graph_2222_metric","tags":{}},"status":"loading","data":{"error":false}},{"alias":"graph_3333","yTransform":"","query":{"aggregator":"sum","rate":false,"metric":"graph_3333_metric","tags":{}},"status":"querying","data":{"error":false}},{"alias":"graph_4444","yTransform":"","query":{"aggregator":"sum","rate":false,"metric":"graph_4444_metric","tags":{}},"data":{"error":false}}],"graphType":"line","multiPane":false,"panes":["",""]};

  equal(JSON.stringify(updateQueryObject), JSON.stringify(expectedData), 'getUpdateQuery');
});


test('WsHighstockGraphHelper : checkDataErrors', function() {
  var t = this;

  var g = GraphMocker.mockGraph(['graph_1111', {
    alias: 'graph_2222',
    status: 'querying'
  }, {
    alias: 'graph_3333',
    status:'loading',
    data: { error: true }
  },{
    alias: 'graph_4444',
    status:'query',
    data: { error: true }
  },{
    alias: 'graph_5555',
    data: { error: true }
  }]);

  t.ngmodel.$modelValue= g;

  var instance = t.getInstance();


  //after this method, all non-error became loading, error will has status becoming error
  instance.checkDataErrors(g);

  //check if all status becoming loading
  var errorLen = 0, expectedTotalErrorLen = 3;

  angular.forEach(t.ngmodel.$modelValue.series, function(ser){
    if (ser.data !== undefined && ser.data.error){
      errorLen++;
      equal(ser.status, 'error', 'data.error == true, therefore status == "error"')
    }
    else{
      equal(ser.status, 'loading', 'data.error == false , therefore status == "error"')
    }
  });

  equal(errorLen, expectedTotalErrorLen, 'Total error' + expectedTotalErrorLen);
});


test('WsHighstockGraphHelper : getUpdates', function() {
  //to be implemented
  equal(1, 1, '');
});


test('WsHighstockGraphHelper : processRecievedData', function() {
  //to be implemented
  equal(1, 1, '');
});
