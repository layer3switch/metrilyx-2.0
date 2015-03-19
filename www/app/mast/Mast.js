angular.module('metrilyx.mast', [])
.directive('metrilyxMast', [function() {
    return  {
        restrict: 'E',
        templateUrl: 'app/mast/mast.html',
        link: function(scope, elem, attrs) {}
    }
}]);