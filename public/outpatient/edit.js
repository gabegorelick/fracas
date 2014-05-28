'use strict';

var angular = require('angular');
var controllers = require('../scripts/modules').controllers;
var services = require('../scripts/modules').services;

/**
 * Wraps an outpatientForm in a modal window.
 */
angular.module(services.name).factory('outpatientEditModal', function ($modal) {
  return {
    open: function (options) {
      options = angular.extend({
        template: require('./modal-edit.html'),
        controller: ['$scope', '$modalInstance', 'record', function ($scope, $modalInstance, record) {
          $scope.record = record;

          // the save button on the modal
          $scope.save = function () {
            // tell the form to save
            $scope.$broadcast('outpatientSave'); // "save" is a little too common for my comfort
          };

          // the cancel button on the modal
          $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
          };

          // called after the form has been successfully submitted to the server
          $scope.onSubmit = function () {
            $modalInstance.close();
          };
        }],
        resolve: {
          record: function () {
            return options.record;
          }
        }
      }, options);

      return $modal.open(options);
    }
  };
});

angular.module(services.name).factory('outpatientDeleteModal', function ($modal, OutpatientVisit) {
  return {
    open: function (options) {
      options = angular.extend({
        template: require('../partials/delete-record.html'),
        controller: ['$scope', '$modalInstance', 'record', function ($scope, $modalInstance, record) {
          $scope.record = record;
          $scope.delete = function () {
            OutpatientVisit.remove({_id: record._id}, function () {
              $modalInstance.close(record);
            });
          };
          $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
          };
        }],
        resolve: {
          record: function () {
            return options.record;
          }
        }
      }, options);

      return $modal.open(options);
    }
  };
});

angular.module(controllers.name).controller('OutpatientEditCtrl', function ($scope, $modal, outpatientEditModal, //
                                                                            gettextCatalog, outpatientDeleteModal) {
  $scope.filters = [
    {type: 'date'}
  ];
  $scope.filterTypes = [
    {
      type: 'age',
      name: gettextCatalog.getString('Age')
    },
    {
      type: 'date',
      name: gettextCatalog.getString('Date')
    },
    {
      type: 'districts',
      name: gettextCatalog.getString('District')
    },
    {
      type: 'sex',
      name: gettextCatalog.getString('Sex')
    },
    {
      type: 'symptoms',
      name: gettextCatalog.getString('Symptom')
    }
  ];

  $scope.createVisit = function () {
    outpatientEditModal.open().result
      .then(function () {
        reload();
        // TODO highlight record that was created
      });
  };

  var reload = function () {
    $scope.$broadcast('outpatientReload');
  };

  $scope.editVisit = function (visit) {
    outpatientEditModal.open({record: visit}).result
      .then(function () {
        reload();
        // TODO highlight record that was modified
      });
  };

  $scope.deleteVisit = function (visit) {
    outpatientDeleteModal.open({record: visit}).result
      .then(function () {
        reload();
      });
  };

  $scope.$on('outpatientEdit', function (event, visit) {
    $scope.editVisit(visit);
  });

  $scope.$on('outpatientDelete', function (event, visit) {
    $scope.deleteVisit(visit);
  });
});
