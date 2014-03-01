angular.module('heatmaps', [])
	.directive('heatgraph', [ 'Heat', function(Heat) {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ctrl) {
				if(!ctrl) return;
				//console.log(ctrl.$modelValue);
				var heatmapInterval = setInterval(function() {
					if(ctrl.$modelValue) {
						Heat.getData(ctrl.$modelValue.series[0].query,function(result) {
							ctrl.$modelValue.series[0].data = assignSeverity(result['data'], ctrl.$modelValue.thresholds);
						});	
					}
				}, 60000);
				scope.$watch(function() {
					return ctrl.$modelValue;
				}, function(newValue, oldValue) {
					Heat.getData(newValue.series[0].query,function(result) {
						newValue.series[0].data = assignSeverity(result['data'], newValue.thresholds);
					});
				}, true);
				scope.$on("$destroy", function( event ) {
                	clearInterval(heatmapInterval);
                });
			}
		}
	}]);

function getSeverity(data, thresholds) {
		var sev = "default";
		if(data['value'] >= thresholds.info) {
			sev = "info";
		}
		if(data['value'] >= thresholds.warning) {
			sev = "warning";
		}
		if(data['value'] >= thresholds.danger) {
			sev = "danger";
		}
		return sev;
	}
function assignSeverity(heatData,thresholds) {
	for(var d in heatData) {
		heatData[d].severity = getSeverity(heatData[d], thresholds);
	}
	//console.log(heatData);
	return heatData;	
}



