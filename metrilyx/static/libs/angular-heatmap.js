angular.module('heatmaps', [])
	.directive('heatgraph', [ 'Heat', function(Heat) {
		return {
			restrict: 'A',
			require: '?ngModel',
			link: function(scope, elem, attrs, ctrl) {
				if(!ctrl) return;

				var heatmapInterval = setInterval(function() {
					if(scope.editMode === "") {
						if(ctrl.$modelValue && ctrl.$modelValue.series.length > 0) {
							Heat.getData(ctrl.$modelValue.series[0].query, function(result) {
								// check for errors
								ctrl.$modelValue.series[0].data = assignSeverity(result['data'], ctrl.$modelValue.thresholds);
							});	
						}
					}
				}, 60000);
				
				scope.$watch(function() {
					return ctrl.$modelValue;
				}, function(newValue, oldValue) {
					if(newValue.series === undefined) return;
					if(newValue.series.length < 1) return;
					if(newValue.series.length > 1) {
						/* can only have 1 query per pod */
						newValue.series = [ newValue.series[0] ];
						return;
					}
					Heat.getData(newValue.series[0].query,
						function(result) {
							// check for errors//
							newValue.series[0].data = assignSeverity(result['data'], newValue.thresholds);
						},
						function(arg1, arg2){
							console.log(arg1, arg2);
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
		if(data['value'] >= parseFloat(thresholds.info.min) && data['value'] <= parseFloat(thresholds.info.max)) {
			sev = "info";
		}
		if(data['value'] >= parseFloat(thresholds.warning.min) && data['value'] <= parseFloat(thresholds.warning.max)) {
			sev = "warning";
		}
		if(data['value'] >= parseFloat(thresholds.danger.min) && data['value'] <= parseFloat(thresholds.danger.max)) {
			sev = "danger";
		}
		return sev;
	}
function assignSeverity(heatData,thresholds) {
	for(var d in heatData) {
		heatData[d].severity = getSeverity(heatData[d], thresholds);
	}
	return heatData;	
}



