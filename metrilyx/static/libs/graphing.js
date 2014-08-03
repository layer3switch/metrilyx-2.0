// TODO below here needs fixing //
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

function highchartsFormattedSerie(dataObj, dataQuery, graphType, paneIndex) {
    if(graphType === 'pie') {
        return {
            name: dataObj.alias,
            y: dataObj.dps[0][1],
            tags: dataObj.tags,
            query: dataQuery
        };
    } else {
        if(paneIndex) {
            return {
                yAxis: parseInt(paneIndex),
                lineWidth: 1,
                name: dataObj.alias,
                data: dataObj.dps,
                query: dataQuery,
                tags: dataObj.tags // for tracking uniqueness of series //
            };    
        } else {
            return {
                lineWidth: 1,
                name: dataObj.alias,
                data: dataObj.dps,
                query: dataQuery,
                tags: dataObj.tags // for tracking uniqueness of series //
            };
        }
    }
}
function onAnnotationClick(event) {
    var ead = $('#event-anno-details');
    scope = angular.element($(ead)).scope();
    if(scope) {
        scope.$apply(function(){
            scope.selectedAnno = {
                data: event.point.data,
                eventType: event.point.title,
                message: event.point.text,
                timestamp: event.point.x,
                color: event.point.series.color
            };
        });
        $(ead).addClass('open');
    } else {
        console.warning('Counld not get scope for #event-anno-details!');
    }
}

function MetrilyxGraph(graphObj, timeWin) {
    this.timeWindow = timeWin;
    this.graphdata = graphObj;
    this._chartElem = $("[data-graph-id='"+this.graphdata._id+"']");
}
MetrilyxGraph.prototype.newChart = function() {
    var copts = new ChartOptions(this.graphdata);
    if(dataHasErrors(this.graphdata)) {
        $(this._chartElem).html("");
        return;
    }
    
    if(this.graphdata.graphType == "pie") {
        $(this._chartElem).highcharts(copts.chartDefaultsForType());
    } else {
        //render_lineBasedNewGraph("[data-graph-id='"+this.graphdata._id+"']", copts.chartDefaultsForType());
        render_lineBasedNewGraph(this._chartElem, copts.chartDefaultsForType());
    }
}
MetrilyxGraph.prototype.applyData = function() {
    if($(this._chartElem).highcharts() === undefined) {
        this.newChart();
    } else {
        dhe = dataHasErrors(this.graphdata);
        if(dhe) return;
        $("[data-graph-status='"+this.graphdata._id+"']").html("");
        graphing_upsertSeries(this.graphdata, this.timeWindow);
    }
}
function MetrilyxAnnotation(obj) {
    this._data = obj;
    this._chartElem = $("[data-graph-id='"+this._data._id+"']");
    this._statusElem = $("[data-graph-status='"+this._data._id+"']");
}
MetrilyxAnnotation.prototype.appendData = function(chrt, serieIdx) {
    var ndata = [];
    for(var i in chrt.series[serieIdx].data) {
        try {
            if(chrt.series[serieIdx].data[i].x < this._data.annoEvents.data[0].x) {
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
    for(var i in this._data.annoEvents.data) {
        ndata.push(this._data.annoEvents.data[i]);
    }
    chrt.series[serieIdx].setData(ndata);
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
            for(var i in wchrt.series) {
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
        this._sfmt = new SeriesFormatter(this._graph.series);
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
                    title: {text: this._graph.panes[i]},
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
    for(var i in this.metSeries) {
        for(var d in this.metSeries[i].data) {
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
        for(var i in this.metSeries) {
            for(var d in this.metSeries[i].data) {
                out.push({
                    yAxis: parseInt(this.metSeries[i].paneIndex),
                    query: this.metSeries[i].query,
                    tags: this.metSeries[i].data[d].tags,
                    name: this.metSeries[i].data[d].alias,
                    data: this.metSeries[i].data[d].dps,
                    lineWidth: 1
                });
            }
        }
    } else {
        for(var i in this.metSeries) {
            for(var d in this.metSeries[i].data) {
                out.push({
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
    for(var i in this.metSeries) {
        for(var d in this.metSeries[i].data){
            dps = this.metSeries[i].data[d].dps;
            if(this.metSeries[i].data[d].dps.length <=0) {
                console.warn("(pie) No data for:", this.metSeries[i].alias);
            } else {
                pieData.push(highchartsFormattedSerie(
                    this.metSeries[i].data[d], this.metSeries[i].query, "pie"));
            }
        }
    }
    return [{ data: pieData, type: 'pie' }];
}
/* helper functions */
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
            if(result.multiPane) {
                hcg.addSeries(highchartsFormattedSerie(tr,result.series[0].query, null, result.series[0].paneIndex), false);
            } else {
                hcg.addSeries(highchartsFormattedSerie(tr,result.series[0].query), false);
            }
        }
    }
    if(redraw) hcg.redraw();
}

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
function dataHasErrors(gObj) {
    for(var s in gObj.series) {
        if(gObj.series[s].data.error !== undefined) {
            if(gObj.series[s].data.error.message) msg = gObj.series[s].data.error.message.substring(0,80)+"...";
            else msg = gObj.series[s].data.error.substring(0,50)+"...";
            console.warn(gObj.series[s].query.metric, msg);
            $("[data-graph-status='"+gObj._id+"']").html(
                "<span class='graph-error'>"+gObj.series[s].query.metric+": "+msg+"</span>");
            return { 
                "error": {
                    "message": msg,
                    "metric": gObj.series[s].query.metric
                }
            };
        }
    }
    return false;
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
function render_lineBasedNewGraph(selector, options) {
    Highcharts.setOptions({ global: { useUTC:false } });
    Highcharts.seriesTypes.line.prototype.drawPoints = (function 
    (func) {
        return function () {
            return false;
        };
    } (Highcharts.seriesTypes.line.prototype.drawPoints));
    $(selector).highcharts("StockChart", options);
}
function upsertPieSeries(args, hcg) {
    for(var j in args.series) {
        var found = false;
        for(var d in hcg.series[0].options.data) {
            if(equalObjects(args.series[j].data[0].tags, hcg.series[0].options.data[d].tags)&&args.series[j].data[0].alias==hcg.series[0].options.data[d].name) {
                found = true;        
                if(Object.prototype.toString.call(args.series[j].data) === '[object Object]') {
                    if(args.series[j].data.error) {
                        consol.warn("upsertPieSeries tsdb error:", (JSON.stringify(args.series[j].data.error)).substring(0,100));
                        break;
                    }
                }
                hcg.series[0].options.data.splice(d, 1, highchartsFormattedSerie(
                    args.series[j].data[0], hcg.series[0].options.data[d].query, "pie"));
                hcg.series[0].setData(hcg.series[0].options.data);
                break;
            }
        }
        if(!found) {
            hcg.series[0].addPoint(highchartsFormattedSerie(
                args.series[j].data[0], args.series[j].query, "pie"));
        }
    }
}
function upsertLineBasedSeries(args, hcg, timeWindow) {
    for(var j in args.series) {
        for(var d in args.series[j].data) {
            // find series in highcharts //
            var found = false;
            for(var i in hcg.series) {
                // may need to add globalTags as part of check //
                try {
                    if(equalObjects(args.series[j].query, hcg.series[i].options.query) && 
                            equalObjects(args.series[j].data[d].tags, hcg.series[i].options.tags)) {
                        
                        found = true;

                        if(Object.prototype.toString.call(args.series[j].data) === '[object Object]') {
                            if(args.series[j].data.error) {
                                console.warn("graphing_upsertSeries tsdb error:", 
                                    (JSON.stringify(args.series[j].data.error)).substring(0,100));
                                break;
                            }
                        }
                        var newData = false;
                        if(hcg.series[i].options.data.length <= 0) {
                            newData = args.series[j].data[d].dps;
                        } else {
                            newData = getDataAlignedSeriesForTimeWindow({
                                name: hcg.series[i].options.name,
                                currData: hcg.series[i].options.data,
                                newData:  args.series[j].data[d].dps,
                                timeWindow: timeWindow
                            });
                        }
                        if(newData != false) hcg.series[i].setData(newData, false, null, false);
                        break;
                    }
                } catch(e) {
                    console.log("upsertLineBasedSeries", args.series[j].query, e);
                }
            } // END hcg.series //
            
            if(!found) {
                if(args.multiPane) {
                    hcg.addSeries(highchartsFormattedSerie(args.series[0].data[d], 
                        args.series[0].query, args.graphType, args.series[0].paneIndex), false);
                } else {
                    hcg.addSeries(highchartsFormattedSerie(args.series[0].data[d], 
                        args.series[0].query, args.graphType), false);
                }
            }
        }
    }
}
/*
 * Add or update series with new data
 *  args:   Graph data
*/
function graphing_upsertSeries(data, timeWindow) {
    //console.log(args);
    var hcg = $("[data-graph-id='"+data._id+"']").highcharts();
    if(hcg === undefined) {
        console.log("graph uninitialized: not upserting. name", data.name, "type", data.graphType,"_id", data._id);
        return;
    }
    if(data.graphType === 'pie') {
        upsertPieSeries(data, hcg);
    } else {
        upsertLineBasedSeries(data,hcg,timeWindow);
    }
    hcg.redraw();
}
// params: name , currData, newData, timeWindow //
function getDataAlignedSeriesForTimeWindow(args) {
    if(args.newData.length <= 0) return false;

    newStartTime = args.newData[0][0];
    newEndTime = args.newData[args.newData.length-1][0];

    currStartTime = args.currData[0][0];
    currEndTime = args.currData[args.currData.length-1][0];

    // no new data //
    if(newEndTime <= currEndTime) return false;
    // check time window //
    if((newStartTime >= args.timeWindow.start) && (newStartTime < args.timeWindow.end)) {
        if((newStartTime<currStartTime) && (newEndTime>currStartTime)) {
            console.log(args.name, "TBI");
            console.log("curr data:",new Date(currStartTime),new Date(currEndTime), "dps", args.currData.length);
            console.log("new  data:", new Date(newStartTime),new Date(newEndTime), "dps", args.newData.length);
            console.log("window",new Date(args.timeWindow.start), new Date(args.timeWindow.end));
            return false;
        } else if((newStartTime>=currStartTime) &&(newEndTime>currEndTime)) {
            while(args.currData[args.currData.length-1][0] >= newStartTime) {
                c = args.currData.pop();
            }
            while(args.currData.length > 0 && args.currData[0][0] < args.timeWindow.start) {
                c = args.currData.shift();
            }
            return args.currData.concat(args.newData);
        } else {
            console.log(args.name, "unhandled");
            console.log("window",new Date(args.timeWindow.start), new Date(args.timeWindow.end));
            console.log("curr data:",new Date(currStartTime),new Date(currEndTime), "dps", args.currData.length);
            console.log("new  data:", new Date(newStartTime),new Date(newEndTime), "dps", args.newData.length);
            return false;
        }
    } else {
        console.log(args.name, "data out of range",new Date(args.timeWindow.start), new Date(args.timeWindow.end));
        return false;
    }
}
/*
function getNewDataAlignedSeries(args) {
//function getNewDataAlignedSeries(dataName, currData, newData) {
    if(args.newData.length <= 0) return false;
    //if(!currData) return newData;
    newStartTime = args.newData[0][0];
    newEndTime = args.newData[args.newData.length-1][0];
    //newStartTime = args.timeWindow['start'];
    //newEndTime = args.timeWindow.end;


    currStartTime = args.currData[0][0];
    currEndTime = args.currData[args.currData.length-1][0];

    if(newEndTime < currEndTime) return false;
    if((newStartTime > currStartTime) && (newStartTime < currEndTime)) {
        var timeAdded = newEndTime - currEndTime;
        //console.log("Time added:", timeAdded)
        var shiftedStartTime = currStartTime + timeAdded;
        // remove overlapping old data //
        while(args.currData[args.currData.length-1][0] >= newStartTime) {
            c = args.currData.pop();
        }
        // shift data from front per window //
        // removes same amount of old data as is new data added //
        while(args.currData.length > 0 && args.currData[0][0] < shiftedStartTime) {
            c = args.currData.shift();
        }
        return args.currData.concat(args.newData);
    } else {
        console.log(args.name, "out of range");
        console.log("curr data:",new Date(currStartTime),new Date(currEndTime), "dps", args.currData.length);
        console.log("new  data:", new Date(newStartTime),new Date(newEndTime), "dps", args.newData.length);
        console.log("window",new Date(args.timeWindow.start), new Date(args.timeWindow.end));
        return false;
    }
}
*/
