/**
 * Initializes elasticsearch with our schema. Kind of like Rails's schema.rb, but not autogenerated.
 */
/*jshint camelcase:false */
'use strict';

var bluebird = require('bluebird');
var conf = require('../conf');
var logger = conf.logger;
var addPaperTrail = require('../caper-trail').mapping;
var client = conf.elasticsearch.newClient();

// List of requests to make to elasticsearch. Note to future maintainers: try to keep this sorted alphabetically
var indexRequests = [
  // We store everything in two indexes. One holds reference data (e.g. possible diagnoses, symptoms, etc.)
  // and settings. All these are combined into one index since there's not too much data and the overhead of more
  // indexes, including the increase in hosting costs, isn't worth it.
  // The other index holds actual surveillance data. Since this index can have a lot of data, it's distinct from
  // the other one to allow easier scaling.

  function fracasData (callback) {
    client.indices.create({
      index: 'fracas_data_' + Date.now(),
      body: {
        aliases: {
          'fracas_data': {}, // alias that points to latest version of index
          'outpatient_visit': {filter: {type: {value: 'outpatient_visit'}}}
        },
        settings: {
          analysis: {
            analyzer: {
              // allow searching on sex=female or sex=f
              sex: {
                tokenizer: 'whitespace',
                filter: ['lowercase', 'sex']
              }
            },
            filter: {
              sex: {
                type: 'synonym',
                synonyms: [
                  'm => male',
                  'f => female'
                ]
              }
            }
          }
        },
        mappings: {
          'outpatient_visit': addPaperTrail({
            properties: {
              // date of first presentation to healthcare system
              visitDate: {
                type: 'date'
              },

              symptomOnsetDate: {
                type: 'date'
              },

              // AKA presenting problem, Reason for Encounter, Reason for Presenting, etc. Free text
              notes: {
                type: 'string'
              },

              // Array of well-known symptoms that the patient presented with. Might be populated by parsing
              // notes, or might be used instead of notes. Used for syndromic surveillance.
              symptoms: {
                type: 'nested',
                include_in_root: true, //allows for query on flattened array
                properties: {
                  // name of the symptom, e.g. Back Pain
                  name: {
                    type: 'string',
                    fields: {
                      raw: {
                        type: 'string',
                        index: 'not_analyzed'
                      }
                    }
                  },

                  // How many cases presented with this symptom. Used for aggregate reporting. For individual reporting,
                  // this will be 1.
                  count: {
                    type: 'integer'
                  }
                }
              },

              visitType: {
                type: 'string',
                index: 'not_analyzed'
              },

              disposition: {
                type: 'string',
                index: 'not_analyzed'
              },

              // Array of well-known diagnoses. Usually used with symptoms.
              diagnoses: {
                type: 'nested',
                include_in_root: true, //allows for query on flattened array
                properties: {
                  // name of the diagnosis, e.g. Anemia
                  name: {
                    type: 'string',
                    fields: {
                      raw: {
                        type: 'string',
                        index: 'not_analyzed'
                      }
                    }
                  },

                  // How many cases presented with this diagnosis. Used for aggregate reporting. For individual
                  // reporting, this will be 1.
                  count: {
                    type: 'integer'
                  }
                }
              },

              // Syndromes are high-level groupings useful for surveillance, for example, "Dental." They are often
              // related to symptoms.
              syndromes: {
                type: 'nested',
                include_in_root: true, //allows for query on flattened array
                properties: {
                  // name of the syndrome, e.g. Eye Disease
                  name: {
                    type: 'string',
                    fields: {
                      raw: {
                        type: 'string',
                        index: 'not_analyzed'
                      }
                    }
                  },

                  // How many cases presented with this syndrome. Used for aggregate reporting. For individual
                  // reporting, this will be 1.
                  count: {
                    type: 'integer'
                  }
                }
              },

              patient: {
                properties: {
                  // Some kind of unique patient identifier, e.g. SSN
                  id: {
                    type: 'string',
                    index: 'not_analyzed'
                  },

                  // The only way to support names across cultures is with a single "name" field
                  name: {
                    type: 'string'
                  },

                  // Addresses are way too complicated to do anything but a single "address" field. This is more for
                  // manual followup of a patient than analysis anyway.
                  address: {
                    type: 'string'
                  },

                  phone: {
                    // phone numbers are not numbers!
                    type: 'string',
                    index: 'not_analyzed'
                  },

                  age: {
                    // we don't need that much precision, but we do want to support fractional ages, e.g. 0.5
                    type: 'double'
                  },
                  sex: {
                    type: 'string',
                    analyzer: 'sex'
                  },
                  weight: {
                    // Note that we do not store units, e.g. lb or kg. It's up to the application to make sure every
                    // entry uses the same units.
                    type: 'double'
                  },

                  // TODO move all this under vitals? could be useful if we split it out as separate addon
                  temperature: {
                    type: 'double'
                  },
                  pulse: {
                    type: 'double'
                  },
                  bloodPressure: {
                    properties: {
                      diastolic: {
                        type: 'double'
                      },
                      systolic: {
                        type: 'double'
                      }
                    }
                  },

                  // These are usually diagnoses
                  preExistingConditions: {
                    properties: {
                      name: {
                        type: 'string'
                      }
                      // room for other data
                    }
                  },

                  pregnant: {
                    properties: {
                      // True if patient is pregnant
                      is: {
                        type: 'boolean'
                      },

                      // Number of weeks pregnant. Not currently used.
                      weeks: {
                        type: 'double'
                      },

                      // What trimester patient is in. Less granularity than weeks, but often collected instead.
                      trimester: {
                        type: 'double'
                      }
                    }
                  }
                }
              },

              // AKA the clinic, hospital, military treatment center, etc. where the patient was processed.
              // Why medicalFacility? Because that's what http://en.wikipedia.org/wiki/Medical_facility says.
              medicalFacility: {
                properties: { // same as facility type

                  // The name of this facility
                  name: {
                    type: 'string'
                  },

                  location: {
                    properties: {
                      district: {
                        type: 'string',
                        fields: {
                          raw: {
                            type: 'string',
                            index: 'not_analyzed'
                          }
                        }
                      }
                    }
                  },

                  sites: {
                    properties: {
                      total: {
                        type: 'integer'
                      },
                      reporting: {
                        type: 'integer'
                      }
                    }
                  }
                }
              }
            }
          })
        }
      }
    }, callback);
  },

  function fracasSettings (callback) {
    client.indices.create({
      index: 'fracas_settings_' + Date.now(),
      body: {
        // Make aliases for each type in our index so that clients are abstracted from our storage topology
        aliases: [
          'dashboard',
          'date-shift',
          'diagnosis',
          'disposition',
          'district',
          'facility',
          'form',
          'symptom',
          'syndrome',
          'user',
          'visit',
          'visualization',
          'workbench'
        ].reduce(function (aliases, alias) {
            aliases[alias] = {filter: {type: {value: alias}}};
            return aliases;
          }, {'fracas_settings': {}}),

        mappings: {
          // Saved dashboards
          dashboard: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                index: 'not_analyzed'
              },
              description: {
                type: 'string',
                index: 'not_analyzed'
              },
              widgets: {
                type: 'object',
                index: 'no'
              }
            }
          }),

          // Holds a single record containing the last time we date shifted. Necessary so date shifting doesn't
          // compound.
          'date_shift': {
            properties: {
              date: {
                type: 'date'
              }
            }
          },

          // Diagnosis reference data
          diagnosis: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },

              /**
               * True if this diagnosis is being collected. TODO get rid of this
               */
              enabled: {
                type: 'boolean'
              }
            }
          }),

          disposition: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              }
            }
          }),

          // Right now, this is the only thing that's mapped. In the future, we'll have the capability to map more
          // things.
          district: addPaperTrail({
            properties: {
              name: {
                type: 'string'
              },
              geometry: {
                type: 'geo_shape'
              }
            }
          }),

          // medical facilities
          facility: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              location: {
                properties: {
                  // Stick whatever info you have on the facility's location here. Obviously, not all of these fields
                  // will be used.
                  district: {
                    type: 'string',
                    index: 'not_analyzed'
                  },
                  region: {
                    type: 'string',
                    index: 'not_analyzed'
                  },
                  province: {
                    type: 'string',
                    index: 'not_analyzed'
                  },
                  postalCode: {
                    type: 'string',
                    index: 'not_analyzed'
                  },
                  county: {
                    type: 'string',
                    index: 'not_analyzed'
                  },
                  state: {
                    type: 'string',
                    index: 'not_analyzed'
                  },
                  country: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              }
            }
          }),

          // Collection forms
          form: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },

              // Array of fields
              fields: {
                properties: {
                  name: {
                    type: 'string'
                  },
                  enabled: {
                    type: 'boolean'
                  },

                  // Array of possible values for this field. For example, a symptoms field might have "Cough", "Fever",
                  // etc.
                  values: {
                    properties: {
                      // Only store values. Labels are locale-dependent and belong in the views, not in the DB
                      name: {
                        type: 'string'
                      }
                      // other properties depend on the field, e.g. facility stores location info
                    }
                  }
                }
              }
            }
          }),

          symptom: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },

              /**
               * True if this symptom is being collected. TODO get rid of this
               */
              enabled: {
                type: 'boolean'
              }
            }
          }),

          syndrome: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              }
            }
          }),

          user: addPaperTrail({
            properties: {
              username: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              email: {
                type: 'string',
                index: 'not_analyzed'
              },
              password: {
                type: 'string',
                index: 'not_analyzed'
              },
              name: {
                type: 'string',
                index: 'not_analyzed'
              },
              disabled: {
                type: 'boolean'
              },
              roles: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              districts: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              }
            }
          }),

          // Types of visits
          visit: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              }
            }
          }),

          // Saved visualizations
          visualization: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              state: {
                type: 'object',
                index: 'no'
              }
            }
          }),

          // Saved workbenches
          workbench: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              state: {
                type: 'object',
                index: 'no'
              }
            }
          })
        }
      }
    }, callback);
  }
];

bluebird.settle(indexRequests.map(function (ir) {
    return bluebird.promisify(ir)();
  }))
  .then(function (promiseInspections) {
    var errors = promiseInspections.filter(function (pi) {
      return pi.isRejected();
    }).map(function (pi) {
      return pi.error();
    });

    errors.forEach(function (e) {
      logger.error({err: e}, 'Error creating index');
    });

    var numSuccesses = indexRequests.length - errors.length;
    logger.info('Successfully created %d out of %d indices (%d errors)', numSuccesses, indexRequests.length,
      errors.length);
  })

  // Can't do this until alias of aliases works: https://github.com/elasticsearch/elasticsearch/issues/3138
//  .then(bluebird.promisify(function (callback) {
//    // create an alias to hold all our data
//    client.indices.putAlias({name: 'fracas', index: ['fracas_data', 'fracas_settings']}, callback);
//  })())

  .catch(function (e) {
    // this shouldn't ever happen, but in case it does we don't want to swallow errors
    logger.error({err: e}, 'Error creating indices');
  })
  .finally(function () {
    client.close();
  });
