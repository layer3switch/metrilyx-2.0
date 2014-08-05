module('Filter Test', {
  setup: function() {
    var t = this;
    t.$filter = getFilter();
  },
  teardown: function() {
    var t = this;
    delete t.$filter;
  }
});


test('Filter: dotsToDashes', function() {
  var testMethod = 'dotsToDashes';
  var testMethodFun = this.$filter(testMethod);
  var testData = [{
    input: ['...'],
    output: '---'
  }, {
    input: ['aa...zz'],
    output: 'aa---zz'
  }, {
    input: ['a.b.c.d'],
    output: 'a-b-c-d'
  }, {
    input: ['a-l-l-d-a-s-h'],
    output: 'a-l-l-d-a-s-h'
  }];


  runTest(testMethod, testMethodFun, testData, equal);
});


test('Filter: columnWidth', function() {
  var testMethod = 'columnWidth';
  var testMethodFun = this.$filter(testMethod);
  var testData = [{
    input: [12],
    output: 1
  }, {
    input: [3],
    output: 4
  }, {
    input: [4],
    output: 3
  }, {
    input: [2],
    output: 6
  }, {
    input: [6],
    output: 2
  }];


  runTest(testMethod, testMethodFun, testData, equal);
});


test('Filter: invert', function() {
  var testMethod = 'invert';
  var testMethodFun = this.$filter(testMethod);
  var testData = [{
    input: [true],
    output: false
  }, {
    input: [false],
    output: true
  }];


  runTest(testMethod, testMethodFun, testData, equal);
});


test('Filter: graphWidth', function() {
  var filterMethod = 'graphWidth';

  equal(0, this.$filter(filterMethod)(), filterMethod + '()');
});



test('Filter: dateTime', function() {
  var testMethod = 'dateTime';
  var testMethodFun = this.$filter(testMethod);
  var testData = [{
    input: [1406333784960],
    output: 'Sat Dec 11 01:36:00 4653'
  }];


  runTest(testMethod, testMethodFun, testData, equal);
});


test('Filter: rateString', function() {
  var testMethod = 'rateString';
  var testMethodFun = this.$filter(testMethod);
  var testData = [{
    input: ['rateString'],
    output: 'rate:'
  }, {
    input: ['123'],
    output: 'rate:'
  }, {
    input: ['false'],
    output: 'rate:'
  }, {
    input: ['true'],
    output: 'rate:'
  }, {
    input: [false],
    output: ''
  }, {
    input: [undefined],
    output: ''
  }];


  runTest(testMethod, testMethodFun, testData, equal);
});






test('Filter: tagsString', function() {
  var mockObject = {
    ka: 'va',
    kb: 'vb'
  };

  var testMethod = 'tagsString';
  var testMethodFun = this.$filter(testMethod);
  var testData = [{
    input: [mockObject, true],
    output: '{ ka=va, kb=vb }'
  }, {
    input: [mockObject, false],
    output: '{ ka=va, kb=vb }'
  }, {
    input: ['', true],
    output: ''
  }, {
    input: ['', false],
    output: ''
  }];


  runTest(testMethod, testMethodFun, testData, equal);
});



test('Filter: tagsLink', function() {
  var mockObject = {
    ka: 'va',
    kb: 'vb'
  };

  var testMethod = 'tagsLink';
  var testMethodFun = this.$filter(testMethod);
  var testData = [{
    input: [mockObject],
    output: '?tags=ka:va,kb:vb%3B'
  }, {
    input: [''],
    output: ''
  }];


  runTest(testMethod, testMethodFun, testData, equal);
});




test('Filter: metricQuery', function() {
  var testMethod = 'metricQuery';
  var testMethodFun = this.$filter(testMethod);
  var testData = [{
    input: [{
      rate: true,
      aggregator: 'SUM',
      metric: 'TestMetric_1'
    }],
    output: 'SUM:rate:TestMetric_1'
  }, {
    input: [{
      aggregator: 'AVG',
      metric: 'TestMetric_2'
    }],
    output: 'AVG:TestMetric_2'
  }];


  runTest(testMethod, testMethodFun, testData, equal);
});



test('Filter: loadedSeries', function() {
  function createSeries(status) {
    status = status || 'loading';

    return {
      status: status
    }
  }

  var mockGraph = {
    series: []
  };
  for (var i = 0; i < 7; i++)
    mockGraph.series.push(createSeries('loading'));

  for (var i = 0; i < 3; i++)
    mockGraph.series.push(createSeries('querying'));

  //this will create 3 querying series and 7 loading series

  var testMethod = 'loadedSeries';
  var testMethodFun = this.$filter(testMethod);
  var testData = [{
    input: [mockGraph, false],
    output: 7
  }, {
    input: [mockGraph],
    output: 7
  }, {
    input: [mockGraph, true],
    output: 70
  }];


  runTest(testMethod, testMethodFun, testData, equal);
});
