module('eventTypes directive', {
  setup: function() {
    var t = this;

    // prepare something for all following tests
    t.getNewScope = function() {
      var $scope = initRootScope();

      $scope.graph = {
        annoEvents: {
          eventTypes: 'eventTypes'
        }
      }

      return $scope;
    }


    t.elem = '<input type="text" class="form-control dark" style="border-radius:30px;border-color:#888 !important" ng-model="graph.annoEvents.eventTypes" event-types>';


    //override global methods used with stub
    sinon.stub($.fn, "keyup", function(cb) {
      t.keyupcb = cb;
    });

    sinon.stub($.fn, "autocomplete", function(arg) {
      if (arg === 'close') {
        t.autocompleteClosed = true;
      } else {
        t.autocompleteConfig = arg;
      }
    });
  },
  teardown: function() {
    var t = this;

    //restore original behavior of these functions
    $.fn.keyup.restore();
    $.fn.autocomplete.restore();

    //delete and cleanup
    delete t.elem;
    delete t.keyupcb;
    delete t.autocompleteConfig;
    delete t.autocompleteClosed;
  }
});


test('eventTypes', function() {
  var t = this;

  var $scope = t.getNewScope();
  var element = getDirective(t.elem, $scope);
  var $elem = $(element);

  //autocomplete


  //testing keyup enter key to clear input
  t.keyupcb({keyCode: 13});

  equal(true, t.autocompleteClosed, 'Autocomplete is closed')
  equal('', $elem.val(), 'Enter hit, elem html should be ""');
});
