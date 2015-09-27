var _ = require('lodash');

/**
 * AutoIncrement plugin constructor
 * @param {string} schema  the schema object
 * @param {object} options A set of options for this plugin
 * @param {string} model The model to apply this plugin to
 * @param {string} [inc_field='_id'] The field to increment
 * @param {string|string[]} [reference_fields] Any field to consider as reference for the counter
 * @param {boolean} [disable_hooks] If true any hook will be disabled 
 */
var AutoIncrement = function(schema, options){
    var defaults = {
        model: null,
        inc_field: '_id',
        reference_fields: null,
        disable_hooks: false
    };

    options = _.defaults();
};
