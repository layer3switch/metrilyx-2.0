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
        },
        authHeaders: function(username, password) {
        	return {'Authorization': 'Basic ' + btoa(username + ':' + password)}
        }
    };
}]);
metrilyxServices.factory('Metrics', ['$http', 'Auth', function($http, Auth) {
	var cache = {};

    return {
        suggest: function(query, callback) {
			var dfd = $.Deferred();
			if (query == "") {
			    dfd.resolve([]);
			} else if(cache[query] === undefined){
			    Auth.clearCredentials();
			    $http.get(connectionPool.nextConnection()+"/api/search/metrics?q="+query)
			    	.success(function(res){
						cache[query] = res;
						dfd.resolve(res);
					});
			} else {
				dfd.resolve(cache[query]);
			}
			dfd.done(callback);
		}
    };
}]);
metrilyxServices.factory('EventTypes', ['$resource',
	function($resource) {
		return $resource('/api/event_types/:eventType', {}, {
			listEvents: {
				method: 'GET',
				isArray: true
			},
			getEvent: {
				method: 'GET',
				params: {eventType: '@eventType'},
				isArray: false
			}
		});
	}
]);
metrilyxServices.factory('Model', ['$resource', 'Auth',
	function($resource, Auth) {
		return $resource('/api/graphmaps/:pageId', {}, {
			getModel: {
				method:'GET',
				params:{modelId:'@pageId'},
				isArray:false
			},
			listModels:{
				method:'GET',
				isArray:true
			},
			saveModel: {
				method:'POST',
				isArray:false,
				headers: Auth.authHeaders(AUTHCONFIG.modelstore.username,
											AUTHCONFIG.modelstore.password)
			},
			editModel: {
				method:'PUT',
				params:{pageId:'@pageId'},
				isArray:false,
				headers: Auth.authHeaders(AUTHCONFIG.modelstore.username,
											AUTHCONFIG.modelstore.password)
			},
			removeModel:{
				method:'DELETE',
				params:{pageId:'@pageId'},
				headers: Auth.authHeaders(AUTHCONFIG.modelstore.username,
											AUTHCONFIG.modelstore.password)
			}
		});
	}
]);
metrilyxServices.factory('Heatmap', ['$resource', 'Auth',
	function($resource, Auth) {
		return $resource('/api/heatmaps/:pageId', {}, {
			getModel: 	{
				method:'GET',
				params:{modelId:'@pageId'},
				isArray:false
			},
			editModel: 	{
				method:'PUT',
				params:{pageId:'@pageId'},
				isArray:false,
				headers: Auth.authHeaders(AUTHCONFIG.modelstore.username,
											AUTHCONFIG.modelstore.password)
			},
			removeModel:{
				method:'DELETE',
				params:{pageId:'@pageId'},
				headers: Auth.authHeaders(AUTHCONFIG.modelstore.username,
											AUTHCONFIG.modelstore.password)
			},
			saveModel: 	{
				method:'POST',
				isArray:false,
				headers: Auth.authHeaders(AUTHCONFIG.modelstore.username,
											AUTHCONFIG.modelstore.password)
			},
			listModels: {
				method:'GET',
				isArray:true
			},
		});
	}
]);
metrilyxServices.factory('Tags', ['$resource', 'Auth',
	function($resource, Auth) {
		Auth.clearCredentials();
		return $resource(connectionPool.nextConnection()+'/api/tags/:tagname', {}, {
			listTags: {
				method:'GET',
				isArray:true
			},
			listModelsByTag: {
				method:'GET',
				params: {tagname:'@tagname'},
				isArray:true
			},
		});
	}
]);

metrilyxServices.factory('EventTypes', ['$resource', 'Auth',
	function($resource, Auth) {
		Auth.clearCredentials();
		return $resource(connectionPool.nextConnection()+'/api/event_types/:eventType', {}, {
			listTypes: {
				method:'GET', 
				isArray:true
			}
		});
	}
]);

metrilyxServices.factory('Schema', ['$http', 'Auth',
	function($http, Auth) {
		var cache = {};

		return {
			get : function(params, cb){
				var dfd = $.Deferred();
				if (params.modelType === 'graph' || cache[params.modelType] === undefined){
					Auth.clearCredentials();
					$http.get(connectionPool.nextConnection()+'/api/schemas/' + params.modelType).success(function(res){
						if(params.modelType !== 'graph') {
							dfd.resolve(res)
						} else {						
							cache[params.modelType] = res;
							dfd.resolve($.extend(true, {}, res));
						}
					});
				} else {
					dfd.resolve($.extend(true, {}, cache[params.modelType]));
				}

				dfd.done(cb);
			}
		}
	}
]);

metrilyxServices.factory('Heat', [ '$http', function($http) {

	return {
		getData: function(query, callback) {
			var qstr = "";
			if(query.rate) {
				qstr += query.aggregator+":rate:"+query.metric;
			} else {
				qstr += query.aggregator+":"+query.metric;
			}
			qstr += "{";
			for(var k in query.tags) qstr += k + "=" + query.tags[k] + ",";
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
