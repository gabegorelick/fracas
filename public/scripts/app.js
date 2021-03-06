'use strict';

var angular = require('angular');
require('angular-animate');
require('angular-resource');
require('angular-sanitize');
require('angular-bootstrap');
require('angular-ui-router');
require('angular-ui-select2');
require('angular-ui-sortable');
require('angular-gettext');
require('angular-gridster');
require('angular-loading-bar');
require('angular-order-object-by');

// explicitly require d3 and friends due to weird browserify issues,
// see https://github.com/ForbesLindesay/browserify-middleware/issues/43
require('d3');

// polyfills, try to require only what you need instead of entire es6 polyfills
require('array.prototype.find'); // behind "experimental JS" flag in Chrome < 39, not in IE <= 11
require('string.prototype.endswith'); // not in IE <= 11
if (!Function.prototype.bind) {
  // PhantomJS doesn't have bind, see https://github.com/ariya/phantomjs/issues/10522#issuecomment-50621310
  Function.prototype.bind = require('function-bind');
}

require('ng-debounce');
require('text-angular');
require('leaflet');
require('ng-file-upload');
require('ng-grid');

var frable = require('../frable');
require('../select2');
require('../hinge');
require('../crosstab');
require('../fracas-filter');
require('../dashboard');
require('../workbench');
require('../outpatient');
require('../aggregate');
require('../entry');

var modules = require('./modules');
require('./controllers');
require('./services');
require('./directives');
require('./filters');


var dependencies = ['ngAnimate', 'ngResource', 'ngSanitize', 'ui.bootstrap', 'ui.router', 'ui.select2', 'ui.sortable',
                    'gettext','angular-loading-bar', 'debounce', 'gridster', 'textAngular', 'angularFileUpload',
                    'ngGrid', 'ngOrderObjectBy', frable.name]
  .concat(Object.keys(modules).map(function (m) {
    return modules[m].name; // 'fracas.filters', 'fracas.services', etc.
  }));

var app = angular.module('fracasApp', dependencies);

app.config(function ($httpProvider, csrfToken) {
  ['post', 'put', 'delete', 'patch'].forEach(function (method) {
    // ng doesn't have default DELETE header
    if (!$httpProvider.defaults.headers[method]) {
      $httpProvider.defaults.headers[method] = {};
    }
    $httpProvider.defaults.headers[method]['X-CSRF-TOKEN'] = csrfToken;
  });
});

app.config(function (cfpLoadingBarProvider) {
  // what's the point of having a spinner when we already have a loading bar?
  cfpLoadingBarProvider.includeSpinner = false;
});

var previousState = {};
var stateChanged = false; // there's probably a better way to track initial state change, but this works
app.run(function ($rootScope, $state, $http, cfpLoadingBar, user, $injector) {


  $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
    cfpLoadingBar.start();

    if (!stateChanged) {
      if(user.getUser()){
        $injector.get('$http').defaults.transformRequest = function (data, headersGetter) {
          if ($rootScope.oauth) {
            /*jshint sub:true*/
            headersGetter()['Authorization'] = 'Bearer ' + user.getUser().tokens;
          }
          if (data) {
            return angular.toJson(data);
          }
        };
      }
      // We only "redirect" on initial page load. Once you're in the app, there are better ways of dealing with this
      stateChanged = true;
      if (!user.isLoggedIn()) {
        event.preventDefault();
        $state.transitionTo('login');
      } else if (toState.name === 'login') {
        // user is already logged in and trying to go to login page
        event.preventDefault();
        $state.transitionTo('home');
      }
    }

    if (fromState.url !== '^') {
      previousState = {
        state: fromState,
        params: fromParams,
        path: null // path is only used when transitioning to unknown state
      };
    }
  });

  var incLoadingBar = function () {
    if ($http.pendingRequests.length > 0) {
      cfpLoadingBar.inc();
    } else {
      cfpLoadingBar.complete();
    }
  };

  $rootScope.$on('$stateChangeSuccess', incLoadingBar);
  $rootScope.$on('$stateChangeError', incLoadingBar);
});

angular.module(modules.services.name).factory('previousState', function () {
  return previousState;
});

app.config(function ($locationProvider, $stateProvider, $urlRouterProvider) {
  $locationProvider.html5Mode(true).hashPrefix('!');

  $urlRouterProvider.otherwise(function ($injector, $location) {
    previousState = {
      path: $location.path()
    };
    return '/not-found';
  });

  $stateProvider
    .state('home', {
      template: require('../partials/home.html'),
      controller: 'MainCtrl'
    })
    .state('home.content', {
      url: '/',
      // home.content is the same as the workbench right now, just at a different URL.
      // It may be different in the future though.
      template: require('../workbench/workbench.html'),
      controller: 'WorkbenchCtrl'
    })
    .state('login', {
      url: '/login',
      template: require('../partials/login.html'),
      controller: 'LoginCtrl'
    })
    .state('workbench', {
      url: '/workbench/:workbenchId',
      template: require('../workbench/workbench.html'),
      controller: 'WorkbenchCtrl',
      parent: 'home'
    })
    .state('dashboard', {
      url: '/dashboard/:dashboardId',
      template: '<div class="container-fluid"><dashboard dashboard-id="dashboardId"></dashboard></div>',
      controller: 'DashboardCtrl',
      parent: 'home'
    })
    .state('not-found', {
      url: '/not-found',
      template: require('../partials/not-found.html'),
      controller: 'NotFoundCtrl'
    })
    .state('relogin', {
      url: '/relogin',
      controller: 'ReloginCtrl',
      parent: 'home'
    })
    .state('report', {
      url: '/report/:url', // url param gives path to save
      controller: 'ReportCtrl',
      parent: 'home',
      abstract: true
    })
    .state('report.save', {
      url: '/save'
    })
    .state('visualization-export', {
      url: '/visualization-export',
      template: require('../partials/visualization-export.html'),
      controller: 'VisualizationExportCtrl'
    })
    .state('visualization-report', {
      url: '/visualization-report',
      template: require('../partials/reports/visualization-report.html'),
      controller: 'VisualizationReportCtrl'
    })
    .state('visits-report', {
      url: '/visits-report',
      template: require('../partials/reports/visits-report.html'),
      controller: 'VisitsReportCtrl'
    })
    .state('weekly-report', {
      url: '/weekly-report',
      template: require('../partials/reports/weekly-report.html'),
      controller: 'WeeklyReportCtrl'
    })
    .state('timeseries-report', {
      url: '/timeseries-report',
      template: require('../partials/reports/timeseries-report.html'),
      controller: 'TimeseriesReportCtrl'
    })
    .state('edit', {
      url: '/edit',
      parent: 'home',
      abstract: true,
      template: '<div ui-view></div>'
    })
    .state('edit.visit', { // TODO define this in outpatient module
      url: '/visit',
      template: require('../outpatient/edit.html'),
      controller: 'OutpatientEditCtrl'
    })
    .state('edit.aggregate', { // TODO define this in outpatient module
      url: '/aggregate-data',
      template: require('../partials/edit/aggregate-data.html'),
      controller: 'AggregateDataEditCtrl'
    })
    .state('edit.district', {
      url: '/district',
      template: require('../partials/edit/district.html'),
      controller: 'DistrictEditCtrl'
    })
    .state('edit.symptom', {
      url: '/symptom',
      template: require('../partials/edit/symptom.html'),
      controller: 'SymptomEditCtrl'
    })
    .state('edit.syndrome', {
      url: '/syndrome',
      template: require('../partials/edit/syndrome.html'),
      controller: 'SyndromeEditCtrl'
    })
    .state('edit.disposition', {
      url: '/disposition',
      template: require('../partials/edit/disposition.html'),
      controller: 'DispositionEditCtrl'
    })
    .state('edit.visitType', {
      url: '/visitType',
      template: require('../partials/edit/visit-type.html'),
      controller: 'VisitTypeEditCtrl'
    })
    .state('edit.diagnosis', {
      url: '/diagnosis',
      template: require('../partials/edit/diagnosis.html'),
      controller: 'DiagnosisEditCtrl'
    })
    .state('edit.user', {
      url: '/user',
      template: require('../partials/edit/user.html'),
      controller: 'UserEditCtrl'
    })
    .state('edit.dashboard', {
      url: '/dashboard',
      template: require('../partials/edit/dashboard.html'),
      controller: 'DashboardEditCtrl'
    })
    .state('edit.visualization', {
      url: '/visualization',
      template: require('../partials/edit/visualization.html'),
      controller: 'VisualizationEditCtrl'
    })
    .state('edit.workbench', {
      url: '/workbench',
      template: require('../partials/edit/workbench.html'),
      controller: 'WorkbenchEditCtrl'
    });
});

app.config(function ($httpProvider) {
  $httpProvider.interceptors.push('errorInterceptor');
});

app.run(function ($rootScope, $http, gettextCatalog, lang) {
  $http.get('/public/translations/' + lang + '.json')
    .success(function (strings) {
      Object.keys(strings).forEach(function (lang) {
        // angular-gettext's JSON format allows for multiple locales in a single bundle
        // we don't use that now, but we may in the future
        gettextCatalog.setStrings(lang, strings[lang]);
      });
      gettextCatalog.currentLanguage = lang;
      gettextCatalog.debug = angular.element('meta[name="_environment"]').attr('content') === 'development';
    });
});

module.exports = app;
