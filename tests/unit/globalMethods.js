 module('GlobalScope Methods', {
  setup: function() {},
  teardown: function() {}
});




test('commaSepStrToDict', function() {
  var testMethod = 'commaSepStrToDict';
  var testMethodFun = window[testMethod];
  var testData = [{
    input: ['key1=val1,key2=val2'],
    output:  { key1: 'val1', key2: 'val2' }
  },{
    input: ['key1=val1'],
    output:  { key1: 'val1' }
  },{
    input: ['key1_val1,key2_val2', '_'],
    output:  undefined
  },{
    input: ['key1_val1', '_'],
    output:  undefined
  },{
    input: [''],
    output:  {}
  }];

  runTest(testMethod, testMethodFun, testData, deepEqual);
});




test('dictToCommaSepStr', function() {
  var testMethod = 'dictToCommaSepStr';
  var testMethodFun = window[testMethod];
  var testData = [{
    input:  [{ key1: 'val1', key2: 'val2' }],
    output: 'key1=val1,key2=val2'
  },{
    input:  [{ key1: 'val1'}],
    output: 'key1=val1'
  },{
    input:  [{ key1: 'val1', key2: 'val2'}, '_' ],
    output: 'key1_val1,key2_val2'
  }];

  runTest(testMethod, testMethodFun, testData, deepEqual);
});
