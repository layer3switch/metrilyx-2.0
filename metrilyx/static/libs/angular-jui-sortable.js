'use strict';

/*
 jQuery UI Sortable plugin wrapper

 @param [ui-sortable] {object} Options to pass to $.fn.sortable() merged onto ui.config
*/
/*
 attributes:
  drag-copy="true"
    - if set will copy the item rather than move it.
  drop-create-child="int"
    - will wrap model into a nested array by the specified number
    - this is useful when adding an object to a row-column layout format 
*/
angular.module('ui.sortable', [])
  .value('uiSortableConfig',{})
  .directive('uiSortable', [ 'uiSortableConfig', '$log',
        function(uiSortableConfig, log) {
        return {
          require: '?ngModel',
          link: function(scope, element, attrs, ngModel) {

              function combineCallbacks(first,second){
                  if( second && (typeof second === 'function') ){
                      return function(e,ui){
                          first(e,ui);
                          second(e,ui);
                      };
                  }
                  return first;
              }

            var opts = {};

            var callbacks = {
                receive: null,
                remove:null,
                start:null,
                stop:null,
                update:null,
                over: null,
                out: null
            };

            var apply = function(e, ui) {
              if (ui.item.sortable.resort || ui.item.sortable.relocate) {
                scope.$apply();
              }
            };

            angular.extend(opts, uiSortableConfig);
            
            if (ngModel) {
              ngModel.$render = function() {
                  element.sortable( 'refresh' );
                  //console.log(ngModel.$modelValue);
              };
              callbacks.start = function(e, ui) {
                // Save position of dragged item
                ui.item.sortable = { index: ui.item.index() };
                if(attrs.dragCopy) $(ui.item).show();
              };

              callbacks.update = function(e, ui) {
                // For some reason the reference to ngModel in stop() is wrong
                ui.item.sortable.resort = ngModel;
                //console.log(ui.item.sortable.resort);
              };

              callbacks.remove = function(e, ui) {
                // copy data into item
                if (ngModel.$modelValue.length === 1) {
                  if(attrs.dragCopy) {
                    //console.log(ngModel.$modelValue[ui.item.sortable.index]);
                    //console.log("[uiSortable.remove]: copying");
                    ui.item.sortable.moved = JSON.parse(JSON.stringify(ngModel.$modelValue[0]));
                    e.preventDefault();
                  } else {
                    ui.item.sortable.moved = ngModel.$modelValue.splice(0, 1)[0];
                  }
                } else {
                  if(attrs.dragCopy) {
                    //console.log("[uiSortable.remove]: copying");
                    ui.item.sortable.moved =  JSON.parse(JSON.stringify(ngModel.$modelValue[ui.item.sortable.index]));
                    //console.log(ngModel.$modelValue[ui.item.sortable.index]);
                    e.preventDefault();
                  } else {
                    ui.item.sortable.moved =  ngModel.$modelValue.splice(ui.item.sortable.index, 1)[0];
                  }
                }
              };
              callbacks.receive = function(e, ui) {
                ui.item.sortable.relocate = true;
                // if the item still exists (it has not been cancelled)
                if('moved' in ui.item.sortable) {
                  if( Object.prototype.toString.call(ngModel.$modelValue) === '[object Array]' ) {
                    // dropCreateChild - wraps the object in an array and 
                    // add item to array into correct position and set up flag
                    // handle pod drop
                    var dropModel;
                    if(attrs.layout) {
                      if(Object.prototype.toString.call(ui.item.sortable.moved) === '[object Object]') {
                        dropModel = [[ ui.item.sortable.moved ]];
                      } else {
                        dropModel = ui.item.sortable.moved;
                      }
                    } else if(attrs.row) {
                      //console.log(ui.item.sortable.moved);
                      if(Object.prototype.toString.call(ui.item.sortable.moved) === '[object Object]') {
                        dropModel = [ ui.item.sortable.moved ];
                      } else {
                        dropModel = ui.item.sortable.moved;
                      }
                    } else {
                      dropModel = ui.item.sortable.moved;
                    }
                    //console.log(ui.item.index());
                    ngModel.$modelValue.splice(ui.item.index(), 0, dropModel);
                  } else {
                    log.info("drop location not an array:", ngModel.$modelValue);  
                  }
                }
              };

              

              callbacks.stop = function(e, ui) {
                // digest all prepared changes
                if (ui.item.sortable.resort && !ui.item.sortable.relocate) {

                  // Fetch saved and current position of dropped element
                  var end, start;
                  start = ui.item.sortable.index;
                  end = ui.item.index();

                  // Reorder array and apply change to scope
                  ui.item.sortable.resort.$modelValue.splice(end, 0,  ui.item.sortable.resort.$modelValue.splice(start, 1)[0]);
                }
              };

              scope.$watch(attrs.uiSortable, function(newVal){
                  angular.forEach(newVal, function(value, key){

                      if( callbacks[key] ){
                          // wrap the callback
                          value = combineCallbacks( callbacks[key], value );

                          if ( key === 'stop' ){
                              // call apply after stop
                              value = combineCallbacks( value, apply );
                          }
                      }
                      element.sortable('option', key, value);
                  });
              }, true);

              angular.forEach(callbacks, function(value, key ){

                    opts[key] = combineCallbacks(value, opts[key]);
              });

              // call apply after stop
              opts.stop = combineCallbacks( opts.stop, apply );

            } else {
              log.info('ui.sortable: ngModel not provided!', element);
            }

            // Create sortable
            element.sortable(opts);
          }
        };
      }
]);
