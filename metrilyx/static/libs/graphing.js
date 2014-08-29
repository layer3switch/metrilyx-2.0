// TODO below here needs fixing //
var CHART_TEXT_COLOR = '#666';
var DEFAULT_CHART_OPTS = {
    AXIS:{
        gridLineWidth: 1,
        gridLineColor: "#ddd",
        minorGridLineColor: '#f8f8f8',
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
    var ead = $('#event-anno-details');
    var newAnno = {
        data: event.point.data,
        eventType: event.point.title,
        message: event.point.text,
        timestamp: event.point.x,
        color: event.point.series.color,
        isOpen: true
    };
    scope = angular.element($(ead)).scope();
    if(scope) {
        scope.$apply(function(){
            if(equalObjects(scope.selectedAnno, newAnno) && ead.hasClass('open')) {
                //$(ead).removeClass('open');
                ead.removeClass('open');
            } else {
                scope.selectedAnno = newAnno;
                //$(ead).addClass('open');
                ead.addClass('open');
            }
        });
    } else {
        console.warning('Counld not get scope for #event-anno-details!');
    }
}

function MetrilyxGraph(graphObj, timeWin) {
    this._graphId   = graphObj._id;
    this._graphData = graphObj;
    this._domNode   = $("[data-graph-id='" + this._graphId + "']");
    this._statusNode = $("[data-graph-status='"+this._graphId+"']");
    this._chart     = this._domNode.highcharts();
    this.timeWindow = timeWin;

    /*
    this.graphdata = graphObj;
    this._chartElem = $("[data-graph-id='"+this.graphdata._id+"']");
    */

    if(this._graphData.secondaries && this._graphData.secondaries.length > 0) {
        this.hasSecondaries = true;
    } else {
        this.hasSecondaries = false;
    }
}
MetrilyxGraph.prototype.isPieChart = function() {
    return this._graphData.graphType === "pie";
}
MetrilyxGraph.prototype.dataHasErrors = function() {
    var series = this._graphData.series;
    for(var s=0; s < series.length; s++) {
        
        var currentSerie = series[s];
        if(currentSerie.data.error !== undefined) {
            
            var error = currentSerie.data.error;
            var msg   = error.message ? error.message.substring(0, 150) + "..." : error.substring(0, 100) + "...";
            
            this._statusNode.html("<span class='graph-error'>"+currentSerie.query.metric+": "+msg+"</span>");
            return { "error": { 
                "message": msg, 
                "metric": currentSerie.query.metric 
            }};
        }
    }
    this._statusNode.html("");
    return false;
}
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
    } else {

        this._domNode.highcharts(options);
    }
    /* get ref to chart obj */
    this._chart = this._domNode.highcharts();
}
MetrilyxGraph.prototype.newChart = function() {
    
    if(!this.dataHasErrors(this._graphData)) {
        var copts = new ChartOptions(this._graphData);
        if(this.isPieChart()) {
            this.createHighChart(copts.chartDefaultsForType());
        } else {
            Highcharts.setOptions({ global: { useUTC: false } });
            Highcharts.seriesTypes.line.prototype.drawPoints = function() {};
            this.createHighChart(copts.chartDefaultsForType(), "StockChart");
        }
    } 
}
MetrilyxGraph.prototype.upsertPieSeries = function() {
    
    var series          = this.hasSecondaries ? this._graphData.secondaries: this._graphData.series;
    var firstChartSerie = this._chart.series[0];
    //var series = this._graphData.series;
    for(var j=0; j < series.length; j++) {
        var found = false;
        var currentSerie = series[j];

        for(var d=0; d < firstChartSerie.options.data.length; d++) {
            var currentSerieData    = currentSerie.data[0];
            var firstChartSerieData = firstChartSerie.options.data[d];
            if(equalObjects(currentSerieData.tags, firstChartSerieData.tags) 
                            && currentSerieData.alias==firstChartSerieData.name) {
                found = true;
                firstChartSerie.options.data.splice(d, 1, this.getHighchartsFormattedPieSerie(currentSerieData, firstChartSerieData.query));
                firstChartSerie.setData(firstChartSerie.options.data, false);
                break;
            }
        }
        if(!found) 
            firstChartSerie.addPoint(this.getHighchartsFormattedPieSerie(currentSerieData, currentSerie.query), false);
    }
}

MetrilyxGraph.prototype.upsertLineBasedSeries = function() {
    
    var series      = this.hasSecondaries ? this._graphData.secondaries: this._graphData.series;
    var chartSeries = this._chart.series;
    var firstSerie  = series[0];
    for(var j=0; j < series.length; j++) {
        
        var currentSerie = series[j];
        for(var d=0; d < currentSerie.data.length; d++) {

            var found = false;
            var currentGraphData = currentSerie.data[d];
            for(var i=0; i < chartSeries.length; i++) {

                var currentChartData = chartSeries[i];
                try {
                    if(equalObjects(currentSerie.query, currentChartData.options.query) && 
                            equalObjects(currentGraphData.tags, currentChartData.options.tags)) {                  
                        
                        found = true;
                        var newData = false;
                        if(currentChartData.options.data.length <= 0) {
                            newData = currentGraphData.dps;
                        } else {
                            newData = getDataAlignedSeriesForTimeWindow({
                                name:  currentChartData.options.name,
                                currData: currentChartData.options.data,
                                newData:  currentGraphData.dps,
                                timeWindow: this.timeWindow
                            });
                        }
                        if(newData != false) currentChartData.setData(newData, false, null, false);
                        break;
                    }
                } catch(e) {
                    console.log("upsertLineBasedSeries", currentSerie.query, e);
                    console.log(currentChartData.options);
                    console.log(currentGraphData);
                }
            }
            
            if(!found) {
                var paneIndex = this._graphData.multiPane ? currentSerie.paneIndex : false;
                this._chart.addSeries(this.getHighchartsFormattedSerie(currentGraphData, currentSerie.query, paneIndex), false);
            }
        }
    }
}
/*
 * Add or update series with new data
 *  args:   Graph data
 *
 *
 * @return bool Should redraw graph
 */
MetrilyxGraph.prototype.upsertSeries = function() {
    if(this._chart === undefined) {
        console.log("graph uninitialized: not upserting. name", 
            this._graphData.name, "type", this._graphData.graphType,"_id", this._graphId);
        return false;
    }
    if(this.isPieChart()) {
        this.upsertPieSeries();
    } else {
        this.upsertLineBasedSeries();
    }
    return true;
}

MetrilyxGraph.prototype.applyData = function() {
    if(!this.dataHasErrors()) {
        var redraw = false;
        if(this._chart === undefined) {
            this.newChart();
        } else {   
            redraw = this.upsertSeries();
        } 
        if(redraw) this._chart.redraw();
    }   
}
/**
 * Get highchart formatted series for pie chart.
 *
 * @param data  Serie data.
 * @param query Query
 *
 * @return void
 */
MetrilyxGraph.prototype.getHighchartsFormattedPieSerie = function (data,  query) {

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
MetrilyxGraph.prototype.findSerieIndexInChart = function(serie) {
    var chartSeries = this._chart.series;
    for(var c=0; c < chartSeries.length; c++) {
        if (equalObjects(chartSeries[c].options.query, serie.query)) return c;
    }
    return -1;
}

/**
 * Removes series from highcharts that are not part of the current graph.
 *
 * @param graph Current graph model object after removal.
 *
 * @return void
 */
MetrilyxGraph.prototype.removeSeries = function(series) {

    if(series.length === 0) return;

    var chartSeries = this._chart.series;
    var redraw = false;
    for(var s=0; s < series.length; s++) {
        
        var cs = this.findSerieIndexInChart(series[s]);
        if(cs != -1) redraw = true;
        
        while(cs != -1) {
            
            chartSeries[cs].remove(false);
            cs = this.findSerieIndexInChart(series[s]);
        }      
    }
    if(redraw) this._chart.redraw();
}

function MetrilyxAnnotation(obj) {
    this._data = obj;
    this._chartElem = $("[data-graph-id='"+this._data._id+"']");
    this._statusElem = $("[data-graph-status='"+this._data._id+"']");
}
MetrilyxAnnotation.prototype.sortAnno = function(a,b) {
    if (a.x < b.x) return -1;
    if (a.x > b.x) return 1;
    return 0;
}
MetrilyxAnnotation.prototype.appendData = function(chrt, serieIdx) {
    var ndata = [];
    for(var i=0; i < chrt.series[serieIdx].data.length; i++) {
        try {
            if(chrt.series[serieIdx].data[i].x < this._data.annoEvents.data[0].x) {
                ndata.push({
                    x: chrt.series[serieIdx].data[i].x,
                    title: chrt.series[serieIdx].data[i].title,
                    text: chrt.series[serieIdx].data[i].text,
                    data: chrt.series[serieIdx].data[i].data
                });
            } else if(!equalObjects(chrt.series[serieIdx].data[i], this._data.annoEvents.data[0])) {
                ndata.push({
                    x: chrt.series[serieIdx].data[i].x,
                    title: chrt.series[serieIdx].data[i].title,
                    text: chrt.series[serieIdx].data[i].text,
                    data: chrt.series[serieIdx].data[i].data
                });
            } else {break;}
        } catch(e) {
            console.error(e);
            console.log(chrt.series[serieIdx].data, this._data.annoEvents.data);
        }
    }
    for(var i=0; i < this._data.annoEvents.data.length; i++) {
        ndata.push(this._data.annoEvents.data[i]);
    }
    chrt.series[serieIdx].setData(ndata.sort(this.sortAnno));
}
MetrilyxAnnotation.prototype.queueDataForRendering = function() {
    // queue annotations until graph is rendered with metric data //
    var ma = this;
    // wait until the chart has been initialized //
    var tout = setTimeout(function() {
        var wchrt = $(ma._chartElem).highcharts();
        if(wchrt === undefined) {
            clearTimeout(tout);
            $(ma._statusElem).html("<span class='small'>waiting for graph to initialize (annotations)...</span>");
            ma.queueDataForRendering();
        } else {
            wsf = new SeriesFormatter(ma._data.annoEvents.data);
            var idx = -1;
            for(var i=0; i < wchrt.series.length; i++) {
                if(wchrt.series[i].type === 'flags') {
                    if(wchrt.series[i].name === ma._data.annoEvents.eventType) {
                        idx = i;
                        break;
                    }
                }
            }
            if(idx < 0) {
                var sf = new SeriesFormatter(ma._data.annoEvents.data);
                wchrt.addSeries(sf.flagsSeries(ma._data.annoEvents.eventType));
            } else {
                ma.appendData(wchrt, idx);
            }
        }
    }, 3000);
}
MetrilyxAnnotation.prototype.applyData = function() {
    /*
        Graph must be initialized before adding annotations or they disappear.
        Queue the data until graph has been initialized with performance data.
    */
    this.queueDataForRendering();
}

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
        if(this._graph.secondaries !== undefined && this._graph.secondaries.length > 0) {
            this._sfmt = new SeriesFormatter(this._graph.secondaries);
        } else {
            this._sfmt = new SeriesFormatter(this._graph.series);
        }
    }
}
ChartOptions.prototype.chartDefaults = function() {
    return $.extend({},DEFAULT_CHART_OPTS.BASIC);
}
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
}
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
                    title: {text: this._graph.panes[i]},
                }));
            currTop += h;
        }
    } else {
        opts.yAxis = this.__plotBands();
    }

    if(this.flagSeries) {
        $.extend(opts,{'series':this._sfmt.flagsSeries(this._graph.annoEvents.eventType)},true);
    } else {
        $.extend(opts,{'series':this._sfmt.lineSeries(this._graph.multiPane)},true);
    }
    return opts;
}
ChartOptions.prototype.areaChartDefaults = function(extraOpts) {
    var opts = this.lineChartDefaults(extraOpts);
    $.extend(opts.chart, {'type': 'area'}, true);
    if(opts.plotOptions.area.stacking) 
        delete opts.plotOptions.area.stacking;
    return opts;
}
ChartOptions.prototype.stackChartDefaults = function(extraOpts) {
    var opts = this.areaChartDefaults(extraOpts);
    $.extend(opts.plotOptions.area, {stacking:'normal'}, true);
    return opts;
}
ChartOptions.prototype.splineChartDefaults = function(extraOpts) {
    var opts = this.lineChartDefaults(extraOpts);
    $.extend(opts.chart, {'type': 'spline'}, true);
    return opts;
}
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
}
function SeriesFormatter(metSeries) {
    this.metSeries = metSeries;
}
SeriesFormatter.prototype.seriesTags = function() {
    var tags = {};
    for(var i=0; i < this.metSeries.length; i++) {
        for(var d=0; d < this.metSeries[i].data.length; d++) {
            for(var j in this.metSeries[i].data[d].tags) {
                if(tags[j]) {
                    if(tags[j].indexOf(this.metSeries[i].data[d].tags[j]) < 0) {
                        tags[j].push(this.metSeries[i].data[d].tags[j]);
                    }
                } else {
                    tags[j] = [this.metSeries[i].data[d].tags[j]];
                }
            }
        }
    }
    return tags;
}
SeriesFormatter.prototype.flagsSeries = function(eventType) {
    return {
        name: eventType,
        type:'flags',
        data: this.metSeries,
        shape: 'squarepin',
        index: 0,
        style: {
            color: CHART_TEXT_COLOR,
        },
        y: -48,
        stackDistance: 20,
        states : {
            hover : {fillColor: '#ddd'},
        },
        events: {
            click: onAnnotationClick
        }
    };
}
SeriesFormatter.prototype.lineSeries = function(isMultiPane) {
    out = [];
    if(isMultiPane) {

        for(var i=0; i < this.metSeries.length; i++) {
            for(var d=0; d < this.metSeries[i].data.length; d++) {

                out.push({
                    uuid: this.metSeries[i].data[d].uuid,
                    query: this.metSeries[i].query,
                    tags: this.metSeries[i].data[d].tags,
                    name: this.metSeries[i].data[d].alias,
                    data: this.metSeries[i].data[d].dps,
                    yAxis: parseInt(this.metSeries[i].paneIndex),
                    lineWidth: 1
                });
            }
        }
    } else {

        for(var i=0; i < this.metSeries.length; i++) {
            for(var d=0; d < this.metSeries[i].data.length; d++) {

                out.push({
                    uuid: this.metSeries[i].data[d].uuid,
                    query: this.metSeries[i].query,
                    tags: this.metSeries[i].data[d].tags,
                    name: this.metSeries[i].data[d].alias,
                    data: this.metSeries[i].data[d].dps,
                    lineWidth: 1
                });
            }
        }
    }
    return out;
}
SeriesFormatter.prototype.pieSeries = function() {
    var pieData = [];
    for(var i=0; i < this.metSeries.length; i++) {
        for(var d=0; d < this.metSeries[i].data.length; d++){
            //dps = this.metSeries[i].data[d].dps;
            if(this.metSeries[i].data[d].dps.length <=0) {
                console.warn("(pie) No data for:", this.metSeries[i].alias);
            } else {
                pieData.push(MetrilyxGraph.prototype.getHighchartsFormattedPieSerie(
                                        this.metSeries[i].data[d], this.metSeries[i].query));
            }
        }
    }
    return [{ data: pieData, type: 'pie' }];
}
/*
 * Get difference in two series based on the query.
 * This is used in particular when serie/s is removed.
 *
 */
function getSeriesDeltaByQuery(subset, fullset) {
    if(subset.length < 1) return fullset;
    var deltas = [];
    for(var i=0; i < fullset.length; i++) {
        for(var j=0; j < subset.length; j++) {
            if(!equalObjects(subset[j].query, fullset[i].query)) deltas.push(fullset[i]);
        }
    }
    return deltas;
}
/* helper functions */
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
    if(keyCount(obj1) != keyCount(obj2)) {
        return false;
    }
    for(var i in obj1) {
        if( Object.prototype.toString.call(obj1[i]) === '[object Object]' ) {
            return equalObjects(obj1[i], obj2[i]);
        } else {
            //console.log()
            try {
                if(obj1[i] != obj2[i]) {
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
    renderTo = "[data-graph-id='"+graph._id+"']";
    hc = $(renderTo).highcharts();
    if(hc == undefined) {
        console.log("chart undefined", graph._id);
        return;
    }
    hc.options.yAxis = getPlotBands(graph.thresholds);
    $(renderTo).highcharts("StockChart",hc.options);  
}

function printAlignmentDebug(args) {
    console.warn(args.name);
    console.warn("curr data:",new Date(args.currStartTime),new Date(args.currEndTime), "dps", args.currDataLength);
    console.warn("new  data:", new Date(args.newStartTime),new Date(args.newEndTime), "dps", args.newDataLength);
    console.warn("window",new Date(args.timeWindow.start), new Date(args.timeWindow.end));
}
/**
 * Get aligned data eliminating duplicates
 *
 * |----- curr data -----|
 *                   |----- new data -----|
 *
 * @param: name         name
 * @param: currData     data in currently display chart
 * @param: newData      data received from backend
 * @param: timeWindow   object current with start and end time window
 *
 * @return: Dataset with current and new data aligned
 *
 * |----- current & new data -----|
 *
 */
function getDataAlignedSeriesForTimeWindow(args) {
    if(args.newData.length <= 0) return false;

    newStartTime = args.newData[0][0];
    newEndTime = args.newData[args.newData.length-1][0];

    currStartTime = args.currData[0][0];
    currEndTime = args.currData[args.currData.length-1][0];

    /* no new data */
    if(newEndTime <= currEndTime) return false;
    /* check time window */
    if((newStartTime >= args.timeWindow.start) && (newStartTime < args.timeWindow.end)) {
        if((newStartTime<currStartTime) && (newEndTime>currStartTime)) {
            printAlignmentDebug({
                'name': args.name,'timeWindow': args.timeWindow,
                'currStartTime': currStartTime,'currEndTime': currEndTime,'currDataLength': args.currData.length,
                'newStartTime': newStartTime, 'newEndTime': newEndTime, 'newDataLength': args.newData.length
            });
            return false;
        } else if((newStartTime>=currStartTime) &&(newEndTime>currEndTime)) {
            
            while(args.currData.length > 0 && args.currData[args.currData.length-1][0] >= newStartTime) 
                c = args.currData.pop();
            while(args.currData.length > 0 && args.currData[0][0] < args.timeWindow.start) 
                c = args.currData.shift();
           
            return args.currData.concat(args.newData);
        } else {
            printAlignmentDebug({
                'name': args.name,'timeWindow': args.timeWindow,
                'currStartTime': currStartTime,'currEndTime': currEndTime,'currDataLength': args.currData.length,
                'newStartTime': newStartTime,'newEndTime': newEndTime,'newDataLength': args.newData.length
            });
            return false;
        }
    } else {
        console.warn("Data out of range: ", new Date(args.timeWindow.start), new Date(args.timeWindow.end));
        return false;
    }
}
