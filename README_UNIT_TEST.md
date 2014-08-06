
Run unit test
===============

Libraries Used
```
  Grunt for task runner
  Karma as a the test framework
  Qunit for assertion
  Angular Mock: for mocking and injecting angular mock objects
```

Installation Prerequisites:
```
  node : http://nodejs.org/

  ---Setup node packages
  sudo npm install -g grunt-cli
  npm install
```

TroubleShoot:
```
  If you get problem doing npm install, please try to set .npm owner to be yourself with this command

  Change syle to be your username.
  sudo chown -R syle ~/.npm/
``

How to run the test?
```
  npm test
```



Locations of tests
```
  test/unit : unit test
```



Testing Filters
```
  module('Filter Test', {
    setup: function() {
      // prepare something for all following tests
      this.$filter = getFilter();
    },
    teardown: function() {}

  });

  test('Filter: dotsToDashes', function() {
    var testMethod = 'dotsToDashes';
    var testMethodFun = this.$filter(testMethod);
    var testData = [{
      input: ['...'],
      output: '---'
    },{
      input: ['aa...zz'],
      output: 'aa---zz'
    },{
      input: ['a.b.c.d'],
      output: 'a-b-c-d'
    },{
      input: ['a-l-l-d-a-s-h'],
      output: 'a-l-l-d-a-s-h'
    }];

    for (var i = 0; i < testData.length; i++) {
      var input = testData[i].input;
      var output = testData[i].output;

      //method call and assertion
      var actual = testMethodFun.apply(null, input);
      var msg = testData[i].msg || testMethod + '\t' + JSON.stringify(input).substr(1, JSON.stringify(input).length - 2);
      equal(output, actual, msg);
    }
  });
```


Testing Directives
```
  module('wsHighstockGraph directive', {
    setup: function() {
      var t = this;

      // prepare something for all following tests
      t.$compile = getCompiled();
      t.$scope = injector.get('$rootScope').$new();

      ...add stubs to objects

      t.$scope.pod = pod;
      t.$scope.wssock = {
        addEventListener: function(graph_id, processRecievedData) {}
      }

      t.$scope.baseQuery = function(graph) {
        return {};
      }
      ...
    },
    teardown: function() {}
  });


  test('wsHighstockGraph - adding a new series', function() {
    var t = this;

    //prepare data for directive
    var graph1 = t.createMockGraph(['graph_1111', 'graph_2222']),
      graph2 = t.createMockGraph(['graph_1111', 'graph_2222', 'graph_3333']);

    t.$scope.graph = graph1;


    ...compile  directive with scope data...
    var element = this.$compile('<div ng-model="graph" class="{{pod.orientation}}" ws-highstock-graph></div>')(t.$scope);
    ...



    ...apply changes to the scope...
    var oldSeries = t.$scope.graph.series;
    t.$scope.graph = graph2;
    t.$scope.$apply();
    var newSeries = t.$scope.graph.series;
    ...

    equal(graph1.series.length, oldSeries.length, "Old Series Length = graph1");
    equal(graph2.series.length, newSeries.length, "New Series Length = graph2");

    //make sure the difference is the new one
    var oldSeriesHash = {};
    angular.forEach(oldSeries, function(val) {
      oldSeriesHash[val.alias] = true;
    });

    angular.forEach(newSeries, function(val) {
      if (oldSeriesHash[val.alias] !== true) {
        addedSerie = val;
      }
    });

    equal(JSON.stringify(addedSerie), JSON.stringify(t.mockSerieData('graph_3333', 'querying')), 'Added serie must be graph_3333');
  });

```


Testing Services
```
  WIP
```


Testing Controllers
```
  WIP
```
