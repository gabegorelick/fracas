'use strict';

var codex = require('../codex');
var Boom = require('boom');
var User = require('../models/User');

module.exports = codex.controller(User, {
  get: true,
  preGet: function (req, esRequest, callback) {
    if (!req.user) { // just in case
      return callback(Boom.forbidden());
    }

    if (req.user.isAdmin() || req.user._.id === esRequest.id) {
      // admins can see anyone, regular users can only see themselves
      return callback(null, esRequest);
    } else {
      return callback(Boom.forbidden());
    }
  },

  search: true,
  preSearch: function (req, esRequest, callback) {
    if (!req.user || !req.user.isAdmin()) {
      return callback(Boom.forbidden());
    }

    callback(null, esRequest);
  },
  postSearch: function (req, esResponse, callback) {
    if (esResponse && esResponse.results) {
      for (var index = 0; index < esResponse.results.length; index++) {
        if (esResponse.results[index]._source.password) {
          delete esResponse.results[index]._source.password;
        }
      }
    }
    callback(null, esResponse);
  },

  insert: true,
  replace: true,
  preInsert: function (req, esRequest, callback) {
    /*jshint unused:false */
    // TODO figure out what access control to enforce
    // maybe anyone can create users in demo mode, but only admins can create users in non demo mode
    // or maybe anyone can create users any time but they're quarantined until an admin approves them?
    if (!req.user || !req.user.canCreateUser(esRequest.body)) {
      return callback(Boom.forbidden());
    }

    // if editing an existing user information
    if (esRequest.id && !esRequest.body.password) {
      // get user record
      User.get({id: esRequest.id}, function (err, esr) {
        if (err) {
          return callback(err);
        }
        // set password
        esRequest.body.password = esr.password;
        callback(null, esRequest);
      });
    } else { // else if creating a new user or an existing user changing his password, hash the new password

      User.hashPassword(esRequest.body.password, function (err, password) {
        if (err) {
          return callback(err);
        }
        esRequest.body.password = password.toString('hex');
        callback(null, esRequest);
      });
    }
  },

  delete: true,
  preDelete: function (req, esRequest, callback) {
    if (!req.user) {
      return callback(Boom.forbidden());
    } else if (req.user._.id === esRequest.id) {
      // TODO provide a way for users to delete their accounts
      return callback(Boom.forbidden('Sorry, but you cannot delete your own account'));
    }

    callback(null, esRequest);
  }
}).with(require('../caper-trail').controller);
