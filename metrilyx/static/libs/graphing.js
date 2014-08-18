/* major revisions by Maxime Garceau-Brodeur */
var CHART_TEXT_COLOR = '#666';
var DEFAULT_CHART_OPTS = {
    AXIS:{
        gridLineWidth: 1,
        gridLineColor: "#ddd",
        minorGridLineColor: '#f8f8f8',
        minorTickInterval: 'auto',
        startOnTick: false,
    },
    BASIC: {
        colors: [
            '#7cb5ec','#90ed7d','#f7a35c', '#E8719E',
            '#f15c80','#91e8e1','#e4d354','#4CE078','#FF8BF2'],
        chart: {
            spacingTop: 20,
            spacingBottom: 5,
            spacingLeft: 5,
            spacingRight: 5,
            zoomType: 'xy',
            borderRadius: 0,
            borderWidth: 0,
        },
        plotOptions: {
            series: {
                marker: {
                    enabled: true
                }
            },
            flags: {
                cursor: 'pointer'
            },
            pie: {
                innerSize: '50%',
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.y:.2f}<br/>{point.percentage:.2f}%'
                }
            },
            area: {
                fillOpacity: 0.5,
                lineWidth: 1,
                marker:{
                    radius:0
                }
            },
            spline: {
                lineWidth: 1,
                marker:{
                    radius:0
                }
            }
        },
        title: {text: ''},
        legend: {
            enabled: true,
            align: 'center',
            verticalAlign: 'bottom',
            borderWidth: 0,
            itemDistance: 10,
            maxHeight: 70,
            itemMarginTop:1,
            itemMarginBottom:1,
            itemStyle: {
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: "normal",
                color: CHART_TEXT_COLOR
            },
            /*maxHeight: 50,*/
            margin: 5,
            padding: 6,
            navigation: {
                arrowSize: 9,
                style: {
                    fontSize: "10px",
                    fontWeight: "normal"
                }
            },
        },
        credits: {enabled: false}
    }
};
$.extend(DEFAULT_CHART_OPTS.BASIC, {xAxis: DEFAULT_CHART_OPTS.AXIS}, true);
$.extend(DEFAULT_CHART_OPTS.BASIC.xAxis, {opposite:true}, true);

function onAnnotationClick(event) {
    var ead   = $('#event-anno-details');
    var scope = angular.element($(ead)).scope();
    if(scope) {
        scope.$apply(function() {
            scope.selectedAnno = {
                data: event.point.data,
                eventType: event.point.title,
                message: event.point.text,
                timestamp: event.point.x,
                color: event.point.series.color
            };
        });
        $(ead).addClass('open');
    }
    else {
        console.warning('Could not get scope for #event-anno-details!');
    }
}

/**
 *
 * @param graphObj Graph informations.
 * @param timeWin  Time window.
 *
 * @return void
 */
function MetrilyxGraph(graphObj, timeWin) {
/*
    this.timeWindow = timeWin;
    this.graphdata = graphObj;
    this._domNode = $("[data-graph-id='"+this.graphdata._id+"']");
    this._chart = $(this._domNode).highcharts()
*/

    this._graphId    = graphObj._id;
    this._graphData  = graphObj;
    this._domNode    = $("[data-graph-id='" + this._graphId + "']");
    this._chart      = this._domNode.highcharts();
    this._chartType  = this._graphData.graphType;
    this.timeWindow  = timeWin;
    this.dataInError = this.dataHasErrors();
    this.annotations = null;
}

/**
 * Check if data is in error.
 *
 * @returns bool
 */
MetrilyxGraph.prototype.isPieChart = function() {
    return this._chartType === 'pie';
};

/**
 * Check if data is in error.
 *
 * @returns bool
 */
MetrilyxGraph.prototype.dataHasErrors = function() {

    var series = this._graphData.series;
    for(var i = 0; i < series.length; i++) {

        var currentSerie = series[i];
        if(currentSerie.data.error !== undefined) {

            var error = currentSerie.data.error;
            var msg   = error.message ? error.message.substring(0, 80) + "..." : error.substring(0, 50) + "...";

            this._domNode.html("<span class='graph-error'>" + currentSerie.query.metric + ": " + msg + "</span>");
            return {
                error: {
                    message: msg,
                    metric : currentSerie.query.metric
                }
            };
        }
    }
    return false;
};

/**
 * Create Highchart.
 *
 * @param options Options for Highchart.
 * @param type    Highchart type.
 *
 * @return void
 */
MetrilyxGraph.prototype.createHighChart = function(options, type) {

    if(type !== undefined) {

        this._domNode.highcharts(type, options);
    }
    else {

        this._domNode.highcharts(options);
    }

    this._chart = this._domNode.highcharts();
};

/**
 * Create new chart for this DOM node.
 *
 * @return void
 */
MetrilyxGraph.prototype.newChart = function() {
    if(this.dataInError) {
        this._domNode.html("");
        return;
    }

    var copts = new ChartOptions(this._graphData);
    if(this.isPieChart()) {
        this.createHighChart(copts.chartDefaultsForType());
    } else {

        Highcharts.setOptions({ global: { useUTC: false } });
        Highcharts.seriesTypes.line.prototype.drawPoints = function() {};
        this.createHighChart(copts.chartDefaultsForType(), "StockChart");
    }
};

/**
 * Apply data on Graph.
 *
 * @returns void
 */
MetrilyxGraph.prototype.applyData = function() {
    if(this._chart === undefined) {
        this.newChart();
    }
    else if(!this.dataInError) {
        this._domNode.html("");
        this.upsertSeries();
        this.createAnnotations();
    }
};

/**
 * Add or update series with new data.
 *
 * @return void
 */
MetrilyxGraph.prototype.upsertSeries = function() {

    if(this._chart === undefined) {
        console.log("graph uninitialized: not upserting. name", this._graphData.name, "type", this._graphData.graphType, "_id", this._graphId);
        return;
    }
    if(this.isPieChart()) {

        this.upsertPieSeries();
    }
    else {

        this.upsertLineBasedSeries();
    }
    this._chart.redraw();
};

/**
 * Add or update series with new data. (Pie chart)
 *
 * @return void
 */
MetrilyxGraph.prototype.upsertPieSeries = function() {

    var firstChartSerie = this._chart.series[0];
    var series          = this._graphData.series;
    for(var i = 0; i < series.length; i++) {

        var currentSerie = series[i];
        var found        = false;
        for(var j = 0; j < firstChartSerie.options.data.length; j++) {

            var currentSerieData    = currentSerie.data[0];
            var firstChartSerieData = firstChartSerie.options.data[j];
            if(equalObjects(currentSerieData.tags, firstChartSerieData.tags) && currentSerieData.alias === firstChartSerieData.name) {
                found = true;
                firstChartSerie.options.data.splice(j, 1, this.getHighchartsFormattedPieSerie(currentSerieData, firstChartSerieData.query));
                firstChartSerie.setData(firstChartSerie.options.data, false);
                break;
            }
        }
        if(!found) {

            firstChartSerie.addPoint(this.getHighchartsFormattedPieSerie(currentSerie.data[0], currentSerie.query), false);
        }
    }
};

/**
 * Add or update series with new data. (Pie chart)
 *
 * @return void
 */
MetrilyxGraph.prototype.upsertLineBasedSeries = function() {

    var series      = this._graphData.series;
    var chartSeries = this._chart.series;
    var firstSerie  = series[0];
    for(var i = 0; i < series.length; i++) {

        var currentSerie = series[i];
        for(var j = 0; j < currentSerie.data.length; j++) {

            var found            = false;
            var currentGraphData = currentSerie.data[j];
            for(var k = 0; k < chartSeries.length; k++) {

                var currentChartData = chartSeries[k];
                try {
                    if(equalObjects(currentSerie.query, currentChartData.options.query)
                            && equalObjects(currentGraphData.tags, currentChartData.options.tags)) {

                        found       = true;
                        var newData = false;
                        if(currentChartData.options.data.length <= 0) {

                            newData = currentGraphData.dps;
                        } else {
                            newData = getDataAlignedSeriesForTimeWindow({
                                name      : currentChartData.options.name,
                                currData  : currentChartData.options.data,
                                newData   : currentGraphData.dps,
                                timeWindow: this.timeWindow
                            });
                        }
                        if(newData !== false) currentChartData.setData(newData, false, null, false);
                        break;
                    }
                }
                catch(e) {

                    console.log("upsertLineBasedSeries", currentSerie.query, e);
                }
            }
            if(!found) {

                var paneIndex = this._graphData.multiPane ? firstSerie.paneIndex : false;
                this._chart.addSeries(this.getHighchartsFormattedSerie(firstSerie.data[j], firstSerie.query, paneIndex), false);
            }
        }
    }
};

/**
 * Remove series from Graph highcharts.
 *
 * @param graph Graph data with series to remove.
 *
 * @return void
 */
//MetrilyxGraph.prototype.removeSeries = function(graph) {
//
//    if(this._chart !== undefined) {
//
//        var chartSeries = this._chart.series;
//        for(var i = 0; i < chartSeries.length; i++) {
//
//            var remove = true;
//            for(var j = 0; j < graph.series.length; j++) {
//
//                if(equalObjects(graph.series[j].query, chartSeries[i].options.query)) {
//                    remove = false;
//                    break;
//                }
//            }
//            if(remove) {
//
//                chartSeries[i].remove(true);
//            }
//        }
//    }
//};

/**
 * Get highchart formatted series for pie chart.
 *
 * @param data  Serie data.
 * @param query Query
 *
 * @return void
 */
MetrilyxGraph.prototype.getHighchartsFormattedPieSerie = function(data,  query) {
    return { name: data.alias, y: data.dps[0][1], tags: data.tags, query: query };
};

/**
 * Get highchart formatted series for other charts than pie one.
 *
 * @param data  Serie data.
 * @param query Query.
 * @param index Pane index.
 *
 * @return void
 */
MetrilyxGraph.prototype.getHighchartsFormattedSerie = function (data, query, index) {
    var params = { lineWidth: 1, name: data.alias, data: data.dps, query: query, tags: data.tags };
    if(index) {
        params.yAxis = parseInt(index);
    }
    return params;
};

/**
 * Create Graph Annotations.
 *
 * @return void
 */
MetrilyxGraph.prototype.createAnnotations = function() {

    var annoEvents = this._graphData.annoEvents;
    if(annoEvents && annoEvents.data && annoEvents.data.length > 0) {

        this.annotations = new MetrilyxAnnotation(this);
        this.annotations.applyData();
    }
};
// -- Not used at this moment.
/*
function graphing_replaceSeries(result, redraw) {
    var hcg = $("[data-graph-id='"+result._id+"']").highcharts();
    for(var r in result.series[0].data) {
        tr = result.series[0].data[r];
        var found = false;
        for(var hs in hcg.series) {
            if(tr.alias == hcg.series[hs].name && equalObjects(hcg.series[hs].options.tags, tr.tags)) {
                found = true;
                hcg.series[hs].setData(tr.dps,true,null, false);
                break;
            }
        }
        // if tags change more series can be return upsert if this is the case
        if(!found) {
            var paneIndex = result.multiPane ? result.series[0].paneIndex : false;
            hcg.addSeries(highchartsFormattedSerie(tr,result.series[0].query, null, paneIndex), false);
        }
    }
    if(redraw) hcg.redraw();
}
*/

function MetrilyxAnnotation(graph) {

    this._data       = graph._graphData;
    this._domNode    = graph._domNode;
    this._chart      = this._domNode.highcharts();
    this._statusElem = $("[data-graph-status='" + graph._id + "']");
}

MetrilyxAnnotation.prototype.appendData = function(serieIdx) {

    var ndata        = [];
    var currentSerie = this._chart.series[serieIdx];
    for(var i = 0; i < currentSerie.data.length; i++) {
        try {
            var currentData = currentSerie.data[i];
            if(currentData.x < this._data.annoEvents.data[0].x) {
                ndata.push({
                    x: currentData.x,
                    title: currentData.title,
                    text: currentData.text,
                    data: currentData.data
                });
            }
            else {
                break;
            }
        }
        catch(e) {
            console.error(e);
            console.log(currentSerie.data, this._data.annoEvents.data);
        }
    }
    for(var i = 0; i < this._data.annoEvents.data.length; i++) {
        ndata.push(this._data.annoEvents.data[i]);
    }
    currentSerie.setData(ndata);
};

MetrilyxAnnotation.prototype.applyData = function() {
    var idx = -1;
    for(var i = 0; i < this._chart.series.length; i++) {
        var currentSerie = this._chart.series[i];
        if(currentSerie.type === 'flags') {
            if(currentSerie.name === this._data.annoEvents.eventType) {
                idx = i;
                break;
            }
        }
    }
    if(idx < 0) {
        var sf = new SeriesFormatter(this._data.annoEvents.data);
        this._chart.addSeries(sf.flagsSeries(this._data.annoEvents.eventType));
    }
    else {
        this.appendData(idx);
    }
};

/*
 * Preps data from server (metrilyx graph objects) for highcharts
 */
function ChartOptions(metGraphObj, flagSeries) {
    this._graph = metGraphObj;
    if(flagSeries) {
        this.flagSeries = true;
        this._sfmt = new SeriesFormatter(this._graph.annoEvents.data);
    } else {
        this.flagSeries = false;
        this._sfmt = new SeriesFormatter(this._graph.series);
    }
}
ChartOptions.prototype.chartDefaults = function() {
    return $.extend({},DEFAULT_CHART_OPTS.BASIC);
};
ChartOptions.prototype.pieChartDefaults = function(extraOpts) {
    return $.extend(true, {}, this.chartDefaults(), {
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
            spacingTop: 5
        },
        legend: { enabled: false },
        tooltip: {
            useHTML: true,
            shared: true,
            shadow: false,
            borderColor: '#666',
            backgroundColor: 'rgba(90,90,90,0.9)',
            formatter: function() {
                var s = '<span style="color:'+this.point.color+'">'+this.point.name+'</span><br/>';
                s += '<table style="margin-top:5px;font-weight:bold;font-size:11px;color:#ddd"><tr><td>'+this.point.y+'</td></tr></table>';
                return s;
            },
            style: {
                color: '#ddd',
                fontSize: '11px'
            }
        },
        series: this._sfmt.pieSeries()
    }, extraOpts);
};
/*
    Determine if plot bands are applicable.
    Return:
        yAxis option for highcharts.
*/
ChartOptions.prototype.__plotBands = function() {
    if(this._graph.thresholds) {
        return getPlotBands(this._graph.thresholds);
    }
    return $.extend({}, DEFAULT_CHART_OPTS.AXIS);
};
ChartOptions.prototype.lineChartDefaults = function(extraOpts) {
    var opts = $.extend(true, this.chartDefaults(), {
        chart: {
            type: 'line'
        },
        tooltip: {
            crosshairs: [{color: '#428bca'},false],
            borderColor: 'none',
            backgroundColor: 'none',
            valueDecimals: 2,
            shadow: false,
            animation: false,
            useHTML: true,
            formatter: function() {
                if(this.point) {
                    var s = '<div class="chart-tooltip annotation" style="color:#ddd;border-color:'+this.point.series.color+'">';
                    s += '<div class="small"><span class="padr5" style="color:'+this.point.series.color+'">'+this.point.title+"</span>"+ (new Date(this.x)).toLocaleString() +'</div>';
                    s += "<div style='padding-top:7px;font-size:11px;'>" + this.point.text +"</div></div>";
                } else {
                    var s = '<div class="chart-tooltip"><small style="color:#eee">'+ (new Date(this.x)).toLocaleString() +'</small>';
                    s += '<table style="font-size:11px;color:#ddd;min-width:220px;margin-top:5px;">';
                    var sortedPoints = this.points.sort(function(a, b){
                        return ((a.y > b.y) ? -1 : ((a.y < b.y) ? 1 : 0));
                    });
                    $.each(sortedPoints , function(i, point) {
                        //&#8226;
                        s += '<tr><td style="color:'+point.series.color+'">'+ point.series.name +'</td>';
                        s += '<td style="text-align:right;padding-left:3px">'+ (point.y).toFixed(2) + '</td></tr>';
                    });
                    s += '</table></div>';
                }
                return s;
            }
        },
        scrollbar: {
            enabled: false
        },
        navigation:{
            buttonOptions: {
                enabled:false
            }
        },
        rangeSelector: {
            enabled: false
        },
        navigator: {
            enabled: false
        }
    }, extraOpts);
    if(this._graph.multiPane) {
        //console.log(this._graph);
        h = 100/this._graph.panes.length;
        hstr = h.toString();
        opts.yAxis = [];
        var currTop = 0;
        for(var i=0; i< this._graph.panes.length; i++) {
            opts.yAxis.push(
                $.extend(true, this.__plotBands(), {
                    height: (h-3).toString()+"%",
                    top: currTop.toString()+"%",
                    offset: 0,
                    labels: {align:"right",x:-5},
                    title: {text: this._graph.panes[i]}
                }));
            currTop += h;
        }
        //console.log(opts.yAxis);
    } else {
        opts.yAxis = this.__plotBands();
    }

    if(this.flagSeries) {
        $.extend(opts,{'series':this._sfmt.flagsSeries(this._graph.annoEvents.eventType)},true);
    } else {
        $.extend(opts,{'series':this._sfmt.lineSeries(this._graph.multiPane)},true);
    }
    return opts;
};
ChartOptions.prototype.areaChartDefaults = function(extraOpts) {
    var opts = this.lineChartDefaults(extraOpts);
    $.extend(opts.chart, {'type': 'area'}, true);
    if(opts.plotOptions.area.stacking)
        delete opts.plotOptions.area.stacking;
    return opts;
};
ChartOptions.prototype.stackChartDefaults = function(extraOpts) {
    var opts = this.areaChartDefaults(extraOpts);
    $.extend(opts.plotOptions.area, {stacking:'normal'}, true);
    return opts;
};
ChartOptions.prototype.splineChartDefaults = function(extraOpts) {
    var opts = this.lineChartDefaults(extraOpts);
    $.extend(opts.chart, {'type': 'spline'}, true);
    return opts;
};
ChartOptions.prototype.chartDefaultsForType = function(extraOpts) {
    switch(this._graph.graphType) {
        case "pie":
            return this.pieChartDefaults(extraOpts);
            break;
        case "area":
            return this.areaChartDefaults(extraOpts);
            break;
        case "stacked":
            return this.stackChartDefaults(extraOpts);
            break;
        case "spline":
            return this.splineChartDefaults(extraOpts);
            break;
        default:
            return this.lineChartDefaults(extraOpts);
            break;
    }
};

function SeriesFormatter(metSeries) {
    this.metSeries = metSeries;
}

SeriesFormatter.prototype.seriesTags = function() {

    var tags = {};
    for(var i = 0; i < this.metSeries.length; i++) {

        var currentSerie = this.metSeries[i];
        for(var j = 0; j < currentSerie.data.length; j++) {

            var currentData = currentSerie.data[j];
            for(var k in currentData.tags) {
                if(tags[k]) {
                    if(tags[k].indexOf(currentData.tags[k]) < 0) {
                        tags[k].push(currentData.tags[k]);
                    }
                }
                else {
                    tags[k] = [currentData.tags[k]];
                }
            }
        }
    }
    return tags;
};
SeriesFormatter.prototype.flagsSeries = function(eventType) {
    return {
        name: eventType,
        type:'flags',
        data: this.metSeries,
        shape: 'squarepin',
        index: 0,
        style: {
            color: CHART_TEXT_COLOR
        },
        y: -48,
        stackDistance: 20,
        states : {
            hover : { fillColor: '#ddd' }
        },
        events: {
            click: onAnnotationClick
        }
    };
};

SeriesFormatter.prototype.lineSeries = function(isMultiPane) {

    out = [];
    for(var i = 0; i < this.metSeries.length; i++) {

        var currentSerie = this.metSeries[i];
        for(var d = 0; d < currentSerie.data.length; d++) {

            var currentData = currentSerie.data[d];
            var obj         = {
                query: currentSerie.query,
                tags: currentData.tags,
                name: currentData.alias,
                data: currentData.dps,
                lineWidth: 1
            };

            if(isMultiPane) {
                obj.yAxis = parseInt(currentSerie.paneIndex);
            }
            out.push(obj);
        }
    }
    return out;
};

SeriesFormatter.prototype.pieSeries = function() {

    var pieData = [];
    for(var i = 0; i < this.metSeries.length; i++) {

        var currentSerie = this.metSeries[i];
        for(var d = 0; d < currentSerie.data.length; d++) {

            var dps = currentSerie.data[d].dps;
            if(dps.length <= 0) {
                console.warn("(pie) No data for:", currentSerie.alias);
            }
            else {
                pieData.push(MetrilyxGraph.prototype.getHighchartsFormattedPieSerie(currentSerie.data[d], currentSerie.query));
            }
        }
    }
    return [{ data: pieData, type: 'pie' }];
};

/* HELP FUNCTIONS */
/*
 * - Compare single level object
 * - Special case for tags
 *
 */
function keyCount(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
function equalObjects(obj1, obj2) {
    if(keyCount(obj1) !== keyCount(obj2)) {
        return false;
    }
    for(var i in obj1) {
        if( Object.prototype.toString.call(obj1[i]) === '[object Object]' ) {
            return equalObjects(obj1[i], obj2[i]);
        } else {
            //console.log()
            try {
                if(obj1[i] !== obj2[i]) {
                    return false;
                }
            } catch(e) {
                console.log(e);
                console.log(obj1, obj2);
                return false;
            }
        }
    }
    return true;
}
function getPlotBands(thresholds) {
    var out = {};
    $.extend(out, DEFAULT_CHART_OPTS.AXIS, true);
    $.extend(out, { plotBands: [
            {
                from: thresholds.info.min,
                to: thresholds.info.max,
                color: "rgba(99,177,211,0.3)"
            },{
                from: thresholds.warning.min,
                to: thresholds.warning.max,
                color:"rgba(224,158,73,0.3)"
            },{
                from: thresholds.danger.min,
                to: thresholds.danger.max,
                color: "rgba(187,74,71,0.3)"
            }
        ]
    }, true);
    return out;
}
function setPlotBands(graph) {
    var renderTo = $("[data-graph-id='" + graph._id + "']");
    var hc       = renderTo.highcharts();
    if(hc === undefined) {
        console.log("chart undefined", graph._id);
        return;
    }
    hc.options.yAxis = getPlotBands(graph.thresholds);
    renderTo.highcharts("StockChart",hc.options);
}

function filterForTimeWindow(arr, startTime, endTime) {
    var result = [];
    for(var i = 0, count = arr.length; i < count; i++) {
        if(arr[i][0] >= startTime && arr[i][0] < endTime) {
            result.push(arr[i]);
        }
    }
    return result;
}

function getDataAlignedSeriesForTimeWindow(args) {

    var result = false;
    if(args.newData.length > 0) {

        var newStartTime = args.newData[0][0];
        var newEndTime   = args.newData[args.newData.length - 1][0];

        var currStartTime = args.currData[0][0];
        var currEndTime   = args.currData[args.currData.length - 1][0];

        if(newEndTime > currEndTime) {

            if((newStartTime >= args.timeWindow.start) && (newStartTime < args.timeWindow.end)) {

                if((newStartTime >= currStartTime) && (newEndTime > currEndTime)) {

                    result = filterForTimeWindow(args.currData, args.timeWindow.start, newStartTime).concat(args.newData);
                }
            }
            else {

                console.log(args.name, "data out of range", new Date(args.timeWindow.start), new Date(args.timeWindow.end));
            }
        }
    }
    return result;
}

function graphing_removeSeries(gobj) {
    var hcg = $("[data-graph-id='"+gobj._id+"']").highcharts();
    //var found = false;
    for(var h in hcg.series) {
        var remove = true;
        for(var d in gobj.series) {
            //console.log(hcg.series[h].options);
            if(equalObjects(gobj.series[d].query, hcg.series[h].options.query)) {
                remove = false;
                break;
            }
        }
        if(remove) hcg.series[h].remove(true);
    }
}
