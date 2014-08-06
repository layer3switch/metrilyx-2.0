module.exports = {
  options: {
    configFile: 'karma.conf.js',
    browsers: ['Chrome'],
    reporters: ['coverage', 'dots']
  },
  ci: {
    singleRun: true,
    browsers: ['PhantomJS']
  }
};
