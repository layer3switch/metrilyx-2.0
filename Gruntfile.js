module.exports = function(grunt) {
  'use strict';

  require('jit-grunt')(grunt);

  var BASE_TASK_DIR = './tasks/options'

  var OPTION = {
    clean: require(BASE_TASK_DIR + '/clean'),
    concat_sourcemap: require(BASE_TASK_DIR + '/concat_sourcemap'),
    karma: require(BASE_TASK_DIR + '/karma')
  }

  // Project configuration
  grunt.initConfig({
    // Metadata
    pkg: grunt.file.readJSON('package.json'),
    clean: OPTION.clean,
    concat_sourcemap: OPTION.concat_sourcemap,
    karma: OPTION.karma
  });

  // Default task
  grunt.registerTask('test', ['clean:debug', 'concat_sourcemap', 'karma:ci']);
  grunt.registerTask('default', ['test']);
};
