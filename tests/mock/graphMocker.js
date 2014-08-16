var GraphMocker = (function() {
  function mockSerieData(name, status, data) {
    data = data || {error : false};

    return {
      "alias": name,
      "yTransform": "",
      "query": {
        "aggregator": "sum",
        "rate": false,
        "metric": name + "_metric",
        "tags": {}
      },
      "status": status,
      "data" : data
    }
  };

  function mockGraph(graphs) {
    var commonMock = {
      "multiPane": false,
      "panes": ["", ""],
      "name": "",
      "thresholds": {
        "danger": {
          "max": "",
          "min": ""
        },
        "warning": {
          "max": "",
          "min": ""
        },
        "info": {
          "max": "",
          "min": ""
        }
      },
      "annoEvents": {
        "eventTypes": [],
        "tags": {}
      },
      "graphType": "line",
      "_id": "cdf5bdb1ca9b4990aca4fb139f30471f",
      "size": "large",
      "$promise": {},
      "$resolved": true
    }

    var series = [];
    angular.forEach(graphs, function(g) {
      if (g.alias !== undefined)
        series.push(mockSerieData(g.alias, g.status, g.data));
      else
        series.push(mockSerieData(g, 'loading'));
    });


    return $.extend(commonMock, {
      series: series
    });
  }


  //public definition
  return {
    mockGraph: mockGraph,
    mockSeries: mockSerieData
  }
})();
