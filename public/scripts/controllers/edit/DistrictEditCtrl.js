'use strict';

var angular = require('angular');
var controllers = require('../../modules').controllers;

angular.module(controllers.name).controller('DistrictEditCtrl', function ($scope, crud, tableParams, gettextCatalog, District) {
  $scope.filters = [
    {filterId: 'name'}
  ];
  $scope.filterTypes = [
    {
      filterId: 'name',
      type: 'text',
      field: 'name',
      name: gettextCatalog.getString('Name')
    },
    {
      filterId: 'phoneId',
      type: 'text',
      field: 'phoneId',
      name: gettextCatalog.getString('Phone ID')
    }
  ];

  // strings that we can't translate in the view, usually because they're in attributes
  $scope.strings = {
    district: gettextCatalog.getString('District'),
    newDistrict: gettextCatalog.getString('New district'),
    edit: gettextCatalog.getString('Edit'),
    phoneId: gettextCatalog.getString('Phone ID'),
    name: gettextCatalog.getString('Name')
  };
  $scope.editTemplate = require('../../../partials/edit/forms/district-form.html');
  $scope.deleteTemplate = require('../../../partials/delete-record.html');
  $scope.resource = District;
  var options = {
    sorting: {'name.raw': 'asc'},
    queryString: $scope.queryString
  };

  // ---------------- Start: Common functions
  $scope.tableParams = tableParams.create(options, $scope.resource);
  var reload = function () {
    options.queryString = $scope.queryString;
    $scope.tableParams.reload();
  };
  $scope.$watchCollection('queryString', reload);
  $scope.createRecord = function () {
    crud.open(null, $scope.resource, $scope.editTemplate).result.then(reload);
  };
  $scope.editRecord = function (record) {
    crud.open(record, $scope.resource, $scope.editTemplate).result.then(reload);
  };
  $scope.deleteRecord = function (record) {
    crud.delete(record, $scope.resource, $scope.deleteTemplate).result.then(reload);
  };
  // ---------------- End: Common functions
});
