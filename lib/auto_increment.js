var _ = require('lodash'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    SequenceArchive = require('./sequence_archive'),
    sequenceArchive = SequenceArchive.getSingleton(),
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
 * @class Autoincrement
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

    if (_.isNull(options.reference_fields)) {
        options.reference_fields = options.inc_field;
        this._useReference = false;
    }else {
        this._useReference = true;
    }

    options.reference_fields = _.isArray(options.reference_fields) ? options.reference_fields : [options.reference_fields];
    options.reference_fields = options.reference_fields.sort();

    this._options = options;
    this._schema = schema;
    this._collectionName = this._schema.options.collection;
    this._counterModel = this._createCounterModel();

    this._createSchemaKeys();

    this._setMethods();

    if (this._options.disable_hooks === false) {
        this._setHooks();
    }
};

AutoIncrement.getInstance = function(schema, options) {
    var sequence = new AutoIncrement(schema, options),
        reference = sequence.getReference();
    sequenceArchive.addSequence(reference, sequence);
    return sequence;
};

AutoIncrement.prototype.getReference = function() {
    return this._options.reference_fields;
};

AutoIncrement.prototype._getCounterReferenceField = function(doc) {
    var reference = '';

    if (this._useReference === false) {
        reference = this._options.reference_fields;
    }else {
        for (var i in this._options.reference_fields) {
            reference += JSON.stringify(doc[this._options.reference_fields[i]]);
        }
    }

    return reference;
};

AutoIncrement.prototype._createSchemaKeys = function() {
    var schemaKey = this._schema.path(this._options.inc_field);
    if (_.isUndefined(schemaKey)) {
        var fieldDesc = {};
        fieldDesc[this._options.inc_field] = 'Number';
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
            reference: {type: Array, required: false},
            reference_value: {type:String, required: true},
            seq: {type:Number, default: 0, required: true}
        },
        {
            collection: this._options.collection_name,
            validateBeforeSave: false,
            versionKey: false
        }
    );

    CounterSchema.index({collection_name: 1, reference: 1, reference_value: 1}, {unique: true});

    CounterSchema.static('getNext', function(collection, reference, referenceValue, callback) {
        this.findOne({ collection_name: collection, reference: reference, reference_value: referenceValue }, callback);
    });

    return mongoose.model('Counter_' + Date.now(), CounterSchema);
};

AutoIncrement.prototype._setHooks = function() {
    var _this = this;
    this._schema.pre('save', true, function(next, done) {
        // jscs:disable
        var doc = this,
            referenceValue;

        // jscs:enable
        next();
        if (!doc.isNew) {
            return done();
        }

        referenceValue = _this._getCounterReferenceField(doc);
        _this._setNextCounter(_this._options.reference_fields, referenceValue, function(err, seq) {
            if (err) return done(err);
            doc[_this._options.inc_field] = seq;
            done();
        }.bind(doc));
    });
};

AutoIncrement.prototype._setMethods = function() {
    var useReference = this._useReference,
        _this = this;

    this._schema.static('getNext', function(reference, referenceValue, callback) {
        this._counterModel.getNext(this._schema.options.collection, reference, referenceValue, function(err, counter) {
            if (err) return callback(err);
            return callback(null, ++counter.seq);
        });
    });

    this._schema.method('setNext', function(reference, callback) {
        reference = _.isArray(reference) ? reference : [reference];
        var sequence = sequenceArchive.getSequence(reference),
            sequenceCounter;
        if (_.isNull(sequence)) {
            return callback(new Error('Trying to increment a wrong sequence using the reference ' + reference));
        }

        sequenceCounter = sequence.sequence;

        var referenceValue = sequenceCounter._getCounterReferenceField(this);

        _this._setNextCounter(sequence.reference, referenceValue, function(err, seq) {
            if (err) return calbback(err);
            this[_this._options.inc_field] = seq;
            callback(null, this);
        }.bind(this));
    });
};

AutoIncrement.prototype._setNextCounter = function(reference, referenceValue, callback) {
    this._counterModel.findOneAndUpdate(
        { collection_name: this._collectionName, reference: reference, reference_value: referenceValue },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, passRawResult: true },
        function(err, counter) {
            if (err) return callback(err);
            return callback(null, counter.seq);
        }

    );
};

module.exports = AutoIncrement.getInstance;
