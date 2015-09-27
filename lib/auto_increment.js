var _ = require('lodash'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    AutoIncrement;

/**
 * AutoIncrement plugin constructor
 * @param {string} schema  the schema object
 * @param {object} options A set of options for this plugin
 * @param {string} model The model to apply this plugin to
 * @param {string} [inc_field='_id'] The field to increment
 * @param {string|string[]} [reference_fields=['_id']] Any field to consider as reference for the counter
 * @param {boolean} [disable_hooks] If true any hook will be disabled
 * @param {string} [collection_name='counters'] A name for the counter collection
 * @class
 */
AutoIncrement = function(schema, options) {
    var defaults = {
        model: null,
        inc_field: '_id',
        reference_fields: null,
        disable_hooks: false,
        collection_name: 'counters'
    };

    _.defaults(options, defaults);

    options.reference_fields = _.isNull(options.reference_fields) ? options.inc_field : options.reference_fields;
    options.reference_fields = _.isArray(options.reference_fields) ? options.reference_fields : [options.reference_fields];

    this._options = options;
    this._schema = schema;
    this._collectionName = this._schema.options.collection;
    this._counterModel = this._createCounterModel();

    this._setMethods();

    if (this._options.disable_hooks === false) {
        this._setHooks();
    }
};

AutoIncrement.getInstance = function(schema, options) {
    return new AutoIncrement(schema, options);
};

AutoIncrement.prototype._getCounterReferenceField = function(doc) {
    var reference = '';
    for (var i in this._options.reference_fields) {
        reference += JSON.stringify(doc[this._options.reference_fields[i]]);
    }

    return reference;
};

AutoIncrement.prototype._createSchemaKeys = function() {
    var schemaKey = this._schema.path(options.inc_field);
    if (_.isUndefined(schemaKey)) {
        var fieldDesc = {};
        fieldDesc[options.inc_field] = 'Number';
        this._schema.add(fieldDesc);
    }else {
        if (schemaKey.instance !== 'Number') {
            throw new Error('Auto increment field already present and not of type "Number"');
        }
    }
};

AutoIncrement.prototype._createCounterModel = function() {
    var CounterSchema;

    CounterSchema = Schema(
        {
            collection_name: {type: String, required: true, default: this._collectionName},
            field: {type:String, required:true},
            seq: {type:Number, default: 0, required: true}
        },
        {
            collection: this._options.collection_name,
            validateBeforeSave: false,
            versionKey: false
        }
    );

    CounterSchema.index({collection_name: 1, field: 1}, {unique: true});

    CounterSchema.static('getNext', function(collection, field, callback) {
        this.findOne({ collection_name: collection, field: field }, callback);
    });

    return mongoose.model('Counter', CounterSchema);
};

AutoIncrement.prototype._setHooks = function() {
    var _this = this;
    this._schema.pre('save', true, function(next, done) {
        // jscs:disable
        var doc = this;

        // jscs:enable
        next();
        _this._setNextCounter(_this._getCounterReferenceField(doc), function(err, seq) {
            if (err) return done(err);
            doc[_this._options.inc_field] = seq;
            done();
        }.bind(doc));
    });
};

AutoIncrement.prototype._setMethods = function() {
    // this._schema.static('getNext', this._counterModel.getNext.bind(this._counterModel, this._collectionName, this._getCounterReferenceField()));
};

AutoIncrement.prototype._setNextCounter = function(reference, callback) {
    this._counterModel.findOneAndUpdate(
        { collection_name: this._collectionName, field: reference },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, passRawResult: true },
        function(err, counter) {
            if (err) return callback(err);
            return callback(null, counter.seq);
        }

          // {
          //     query: { collection_name: this._collectionName, field: this._getCounterReferenceField() },
          //     update: { $inc: { seq: 1 } },
          //     new: true,
          //     upsert: true
          // }
    );
};

module.exports = AutoIncrement.getInstance;
