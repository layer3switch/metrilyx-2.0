 /* services.js */
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
           	//console.info("Next URL:", connectionPool.nextConnection());
			if(query == "") {
				callback([]);  
			} else {
           		$http.get("/api/search?type=metrics&q="+query).success(callback);
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
		return $resource('/api/page/:pageId', {}, {
			get: {method:'GET', params:{modelId:'@pageId'}, isArray:false},
			listModels:{method:'GET', isArray:true},
			saveModel: {method:'POST', isArray:false},
			editModel: {method:'PUT', isArray:false},
			removeModel:{method:'DELETE', params:{pageId:'@pageId'} }
		});														 
	}
]);
metrilyxServices.factory('Heatmap', ['$resource',
	function($resource) {
		//Auth.setCredentials(config.modelstore.username, config.modelstore.password);
		return $resource('/api/heatmap/:pageId', {}, {
			get: {method:'GET', params:{modelId:'@pageId'}, isArray:false},
			listModels:{method:'GET', isArray:true},
			saveModel: {method:'POST', isArray:false},
			editModel: {method:'PUT', isArray:false},
			removeModel:{method:'DELETE', params:{pageId:'@pageId'} }
		});														 
	}
]);

metrilyxServices.factory('Schema', ['$resource', 'Auth',
	function($resource, Auth) {
		//Auth.setCredentials(config.modelstore.username, config.modelstore.password);
		//var poolUrl = connectionPool.nextConnection();
		return $resource(connectionPool.nextConnection()+'/api/schema/:modelType', {}, {
			get: {method:'GET', params:{modelType:'@modelType'}, isArray:false}										 
		});
	}
]);

metrilyxServices.factory('Graph', [ '$http','Auth', function($http, Auth) {
	return {
		getData: function(query, callback) {
			//Auth.setCredentials(config.modelstore.username, config.modelstore.password);
			// TODO: enable once CORS issue is resolved //
			//var poolUrl = connectionPool.nextConnection();
			var poolUrl = "";
			$http({
				method: 'POST',
				url: poolUrl+'/api/graph',
				headers: {'Content-type': 'application/json'},
				data: query
			}).success(function(result) {
				if(callback) callback(result);
			}).error(function(data, status, arg1, arg2) {
				console.log(data);
				console.log(status);
				console.log(arg1);
				console.log(arg2);
			});
		},
		get: function(query, callback) {
			$http({
				method: 'GET',
				url: connectionPool.nextConnection()+'/api/graph/'+JSON.stringify(query),
			}).success(function(result) {
				if(callback) callback(result);
			}).error(function(xhr, data, text1, text2) {
				console.log(text1, text2);
			});
		}
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

			//console.info("Next URL:", connectionPool.nextConnection());
			$http({
				method: 'GET',
				url: connectionPool.nextConnection()+'/api/heat/'+qstr,
				headers: { 'Content-type': 'application/json' }
			}).
			success(function(result) {
				callback(result);
			}).
			error(function(data, status, arg1, arg2) {
				console.log(status);
				console.log(arg2);
			});
		},
	};
}]);
