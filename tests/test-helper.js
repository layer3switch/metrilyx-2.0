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


  function notEqual(actual, expected, message) {
    message = getAssertionMessage(actual, expected, message);
    QUnit.notEqual.call(this, actual, expected, message);
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

  function getDirective(elem, scope){
    return getInjector().get('$compile')(elem)(scope);
  }

  function initRootScope() {
    return getInjector().get('$rootScope').$new();
  }


  //use for dependencies injection override
  var providerHash = {};//used for backup and reset of provider
  function setProvider(name, fn){
    //backup
    if (providerHash[name] === undefined){
      providerHash[name] = getInjector().get(name);
    }

    app.config(function($provide) {
      $provide.provider(name, function() {
        this.$get = fn;
      });
    });
  }

  function resetProvider(name){
    if (providerHash[name] !== undefined){
      setProvider(name, function(){
        return providerHash[name];
      })
    }
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

  //dump
  console.dump = function(){
    for (var k = 0; k < arguments.length; k++)
      console.debug(JSON.stringify(arguments[k]));
  }

  window.exists = exists;
  window.equal = equal;
  window.strictEqual = strictEqual;

  window.runTest = runTest;

  window.getInjector = getInjector;
  window.getFilter = getFilter;
  window.getCompiled = getCompiled;
  window.getDirective = getDirective;
  window.initRootScope = initRootScope;
  window.setProvider= setProvider;
  window.resetProvider= resetProvider;

  window.createSpyMethods = createSpyMethods;
})();
