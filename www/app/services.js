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

angular.module('metrilyxServices', ['ngResource'])
.factory('Auth', ['$http', function ($http) {
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
}])
.factory('Metrics', ['$http', 'Auth', 'Configuration', function($http, Auth, Configuration) {
	/*
	var queryURL = "";
	Configuration.getConfig(function(config) {
		queryURL = config.metric_search.uri + "/metrics?q=";
	});
 	*/
	var cache = {};

    return {
        suggest: function(query, callback) {
			var dfd = $.Deferred();
			if (query == "") {
			    dfd.resolve([]);
			} else if(cache[query] === undefined){
//			    Auth.clearCredentials();
			    // TODO: check query url
			    //$http.get(queryURL+query)
			    $http.get(Configuration.metric_search.uri + "/metrics?q=" + query)
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
}])
.factory('Model', ['$resource', 'Auth',
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
//				headers: Auth.authHeaders(AUTHCONFIG.modelstore.username,
//											AUTHCONFIG.modelstore.password)
			},
			editModel: {
				method:'PUT',
				params:{pageId:'@pageId'},
				isArray:false,
//				headers: Auth.authHeaders(AUTHCONFIG.modelstore.username,
//											AUTHCONFIG.modelstore.password)
			},
			removeModel:{
				method:'DELETE',
				params:{pageId:'@pageId'},
//				headers: Auth.authHeaders(AUTHCONFIG.modelstore.username,
//											AUTHCONFIG.modelstore.password)
			}
		});
	}
])
.factory('Tags', ['$resource', 'Auth',
	function($resource, Auth) {
//		Auth.clearCredentials();
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
])
.factory('Schema', ['$http', 'Auth',
	function($http, Auth) {
		var cache = {};

		return {
			get : function(params, cb){
				var dfd = $.Deferred();
				if (params.modelType === 'graph' || cache[params.modelType] === undefined){
//					Auth.clearCredentials();
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
