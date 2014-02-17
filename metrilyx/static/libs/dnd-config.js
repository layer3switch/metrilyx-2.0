/*
 * dnd-config.js
 * - jquery sortable with angular configuration for app
 */
var dndconfig = {
	metricList: {
		scroll:true,
		scrollSensitivity: 5,
		tolerance: "pointer",
		revert: false,
		helper: "clone",
		connectWith: '.graph',
		cursor: '-webkit-grabbing',
		appendTo:"body",
		zindex: 999999,
		disabled:true,
	},
	/* graph in graphs */
	graph: {
		items: "[ng-repeat='graph in pod.graphs']",
		tolerance:"pointer",
		cursor: "move",
		disabled:true,
	},
	/* new pod adder icon */
	pod: {
		connectWith: [ ".layout-column", ".layout-row", ".layout" ],
		/*revert: true,*/
		tolerance: "pointer",
		helper: "clone",
		cursor: '-webkit-grabbing',
		appendTo:"body",
		zindex: 999999,
		disabled:true,
	},
	/* pods within column */
	column: {
		revert: false,
		tolerance: "pointer",
		items: "[ng-model='pod']",
		connectWith: [".layout-column"],
		handle: ".pod-header",
		cursor: "move",
		disabled:true,
		over: function(event, ui) {
			$(event.target).addClass('layout-column-hover');
		},
		out: function(event, ui) {
			$(event.target).removeClass('layout-column-hover');
		},
	},
	row: {
		tolerance: "pointer",
		cursor: "move",
		items: ".layout-column",
		disabled:true,
		/*
		over: function(event, ui) {
			$(event.target).addClass('layout-row-hover');
		},
		out: function(event, ui) {
			$(event.target).removeClass('layout-row-hover');
		}*/
	},
	layout: {
		tolerance: "pointer",
		cursor: "move",
		axis:"y",
		disabled:true,
		over: function(event, ui) {
			$(event.target).addClass('layout-hover');
		},
		out: function(event, ui) {
			$(event.target).removeClass('layout-hover');
		}
	}
};