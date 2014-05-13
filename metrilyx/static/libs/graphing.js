function MetrilyxGraph(graphObj, timeWin) {
    this.start = timeWin.start;
    this.end = timeWin.end;
    this.graphdata = graphObj;
    this.uigraph = $("[data-graph-id='"+this.graphdata._id+"']").highcharts();
}
MetrilyxGraph.prototype.applyData = function() {
    if(this.uigraph === undefined) {
        graphing_newGraph(this.graphdata);
    } else {
        renderGraph(this.graphdata);
    }
}
/*
 * Preps data from server (metrilyx graph objects) for highcharts
 */
function ChartOptions(metGraphObj) {
    this._graph = metGraphObj;
    //console.log(this._graph.series);
    this._sfmt = new SeriesFormatter(this._graph.series);
}
ChartOptions.prototype.chartDefaults = function() {
    return {
        chart: {
            borderRadius: 0,
            borderWidth: 0,
            spacingLeft: 5,
            spacingRight: 5,
            spacingTop: 5,
            spacingBottom: 5
        },
        yAxis: {
            startOnTick: false,
            minPadding: 0.03
        },        
        title: {
            text: ''
        },
        legend: {
            enabled: false
        },
        credits: {
            enabled: false
        }
    };
}
ChartOptions.prototype.pieChartDefaults = function() {
    opts = this.chartDefaults();
    $.extend(opts, {
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
            pointFormat: '<b>{point.y}</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.percentage:.1f} %'
                    /*format: "<b>{point.value}</b>"*/
                }
            }
        }
    }, true);
    opts.series = this._sfmt.pieSeries();
    return opts;
}
/*
    Determine if plot bands are applicable.
    Return:
        yAxis highcharts config.
*/
ChartOptions.prototype.__plotBands = function() {
    if(this._graph.thresholds) {
        return getPlotBands(this._graph.thresholds);
    }
    return {
        gridLineWidth: 1,
        gridLineColor: "#ccc",
        minPadding: 0.03,
        startOnTick: false,
    };
}
ChartOptions.prototype.lineChartDefaults = function(extraOpts) {
    opts = this.chartDefaults();
    $.extend(opts, {
        chart: {
            spacingTop: 0,
            zoomType: 'xy',
            borderRadius: 0,
            borderWidth: 0,
            spacingLeft: 5,
            spacingRight: 5,
            spacingBottom: 5,
        },
        legend: {
            enabled: true,
            align: 'center',
            verticalAlign: 'bottom',
            borderWidth: 0,
            itemStyle: {
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: "normal",
            },
            maxHeight: 40,
            navigation: {
                arrowSize: 9,
                style: {
                    fontSize: "10px",
                    fontWeight: "normal"
                }
            },
        },
        tooltip: {
            crosshairs: [true,true],
            valueDecimals: 2,
            shadow: false,
            animation: false
        },
        scrollbar: {
            enabled: false
        },
        plotOptions: {
            series: {
                marker: {
                    enabled: true
                }
            }
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
        xAxis: {
            gridLineWidth: 1,
            gridLineColor: "#ccc",
        }
    }, extraOpts, true);
    opts.yAxis = this.__plotBands();
    opts.series = this._sfmt.lineSeries();
    return opts;
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
                /* 
                 * Use the first datapoint rather than last as 
                 * the tail end of tsd data is inaccurate.
                 * i.e dps[0][1]
                 */
               // pieData.push([ this.metSeries[i].data[d].alias, dps[0][1] ]);
               pieData.push({name:this.metSeries[i].data[d].alias, y:dps[0][1]});
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
        if(!found) {
            s = highchartsSeries(tr);
            s.query = result.series[0].query;
            hcg.addSeries(s, false);
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
    return  {
        gridLineWidth: 1,
        gridLineColor: "#ccc",
        minPadding: 0.03,
        startOnTick: false,
        plotBands: [
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
    };
}

// TODO below here needs fixing //
function highchartsSeries(dataObj) {
    return {
        lineWidth: 1,
        name: dataObj.alias,
        data: dataObj.dps,
        tags: dataObj.tags // for tracking uniqueness of series //
    };
}
/* use alias as name */
function formatDataHighcharts(graphSeries) {
    out = [];
    for(var i in graphSeries) {
        for(var d in graphSeries[i].data) {
            hsd = highchartsSeries(graphSeries[i].data[d]);
            hsd.query = graphSeries[i].query;
            out.push(hsd);
        }
    }
    //console.log(out);
    return out;
}
function dataHasErrors(gObj) {
    for(var s in gObj.series) {
        if(gObj.series[s].data.error !== undefined) {
            console.log(gObj.series[s].data.error);
            if(gObj.series[s].data.error.message) msg = gObj.series[s].data.error.message.substring(0,50)+"...";
            else msg = gObj.series[s].data.error.substring(0,50)+"...";
            
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
    //console.log(graph.graphType,":",graph._id);
    var renderTo = "[data-graph-id='"+graph._id+"']"; 
    // check data
    dhe = dataHasErrors(graph);
    if(dhe) {
        $(renderTo).html("<span class='graph-error'><b>"+dhe.error.metric+": </b>"+dhe.error.message+"</span>");
        console.log("error:", dhe.error);
        return;
    }
    var copts = new ChartOptions(graph);
    
    if(graph.graphType == "pie") {
        var opts = copts.pieChartDefaults();
        //if(opts.series.)
        $(renderTo).highcharts(opts);
    } else {
        var opts = copts.lineChartDefaults();
        Highcharts.setOptions({ global: { useUTC:false } });
        Highcharts.seriesTypes.line.prototype.drawPoints = (function 
        (func) {
            return function () {
                return false;
            };
        } (Highcharts.seriesTypes.line.prototype.drawPoints));
        $(renderTo).highcharts("StockChart",opts);
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
                if(equalObjects(args.series[j].data[0].tags, hcg.series[0].options.tags)&&args.series[j].data[0].alias==hcg.series[0].options.data[d].name) {
                    found = true;        
                    if(Object.prototype.toString.call(args.series[j].data) === '[object Object]') {
                        if(args.series[j].data.error) {
                            console.warn("graphing_upsertSeries tsdb error:", args.series[j].data.error.message.substring(0,100));
                            break;
                        }
                    }
                    hcg.series[0].options.data.splice(d,1,{
                        name: args.series[j].data[0].alias, 
                        y: args.series[j].data[0].dps[0][1]
                    });
                    hcg.series[0].setData(hcg.series[0].options.data);
                    break;
                }
            }
            if(!found) {
                hcg.series[0].addPoint({
                    name: args.series[j].data[0].alias, 
                    y:args.series[j].data[0].dps[0][1]
                });
            }
        }
        hcg.redraw();
        return;
    }
    // line graph//
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
                                console.warn("graphing_upsertSeries tsdb error:", args.series[j].data.error.message.substring(0,100));
                                break;
                            }
                        }
                        var newData = false;
                        if(hcg.series[i].options.data.length <= 0) {
                            newData = args.series[j].data[d].dps;
                        } else {
                            newData = getNewDataAlignedSeries(hcg.series[i].options.name, 
                                    hcg.series[i].options.data, args.series[j].data[d].dps);                   
                        }
                        if(newData != false) hcg.series[i].setData(newData, false, null, false);
                        break;
                    }
                } // END hcg.series //
            } catch(e) {
                console.log(args.series[j].query);
                console.log(e)
            }
            if(!found) {
                hsd = highchartsSeries(args.series[0].data[d]);
                hsd.query = args.series[0].query;
                hcg.addSeries(hsd, false);
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
    //if(graphObj.graphType == 'pie') {
        //console.log("creating new pie graph:", graphObj._id);
    //    graphing_newGraph(graphObj);
    //} else {
        graphing_upsertSeries(graphObj);
   // }
}

