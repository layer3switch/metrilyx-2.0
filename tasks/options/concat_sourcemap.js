module.exports = {
    app: {
        src: [//app
            "metrilyx/static/config.js",
            "metrilyx/static/config.js.sample",
            "metrilyx/static/app.js",
            "metrilyx/static/controllers.js",
            "metrilyx/static/services.js",
            "metrilyx/static/libs/angular-graphing.js",
            "metrilyx/static/libs/angular-heatmap.js"],
        dest: 'tmp/result/tests/app.js',
        options: {
            sourcesContent: true
        }
    },
    app_dependencies: {
        src: [//dependencies
            "metrilyx/static/libs/jquery/jquery-1.10.2.min.js",
            "metrilyx/static/libs/jquery/jquery-addons.js",//buggy not working
            "metrilyx/static/libs/jquery/jquery-ui.js",
            "metrilyx/static/libs/highstock/2.0.1/js/highstock.js",
            "metrilyx/static/libs/graphing.js",
            "metrilyx/static/libs/dnd-config.js",
            "metrilyx/static/libs/bootstrap-datetimepicker/js/moment.min.js",
            "metrilyx/static/libs/bootstrap/js/bootstrap.min.js",
            "metrilyx/static/libs/bootstrap-datetimepicker/js/bootstrap-datetimepicker.js",
            "metrilyx/static/libs/angular/1.2.9/angular.min.js",
            "metrilyx/static/libs/angular/1.2.9/angular-resource.min.js",
            "metrilyx/static/libs/angular/1.2.9/angular-route.min.js",
            "metrilyx/static/libs/angular/1.2.9/angular-sanitize.min.js",
            "metrilyx/static/libs/angular-sortable.js"],
        dest: 'tmp/result/tests/app_dependencies.js',
        options: {
            sourcesContent: true
        }
    },
    test: {
        src: ['tests/unit/*.js', 'tests/unit/**/*.js'],
        dest: 'tmp/result/tests/tests.js',
        options: {
            sourcesContent: true
        }
    }
};
