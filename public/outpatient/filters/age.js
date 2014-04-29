'use strict';

var angular = require('angular');
var directives = require('../../scripts/modules').directives;

angular.module(directives.name).directive('outpatientAgeFilter', function (gettextCatalog) {
  return {
    restrict: 'E',
    template: require('./age.html'),
    transclude: true,
    scope: {
      filter: '=fracasFilter',
      close: '&onClose'
    },
    link: {
      pre: function (scope) {
        scope.strings = {
          name: gettextCatalog.getString('Age')
        };

        scope.model = {
          age: ''
        };

        scope.$watch('model.age', function (age) {
          age = age || '*';
          scope.filter.queryString = 'patient.age:' + age;
        });
      }
    }
  };
});