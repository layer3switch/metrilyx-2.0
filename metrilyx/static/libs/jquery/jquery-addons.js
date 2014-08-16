(function($, undefined) {
  $.fn.autoResize = function(obj) {
    if ($(this).prop('tagName') == 'TEXTAREA') {

      $(this).css("overflow-y", "hidden");
      $(this).css("resize", "none");

      $(this).keyup(function() {
        arr = $(this).val().split("\n");
        $(this).attr("rows", arr.length);

        if (obj && "step" in obj) {
          obj.step({
            count: arr.length - 1
          });
        }
      });

    }
  }
}(jQuery));
