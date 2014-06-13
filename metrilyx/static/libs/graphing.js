// TODO below here needs fixing //
var DEFAULT_CHART_OPTS = {
    AXIS:{
        gridLineWidth: 1,
        gridLineColor: "#ddd",
        minorGridLineColor: '#f8f8f8',
        minorTickInterval: 'auto',
        startOnTick: false,
    },
    PLOT_TEXT_COLOR: '#666',
    BASIC: {
        colors: [
            '#7cb5ec','#90ed7d','#f7a35c',
            '#f15c80','#91e8e1','#8085e9', 
            '#e4d354','#8085e8','#4CE078','#FF8BF2'],
        chart: {
            borderRadius: 0,
            borderWidth: 0,
            spacingLeft: 5,
            spacingRight: 5,
            spacingTop: 5,
            spacingBottom: 5
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
                    format: '<b>{point.name}</b>: {point.percentage:.1f} %'
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
        legend: {enabled: false},
        credits: {enabled: false}
    }
};
$.extend(DEFAULT_CHART_OPTS.BASIC, {xAxis: DEFAULT_CHART_OPTS.AXIS}, true);
$.extend(DEFAULT_CHART_OPTS.BASIC.xAxis, {opposite:true}, true);

function highchartsSeries(dataObj, dataQuery, graphType) {
    if(graphType === 'pie') {
        return {
            name: dataObj.alias,
            y: dataObj.dps[0][1],
            tags: dataObj.tags,
            query: dataQuery
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

function MetrilyxGraph(graphObj, timeWin) {
    this.start = timeWin.start;
    this.end = timeWin.end;
    this.graphdata = graphObj;
    this.uigraph = $("[data-graph-id='"+this.graphdata._id+"']").highcharts();
}
MetrilyxGraph.prototype.newChart = function() {
    graphing_newGraph(this.graphdata);
}
MetrilyxGraph.prototype.applyData = function() {
    if(this.uigraph === undefined) {
        this.newChart();
    } else {
        renderGraph(this.graphdata);
    }
}
function MetrilyxAnnotation(obj) {
    this._data = obj;
}
MetrilyxAnnotation.prototype.appendData = function(chrt, serieIdx) {
    var ndata = [];
    for(var i in chrt.series[serieIdx].data) {
        if(chrt.series[serieIdx].data[i].x < this._data.annoEvents.data[0].x) {
            ndata.push({
                x: chrt.series[serieIdx].data[i].x,
                title: chrt.series[serieIdx].data[i].title,
                text: chrt.series[serieIdx].data[i].text
            });
        }
        break;
    }
    for(var i in this._data.annoEvents.data) {
        ndata.push(this._data.annoEvents.data[i]);
    }
    chrt.series[serieIdx].setData(ndata);
}
MetrilyxAnnotation.prototype.newChart = function() {
    var copts = new ChartOptions(this._data,true);
    Highcharts.setOptions({ global: { useUTC:false } });
    Highcharts.seriesTypes.line.prototype.drawPoints = (function 
    (func) {
        return function () {
            return false;
        };
    } (Highcharts.seriesTypes.line.prototype.drawPoints));
    $("[data-graph-id='"+this._data._id+"']").highcharts("StockChart", 
                                            copts.chartDefaultsForType());
}
MetrilyxAnnotation.prototype.applyData = function() {
    var chrt = $("[data-graph-id='"+this._data._id+"']").highcharts();
    if(chrt === undefined) {
        this.newChart();
    } else {   
        var idx = -1;
        var flagIdx = [];
        for(var i in chrt.series) {
            if(chrt.series[i].type === 'flags') {
                flagIdx.push(i);
                if(chrt.series[i].name === this._data.annoEvents.eventType) {
                    //console.log(this._data.annoEvents.annoType);
                    idx = i;
                    break;
                }
            }
        }
        if(idx < 0) {
            var sf = new SeriesFormatter(this._data.annoEvents.data);
            chrt.addSeries(sf.flagsSeries(this._data.annoEvents.eventType));
            //console.log(this._data._id, this._data.annoEvents.eventType);
        } else {
            this.appendData(chrt, idx);
        }
    }
}

/*
 * Preps data from server (metrilyx graph objects) for highcharts
 */
function ChartOptions(metGraphObj,flagSeries) {
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
    return DEFAULT_CHART_OPTS.BASIC;
}
ChartOptions.prototype.pieChartDefaults = function(extraOpts) {
    var settings = $.extend(this.chartDefaults(), {
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false,
            borderRadius: 0,
            borderWidth: 0,
            spacingTop: 5,
            spacingLeft: 5,
            spacingRight: 5,
            spacingBottom: 5
        },
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
                color: '{series.color}',
                fontSize: '11px'
            }
        },
        series: this._sfmt.pieSeries()
    }, extraOpts);
    return settings;
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
    return DEFAULT_CHART_OPTS.AXIS;
};
ChartOptions.prototype.lineChartDefaults = function(extraOpts) {
    var opts = this.chartDefaults();
    $.extend(opts, {
        chart: {
            spacingTop: 20,
            spacingBottom: 5,
            zoomType: 'xy',
            borderRadius: 0,
            borderWidth: 0,
            spacingLeft: 5,
            spacingRight: 5,
        },
        legend: {
            enabled: true,
            align: 'center',
            verticalAlign: 'bottom',
            borderWidth: 0,
            itemDistance: 10,
            itemMarginTop:1,
            itemMarginBottom:1,
            itemStyle: {
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: "normal",
                color: DEFAULT_CHART_OPTS.PLOT_TEXT_COLOR
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
                    var s = '<div class="chart-tooltip"><small style="color:#ddd">'+ (new Date(this.x)).toLocaleString() +'</small>';
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
        },
        xAxis:DEFAULT_CHART_OPTS.AXIS
    }, extraOpts, true);
    opts.yAxis = this.__plotBands();
    if(this.flagSeries) {
        $.extend(opts,{'series':this._sfmt.flagsSeries()},true);
    } else {
        $.extend(opts,{'series':this._sfmt.lineSeries()},true);
    }
    return opts;
}
ChartOptions.prototype.areaChartDefaults = function(extraOpts) {
    var opts = this.lineChartDefaults(extraOpts);
    $.extend(opts.chart, {'type': 'area'}, true);
    if(opts.plotOptions.area.stacking) delete opts.plotOptions.area.stacking;
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
            //console.log(this.metSeries[i].data[d].tags);
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
SeriesFormatter.prototype.flagsSeries = function(annoName) {
    return {
        name: annoName,
        type:'flags',
        data: this.metSeries,
        shape: 'squarepin',
        index: 0,
        style: {
            color: DEFAULT_CHART_OPTS.PLOT_TEXT_COLOR,
        },
        y: -48,
        stackDistance: 20,
        states : {hover : {fillColor: '#ddd'}}
    };
}
SeriesFormatter.prototype.lineSeries = function() {
    out = [];
    for(var i in this.metSeries) {
        for(var d in this.metSeries[i].data) {
            out.push({
                query: this.metSeries[i].query,
                tags: this.metSeries[i].data[d].tags,
                name: this.metSeries[i].data[d].alias,
                data: this.metSeries[i].data[d].dps,
                lineWidth: 1 /* highcharts specific */
            });
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
                pieData.push(highchartsSeries(
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
        if(remove) {
            //console.log("removing series:", hcg.series[h].name);
            hcg.series[h].remove(true);
        }
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
        // if tags change more series can be return
        // upsert if this is the case
        if(!found) hcg.addSeries(highchartsSeries(tr,result.series[0].query), false);
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
    if(keyCount(obj1) != keyCount(obj2)) return false;
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
                from: thresholds['info'],
                to: thresholds['warning'],
                color: "rgba(99,177,211,0.3)"
            },{
                from: thresholds['warning'],
                to: thresholds['danger'],
                color:"rgba(224,158,73,0.3)"
            },{
                from: thresholds['danger'],
                to: thresholds['danger']+1000,
                color: "rgba(187,74,71,0.3)"
            }
        ]
        }, true);
    return out;
}
function dataHasErrors(gObj) {
    for(var s in gObj.series) {
        if(gObj.series[s].data.error !== undefined) {
            //console.log(gObj.series[s].data.error);
            if(gObj.series[s].data.error.message) msg = gObj.series[s].data.error.message.substring(0,50)+"...";
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
    //hc.showLoading();
    hc = $(renderTo).highcharts();
    if(hc == undefined) {
        console.log("chart undefined", graph._id);
        return;
    }
    hc.options.yAxis = getPlotBands(graph.thresholds);
    $(renderTo).highcharts("StockChart",hc.options);  
}
/*
 * @params
 *      complete graph object
 */
function graphing_newGraph(graph) {
    // check data
    if(dataHasErrors(graph)) return;
    var renderTo = "[data-graph-id='"+graph._id+"']"; 
    
    var copts = new ChartOptions(graph);
    if(graph.graphType == "pie") {
        $(renderTo).highcharts(copts.chartDefaultsForType());
    } else {
        Highcharts.setOptions({ global: { useUTC:false } });
        Highcharts.seriesTypes.line.prototype.drawPoints = (function 
        (func) {
            return function () {
                return false;
            };
        } (Highcharts.seriesTypes.line.prototype.drawPoints));
        $(renderTo).highcharts("StockChart", copts.chartDefaultsForType());
    }
}
/*
 * Add or update series with new data
 *  args:   Graph data
*/
function graphing_upsertSeries(args) {
    //console.log(args);
    var hcg = $("[data-graph-id='"+args._id+"']").highcharts();
    if(hcg == undefined) {
        console.log("graph uninitialized: not upserting. name", args.name, "type", args.graphType,"_id", args._id);
        return;
    }
    if(args.graphType === 'pie') {
        for(var j in args.series) {
            var found = false;
            for(var d in hcg.series[0].options.data) {
                if(equalObjects(args.series[j].data[0].tags, hcg.series[0].options.data[d].tags)&&args.series[j].data[0].alias==hcg.series[0].options.data[d].name) {
                    found = true;        
                    if(Object.prototype.toString.call(args.series[j].data) === '[object Object]') {
                        if(args.series[j].data.error) {
                            consol.warn("graphing_upsertSeries tsdb error:", (JSON.stringify(args.series[j].data.error)).substring(0,100));
                            //console.warn("graphing_upsertSeries tsdb error:", args.series[j].data.error.message.substring(0,100));
                            break;
                        }
                    }
                    hcg.series[0].options.data.splice(d, 1,
                        highchartsSeries(args.series[j].data[0], hcg.series[0].options.data[d].query, "pie"));
                    hcg.series[0].setData(hcg.series[0].options.data);
                    break;
                }
            }
            if(!found) {
                hcg.series[0].addPoint(
                    highchartsSeries(args.series[j].data[0], args.series[j].query, "pie"));
            }
        }
        hcg.redraw();
        return;
    } // END graphType == 'pie' //
    // BEGIN line graph//
    for(var j in args.series) {
        for(var d in args.series[j].data) {
            // find series in highcharts //
            var found = false;
            try {
                for(var i in hcg.series) {
                    // series found //
                    if(equalObjects(args.series[j].query, hcg.series[i].options.query) && equalObjects(args.series[j].data[d].tags, hcg.series[i].options.tags)) {
                        found = true;
                        if(Object.prototype.toString.call(args.series[j].data) === '[object Object]') {
                            if(args.series[j].data.error) {
                                consol.warn("graphing_upsertSeries tsdb error:", (JSON.stringify(args.series[j].data.error)).substring(0,100));
                                //console.warn("graphing_upsertSeries tsdb error:", args.series[j].data.error.message.substring(0,100));
                                break;
                            }
                        }
                        var newData = false;
                        if(hcg.series[i].options.data.length <= 0) {
                            newData = args.series[j].data[d].dps;
                        } else {
                            // name , currData, newData //
                            newData = getNewDataAlignedSeries(hcg.series[i].options.name, 
                                    hcg.series[i].options.data, args.series[j].data[d].dps);                   
                        }
                        if(newData != false){ 
                            hcg.series[i].setData(newData, false, null, false);
                        } else {
                            console.log(args.start, args.end);
                        }
                        break;
                    }
                } // END hcg.series //
            } catch(e) {
                console.log("graphing_upsertSeries", args.series[j].query, e);
            }
            if(!found) {
                hcg.addSeries(
                    highchartsSeries(args.series[0].data[d], args.series[0].query), false);
            }
        }
        hcg.redraw();
    }
}
function getNewDataAlignedSeries(dataName, currData, newData) {
    if(newData.length <= 0) return false;
    //if(!currData) return newData;
    newStartTime = newData[0][0];
    newEndTime = newData[newData.length-1][0];
    
    currStartTime = currData[0][0];
    currEndTime = currData[currData.length-1][0];

    if(newEndTime < currEndTime) return false;
    if((newStartTime > currStartTime) && (newStartTime < currEndTime)) {
        var timeAdded = newEndTime - currEndTime;
        //console.log("Time added:", timeAdded)
        var shiftedStartTime = currStartTime + timeAdded;
        // remove overlapping old data //
        while(currData[currData.length-1][0] >= newStartTime) {
            c = currData.pop();
        }
        // shift data from front per window //
        // removes same amount of old data as is new data added //
        while(currData.length > 0 && currData[0][0] < shiftedStartTime) {
            c = currData.shift();
        }
        return currData.concat(newData);
    } else {
        console.log(dataName, "out of range");
        console.log("curr data:",new Date(currStartTime),new Date(currEndTime));
        console.log("new  data:", new Date(newStartTime),new Date(newEndTime), "dps", newData.length);
        return false;
    }
}
/*
    Args:
        graphObj: graph metadata along with series data.  can be a partial graph
*/
function renderGraph(graphObj) {
    dhe = dataHasErrors(graphObj);
    if(dhe) return;
    $("[data-graph-status='"+graphObj._id+"']").html("");
    graphing_upsertSeries(graphObj);
}

