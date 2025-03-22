// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-jasmine-order-reporter'),
      require('karma-spec-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
        forbidDuplicateNames: true,
        failSpecWithNoExpectations: true,
      },
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true, // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/efis-editor'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
      check: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },
    },
    files: [{ pattern: './public/**', included: false, served: true }],
    // If any files need to be served at the root directory (instead of /base/public), they'll need to be individually
    // added to proxies.
    proxies: {},
    reporters: ['spec', 'kjhtml', 'jasmine-order'],
    // Prevents jasmine-order from also logging all the output
    disableJasmineOrderStandardLogging: true,
    specReporter: { suppressSkipped: false, showSpecTiming: true },
    browsers: ['ChromeWithoutNagScreen'],
    customLaunchers: { ChromeWithoutNagScreen: { base: 'Chrome', flags: ['--disable-search-engine-choice-screen'] } },
    restartOnFileChange: true,
    browserConsoleLogOptions: { level: 'info', terminal: true },
  });
};
