module('tooltipArrow directive', {
  setup: function() {
    var t = this;

    // prepare something for all following tests
    t.getNewScope = function(g) {
      var $scope = initRootScope();

      $scope.graph = {
        _id: 12345
      }

      return $scope;
    }

    t.elem = '<div ng-model="graph._id" tooltip-arrow width="30" height="12" color="rgba(95,95,95,0.9)" direction="up" style="position:relative;left:25px;"></div>';

    //override global methods used with stub
    sinon.stub(window, "drawTriOnCanvas", function(canvas, color, direction) {
      t.color = color;
      t.direction = direction;
      t.canvas = canvas;
    });
  },
  teardown: function() {
    var t = this;

    //restore original behavior of these functions
    window.drawTriOnCanvas.restore();

    //clean up
    delete t.elem;

    delete t.color;
    delete t.direction;
    delete t.canvas;
  }
});


test('tooltipArrow', function() {
  var t = this;

  var $scope = t.getNewScope();
  var element = getDirective(t.elem, $scope);
  var $elem = $(element);

  equal(1, $elem.find('canvas').length, 'Canvas should be drawn');

  //check the color property
  equal("rgba(95,95,95,0.9)", t.color, 'Color must match');
  equal("up", t.direction, 'Color must match');
});
