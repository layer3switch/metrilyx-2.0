 /* services.js */
function AsyncGraphQuery(data) {
	this.data = data;
}
AsyncGraphQuery.prototype.httpGetParams = function(url) {
	var paramsStr = "";
	for(var k in this.data) {
		switch(k) {
			case "series":
				break;
			case "tags":
				break;
			case "thresholds":
				if(this.data[k] !== undefined) paramsStr += "thresholds="+this.data[k].danger+":"+this.data[k].warning+":"+this.data[k].info+"&";
				break;
			default:
				paramsStr += k+"="+this.data[k]+"&";
				break;
		}
	}
	paramsStr = paramsStr.replace(/&$/, "");

	for(var i in this.data.series) {
		var serie = this.data.series[i];
		var serieStr = '&serie=';
		if(serie.query.rate) {
			serieStr += serie.query.aggregator + ':rate:';
		} else {
			serieStr += serie.query.aggregator + ':';
		}
		serieStr += serie.query.metric + '{';
		for(var k in serie.query.tags) {
			serieStr += k + ':' + serie.query.tags[k] + ',';
		}
		for(var gt in this.data.tags) {
			serieStr += gt + ':' + this.data.tags[gt] + ',';	
		}
		serieStr = serieStr.replace(/,$/, "");
		serieStr += '}{alias:' + serie.alias + ',yTransform:' + serie.yTransform + '}';
		paramsStr += serieStr;
	}
	if(url) {
		return url + paramsStr;
	} else {
		return paramsStr;	
	}
};
function ConnectionPool(urls) {
	this.counter = 0;
	this.urls = urls;
}
ConnectionPool.prototype.nextConnection = function() {
	if(this.urls.length < 1) return "";
	idx = this.counter % this.urls.length;
	this.counter++;
	return this.urls[idx];
}
var connectionPool = new ConnectionPool(CONN_POOL_CFG.urls);
var asyncConnPool = new ConnectionPool(CONN_POOL_CFG.async_urls);

var metrilyxServices = angular.module('metrilyxServices', ['ngResource']);
metrilyxServices.factory('Auth', ['$http', function ($http) {
    return {
        setCredentials: function (username, password) {
            $http.defaults.headers.common.Authorization = 'Basic ' + btoa(username + ':' + password);
        },
        clearCredentials: function () {
            delete $http.defaults.headers.common.Authorization;
        }
    };
}]);
/* $http call as angular doesn't like arrays of strings */
metrilyxServices.factory('Metrics', ['$http', 'Auth', function($http, Auth) {
    return {
        suggest: function(query, callback) {
           	//Auth.clearCredentials();
			if(query == "") {
				callback([]);  
			} else {
           		$http.get("/api/search/metrics?q="+query).success(callback);
			}
        },
		getByAlphabet: function(alpha, callback) {
			 if(alpha == "") {
				 callback([]);
			 } else {
				 //Auth.clearCredentials();
				 $http.get("/api/search?type=metrics&q="+alpha.toLowerCase()).
               		success(function(result){
						 callback(result);
					});
			 }
		 }
    };
}]);
metrilyxServices.factory('Model', ['$resource', 'Auth',
	function($resource, Auth) {
		//Auth.setCredentials(config.modelstore.username, config.modelstore.password);
		return $resource('/api/graphmaps/:pageId', {}, {
			getModel: {method:'GET', params:{modelId:'@pageId'}, isArray:false},
			listModels:{method:'GET', isArray:true},
			saveModel: {method:'POST', isArray:false},
			editModel: {method:'PUT', params:{pageId:'@pageId'}, isArray:false},
			removeModel:{method:'DELETE', params:{pageId:'@pageId'} }
		});														 
	}
]);
metrilyxServices.factory('Heatmap', ['$resource',
	function($resource) {
		//Auth.setCredentials(config.modelstore.username, config.modelstore.password);
		return $resource('/api/heatmaps/:pageId', {}, {
			getModel: 	{method:'GET',params:{modelId:'@pageId'},isArray:false},
			editModel: 	{method:'PUT',params:{pageId:'@pageId'},isArray:false},
			removeModel:{method:'DELETE',params:{pageId:'@pageId'}},
			saveModel: 	{method:'POST',isArray:false},
			listModels: {method:'GET',isArray:true},
		});														 
	}
]);
metrilyxServices.factory('Tags', ['$resource', 
	function($resource) {
		return $resource('/api/tags/:tagname', {}, {
			listTags: {method:'GET', isArray:true},
			listModelsByTag: {method:'GET', params: {tagname:'@tagname'},isArray:true},
		});
	}
]);
metrilyxServices.factory('Schema', ['$resource', 'Auth',
	function($resource, Auth) {
		//Auth.setCredentials(config.modelstore.username, config.modelstore.password);
		return $resource(connectionPool.nextConnection()+'/api/schemas/:modelType', {}, {
			get: {method:'GET', params:{modelType:'@modelType'}, isArray:false}										 
		});
	}
]);

metrilyxServices.factory('Graph', [ '$http','Auth', function($http, Auth) {
	return {
		getData: function(query, callback) {	
			//Auth.setCredentials(config.modelstore.username,config.modelstore.password);
			var poolUrl = "";
			$http({
				method: 'POST',
				url: poolUrl+'/api/graph',
				headers: {'Content-type': 'application/json'},
				data: query
			}).success(function(result) {
				if(callback) callback(result);
			}).error(function(data, status, arg1, arg2) {
				console.log(data,status,arg1,arg2);
			});
		}, 
		/*
		// async call - v2.1
		getData: function(query, callback) {
			var async_q = new AsyncGraphQuery(query);
			$http({
				method: 'GET',
				url: asyncConnPool.nextConnection()+'/api/graph?'+async_q.httpGetParams(),
			}).success(function(result) {
				if(callback) callback(result);
			}).error(function(xhr, data, text1, text2) {
				console.error(text1, text2);
			});
		}*/
	};
}]);

metrilyxServices.factory('Heat', [ '$http',function($http) {
	return {
		getData: function(query, callback) {
			//Auth.setCredentials(config.modelstore.username, config.modelstore.password);
			var qstr = "";
			if(query.rate) {
				qstr += query.aggregator+":rate:"+query.metric;
			} else {
				qstr += query.aggregator+":"+query.metric;
			}
			qstr += "{";		
			for(var k in query.tags) {
				qstr += k + "=" + query.tags[k] + ",";
			}
			qstr = qstr.replace(/\,$/,'}');

			$http({
				method: 'GET',
				url: connectionPool.nextConnection()+'/api/heat/'+qstr,
				headers: { 'Content-type': 'application/json' }
			}).
			success(function(result) {
				callback(result);
			}).
			error(function(data, status, arg1, arg2) {
				console.error(status);
				console.error(arg2);
			});
		},
	};
}]);
