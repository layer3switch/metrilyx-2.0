'use strict';

angular.module("metrilyxAnnotations", ['ngResource'])
.factory('EventAnnoService', ['$resource', 'Configuration',
    function($resource, Configuration) {
        return $resource(Configuration.annotations.url+
            Configuration.annotations.endpoints.annotate, {}, {
            search: {
                method: 'GET',
                isArray: true
            }
        });
    }
])
.factory('EventAnnoTypesService', ['$resource', 'Configuration',
    function($resource, Configuration) {
        return $resource(Configuration.annotations.url+
            Configuration.annotations.endpoints.types+'/:type', {}, {
            listTypes: {
                method: 'GET',
                isArray: true
            },
            getType: {
                method: 'GET',
                params: { type: '@type' },
                isArray: false
            }
        });
    }
])
.factory("AnnotationParsers", ['$routeParams', function($routeParams) {
    
    var getURLAnnoTags = function() {
        var out = {};
        if ($routeParams.annotationTags) {
            
            var annoTagKVs = $routeParams.annotationTags.split(",");
            for( var i=0; i < annoTagKVs.length; i++ ) {
                
                var kv = annoTagKVs[i].split(":");
                if( kv.length !== 2 || kv[0] === '' || kv[1] === '' ) {
                    console.log('invalid annotation tags: '+kv);
                    continue;
                } else {
                    out[kv[0]] = kv[1];
                }
            }
        }
        return out;
    }

    var getURLAnnoTypes = function() {
        var out = [];
        if($routeParams.annotationTypes !== undefined) {
            var annoTypes = $routeParams.annotationTypes.split(",");
            for(var i=0; i<annoTypes.length; i++) {
                if(annoTypes[i] !== '') 
                    out.push(annoTypes[i]);
            }
        }
        return out;
    }

    var annoTypesString = function(annoIdx) {
        var out = [];
        for(var k in annoIdx) {
            if(annoIdx[k].selected) out.push(k);
        }
        return out.join(',');
    }

    var getAnnoFilter = function() {
        return {
            tags: getURLAnnoTags(),
            types: getURLAnnoTypes() /* this holds the types used for subscription */
        };
    }
    
    return {
        annoTypesString: annoTypesString,
        getAnnoFilter: getAnnoFilter
    }
}])
.factory("AnnotationsManager", [
    '$location', '$routeParams', '$http', 'Configuration', 'EventAnnoTypesService', 'EventAnnoService', 'AnnotationParsers',
    function($location, $routeParams, $http, Configuration, EventAnnoTypesService, EventAnnoService, AnnotationParsers) {

        var AnnotationsManager = function(scope) {

            var t = this;

            var maxRetries = 3,
                retryCount = 0,
                _callbacks = [],
                _expectedListeners = 0;

            var wsock;

            var setAnnotationsFilter = function(annoTypes, annoTagsFilter) {

                var tmp = $location.search();
                $.extend(true, tmp, {
                    annotationTypes: AnnotationParsers.annoTypesString(annoTypes),
                    annotationTags: dictToCommaSepStr(annoTagsFilter, ':')
                }, true);

                if(tmp.annotationTypes === "") delete tmp.annotationTypes;
                if(tmp.annotationTags === "") delete tmp.annotationTags;

                $location.search(tmp);
            }

            function sendMessage(data) {
                wsock.send(angular.toJson(data));
            }

            function onWsOpen(evt) {
                console.log('Connection opened (annolityx): ', evt);
                retryCount = 0;
                /* subsciption message */
                sendMessage(scope.annoFilter);

                for(var i=0; i< _callbacks.length; i++) {
                    //console.log('adding listener...');
                    wsock.addEventListener('annotation', _callbacks[i]);
                } 
            }

            function onWsClose(evt) {
                console.log('Connection closed (annolityx) ', evt);
                wsock = null;
                
                console.log('Reconnecting in 5 sec...');
                setTimeout(function() {
                    if(retryCount < maxRetries) {
                        connect();
                        retryCount++;
                    } else {
                        console.log('Max retries exceeded!');
                    }
                }, 10000);
            }

            function msgErrback(e) {
                console.error('Subscriber error:', e.data);
                console.warn(e);
            }

            function onWsMessage(evt) {
                var data;
                try {
                    data = JSON.parse(evt.data);
                } catch(e) {
                    msgErrback(e)
                    return;
                }
                if(data.error !== undefined) {
                    msgErrback(evt);
                } else {
                    //console.log('on message', data);
                    wsock.dispatchEvent(new CustomEvent('annotation', {'detail': data}));
                }
            }

            function connect(expectedListeners) {
                _expectedListeners = expectedListeners;

                wsock = new WebSocket(Configuration.annotations.websocket.uri);
                wsock.addEventListener('open', onWsOpen);
                wsock.addEventListener('message', onWsMessage);
                wsock.addEventListener('close', onWsClose);
            }

            function _getAnnoQuery() {
                var q = scope.getTimeWindow();
                q.types = AnnotationParsers.annoTypesString(scope.eventAnnoTypes);
                q.tags = dictToCommaSepStr(scope.annoFilter.tags, ':');
                
                if(q.tags === '') delete q.tags;
                if(q.types === '') delete q.types;
                
                return q;
            }

            function fetchAnnotationsForTimeFrame() {
                
                var q = _getAnnoQuery();
                if(!q.tags && !q.types) return;

                EventAnnoService.search(q, function(result) {
                    
                    wsock.dispatchEvent(new CustomEvent('annotation', {'detail': result}));
                    //t.dispatchEvent(new CustomEvent('annotation', {'detail': result}));
                }, msgErrback);
            }

            function addAnnotationListener(callback) {
                _callbacks.push(callback);
                if(wsock) {
                    wsock.addEventListener('annotation', callback);
                    /* Fetch data once all event listeners (i.e. graphs) have been registered  */
                    if(_expectedListeners === _callbacks.length) {
                        fetchAnnotationsForTimeFrame();
                    }
                }
            }

            var initializeAnnoAndTypes = function() {
                EventAnnoTypesService.listTypes(function(result) {
                    var _eventAnnoTypes = {};
                    for(var j=0; j< result.length; j++) {
                        result[j].selected = false;
                        _eventAnnoTypes[result[j].id] = result[j];
                    }
                    /* Set selected types */
                    for( var j=0; j< scope.annoFilter.types.length; j++ ) {
                        
                        _eventAnnoTypes[scope.annoFilter.types[j]].selected = true;
                    }
                    /* Set scope */
                    scope.eventAnnoTypes = _eventAnnoTypes;
                });
            }

            var disconnect = function() {
                if( wsock && wsock.readyState == 1 ) {
                    wsock.removeEventListener('open', onWsOpen);
                    wsock.removeEventListener('message', onWsMessage);
                    wsock.removeEventListener('close', onWsClose);
                    wsock.close();
                }
            }

            function _initialize() {
                if(Configuration.annotations.enabled) {
                    
                    /* Sets eventAnnoTypes (i.e. list of types) to scope. */
                    initializeAnnoAndTypes();
                    
                    /* This will actually be set before the above call because async */
                    scope.annoFilter = AnnotationParsers.getAnnoFilter();

                    scope.displayAnnoEditor = "none";
                    scope.addAnnotationListener = addAnnotationListener;
                    scope.setAnnotationsFilter = setAnnotationsFilter;

                    t.fetchAnnotationsForTimeFrame = fetchAnnotationsForTimeFrame;
                    t.sendMessage = sendMessage;
                    t.connect = connect;

                    /* Close websocket on controller reload to avoid multiple connections. */
                    scope.$on('$destroy', function() {
                        disconnect();   
                    });

                } else {
                    console.log('Annotations disabled!');
                }
            }

            _initialize();
        };

        return (AnnotationsManager);
    }
])
.factory('AnnotationUIManager', [ 
    function() {
        'use strict';
        /*
         * Manages Highcharts annotation rendering on graphs.
         */
        var AnnotationUIManager = function(graphId, scope) {

            var t = this;

            var _domNode = $("[data-graph-id='"+graphId+"']");
            var _chart = $(_domNode).highcharts();

            var _timeout;

            function _sortAnno(a,b) {
                if (a.x < b.x) return -1;
                if (a.x > b.x) return 1;
                return 0;
            }

            function _formatAnnoToHighcharts(anno) {
                return {
                    x: anno.timestamp*1000,
                    title: anno.type,
                    text: anno.message,
                    data: anno.data
                };
            }

            function _formatToHighchartsTypeIndex(annoData) {
                var out = {};
                for(var i=0;i< annoData.length; i++) {
                    if(!out[annoData[i].type.toLowerCase()]) {
                        out[annoData[i].type.toLowerCase()] = [];
                    }
                    out[annoData[i].type.toLowerCase()].push(_formatAnnoToHighcharts(annoData[i]));
                }
                return out;
            }

            function _newSerieData(serie, newData) {
                var ndata = [];
                for(var i=0; i < serie.data.length; i++) {
                    try {
                        if(serie.data[i].x < newData[0].x) {
                            ndata.push({
                                x: serie.data[i].x,
                                title: serie.data[i].title,
                                text: serie.data[i].text,
                                data: serie.data[i].data
                            });
                        } else if(!equalObjects(serie.data[i], newData[0])) {
                            ndata.push({
                                x: serie.data[i].x,
                                title: serie.data[i].title,
                                text: serie.data[i].text,
                                data: serie.data[i].data
                            });
                        } else {
                            break;
                        }
                    } catch(e) {
                        console.error(e);
                        console.log(serie.data, newData);
                    }
                }

                for(var i=0; i < newData.length; i++)
                    ndata.push(newData[i]);

                return ndata;
            }

            function addAnnotations(data) {
                if(data.length < 1) return;

                _chart = $(_domNode).highcharts();
                if(_chart === undefined) {

                    if(_timeout) clearTimeout(_timeout);
                    _timeout = setTimeout(function() {  addAnnotations(data); }, 3000);
                } else {

                    var idx = _formatToHighchartsTypeIndex(data);
                    for(var k in idx) {
                        
                        idx[k].sort(_sortAnno);

                        var serie = _chart.get(k)
                        if(serie) {
                            
                            var ndata = _newSerieData(serie, idx[k]);
                            serie.setData(ndata, false, false);
                        } else {
                            
                            var sf = new SeriesFormatter(idx[k]);
                            _chart.addSeries(sf.flagsSeries({ 
                                name: idx[k][0].title,
                                id: k,
                                color: scope.eventAnnoTypes[k].metadata.color
                            }));
                        }
                    }
                    _chart.redraw();
                }
            }

            function _initialize() {
                t.addAnnotations = addAnnotations;
            }

            _initialize();
        };
        return (AnnotationUIManager);
}])
.directive("annotationEditor", ['Configuration', function(Configuration) {
    'use strict';
    /* Controls annotation editor display */
    return {
        restrict: 'A',
        require: "?ngModel",
        templateUrl: 'app/annotations/anno-controls.html',
        link: function(scope, elem, attrs, ctrl) {

            var jelem = $(elem[0]);

            if(Configuration.annotations.enabled) {

                scope.toggleDisplay = function() {
                    if(scope.displayAnnoEditor == "none") 
                        scope.displayAnnoEditor = "block";
                    else 
                        scope.displayAnnoEditor = "none";    
                }
            } else {

                jelem.css("display", "none");
            }
        }
    }
}])
.directive("annotationDetails", [function() {
    return {
        restrict: 'A',
        require: '?ngModel',
        templateUrl: 'app/annotations/anno-details.html',
        link: function(scope, elem, attrs, ctrl) {
            if(!ctrl) return;
        
        }
    }
}]);
