(function() {
  //qunit test helpers
  function exists(selector) {
    return !!find(selector).length;
  }

  function getAssertionMessage(actual, expected, message) {
    return message || QUnit.jsDump.parse(expected) + " expected but was " + QUnit.jsDump.parse(actual);
  }

  function equal(actual, expected, message) {
    message = getAssertionMessage(actual, expected, message);
    QUnit.equal.call(this, actual, expected, message);
  }

  function strictEqual(actual, expected, message) {
    message = getAssertionMessage(actual, expected, message);
    QUnit.strictEqual.call(this, actual, expected, message);
  }

  //test runner
  function runTest(testMethod, testMethodFun, testData, assertFun) {
    angular.forEach(testData, function(testDatum) {
      var input = testDatum.input;
      var output = testDatum.output;

      //method call and assertion
      var actual = testMethodFun.apply(null, input);
      var msg = testDatum.msg || testMethod + '\t' + JSON.stringify(input).substr(1, JSON.stringify(input).length - 2);
      assertFun.call(null, actual, output, msg);
    });
  }

  //angular helper
  function getInjector() {
    return angular.injector(['ng', 'app']);
  }

  function getFilter() {
    return getInjector().get('$filter');
  }

  function getCompiled() {
    return getInjector().get('$compile');
  }

  function initRootScope() {
    return getInjector().get('$rootScope').$new();
  }

  //spy
  function createSpyMethods(obj, methods) {
    if (Array.isArray(methods)) {
      for (var i = 0; i < methods.length; i++) {
        obj[methods[i]] = sinon.spy();
      }
    } else {
      obj[methods] = sinon.spy();
    }

    return obj;
  }

  window.exists = exists;
  window.equal = equal;
  window.strictEqual = strictEqual;

  window.runTest = runTest;

  window.getInjector = getInjector;
  window.getFilter = getFilter;
  window.getCompiled = getCompiled;
  window.initRootScope = initRootScope;

  window.createSpyMethods = createSpyMethods;
})();
