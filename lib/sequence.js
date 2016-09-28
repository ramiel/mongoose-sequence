var _ = require('lodash'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    SequenceArchive = require('./sequence_archive'),
    sequenceArchive = SequenceArchive.getSingleton(),
    Sequence;

/**
 * Sequence plugin constructor
 * @class Sequence
 * @param {string} schema  the schema object
 * @param {object} options A set of options for this plugin
 * @param {string} [options.inc_field='_id'] The field to increment
 * @param {string} [options.id='same as inc_field'] The id of this sequence. Mandatory only if the sequence use reference fields
 * @param {string|string[]} [options.reference_fields=['_id']] Any field to consider as reference for the counter
 * @param {boolean} [options.disable_hooks] If true any hook will be disabled
 * @param {string} [options.collection_name='counters'] A name for the counter collection
 * @throws {Error} If id is missing for counter which referes other fields
 * @throws {Error} If A counter collide with another because of same id
 */
Sequence = function(schema, options) {
    var defaults = {
        id: null,
        inc_field: '_id',
        reference_fields: null,
        disable_hooks: false,
        collection_name: 'counters'
    };
    options = options || {};
    _.defaults(options, defaults);

    if (_.isNull(options.reference_fields)) {
        options.reference_fields = options.inc_field;
        this._useReference = false;
    }else {
        this._useReference = true;
    }

    options.reference_fields = _.isArray(options.reference_fields) ? options.reference_fields : [options.reference_fields];
    options.reference_fields = options.reference_fields.sort();

    if (this._useReference === true && _.isNull(options.id)) {
        throw new Error('Cannot use reference fields without specifying an id');
    }else {
        options.id = options.id || options.inc_field;
    }

    this._options = options;
    this._schema = schema;
    this._counterModel = null;
};

/**
 * Create an instance for a sequence
 *
 * @method     getInstance
 * @param      {Object}    schema   A mongoose Schema
 * @param      {object}    options  Options as accepted by A sequence
 *                                  constructor
 * @return     {Sequence}  A sequence
 *
 * @static
 */
Sequence.getInstance = function(schema, options) {
    var sequence = new Sequence(schema, options),
        id = sequence.getId();

    if(sequenceArchive.existsSequence(id)){
        throw new Error('Counter already defined for field "'+id+'"');
    }
    sequence.enable();
    sequenceArchive.addSequence(id, sequence);
    return sequence;
};

/**
 * Enable the sequence creating all the necessary models
 *
 * @method     enable
 */
Sequence.prototype.enable = function(){
    this._counterModel = this._createCounterModel();

    this._createSchemaKeys();

    this._setMethods();

    if (this._options.disable_hooks === false) {
        this._setHooks();
    }
};

/**
 * Return the id of the sequence
 *
 * @method     getId
 * @return     {String}  The id of the sequence
 */
Sequence.prototype.getId = function() {
    return this._options.id;
};

/**
 * Given a mongoose document, retrieve the values of the fields set as reference
 * for the sequence.
 *
 * @method     _getCounterReferenceField
 * @param      {object}  doc     A mongoose document
 * @return     {Array}   An array of strings which represent the value of the
 *                       reference
 */
Sequence.prototype._getCounterReferenceField = function(doc) {
    var reference = [];

    if (this._useReference === false) {
        reference = null;
    }else {
        for (var i in this._options.reference_fields) {
            reference.push(JSON.stringify(doc[this._options.reference_fields[i]]));
        }
    }
    return reference;
};

/**
 * Enrich the schema with keys needed by this sequence
 *
 * @method     _createSchemaKeys
 */
Sequence.prototype._createSchemaKeys = function() {
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

/**
 * Create a model for the counter handled by this sequence
 *
 * @method     _createCounterModel
 * @return     {Mongoose~Model}  A mongoose model
 */
Sequence.prototype._createCounterModel = function() {
    var CounterSchema;

    CounterSchema = Schema(
        {
            id: {type: String, required: true},
            reference_value: {type:Array, required: true},
            seq: {type:Number, default: 0, required: true}
        },
        {
            collection: this._options.collection_name,
            validateBeforeSave: false,
            versionKey: false,
            _id: false
        }
    );

    CounterSchema.index({id: 1, reference_value: 1}, {unique: true});

    /* Unused. Enable when is useful */
    // CounterSchema.static('getNext', function(id, referenceValue, callback) {
    //     this.findOne({ id: id, reference_value: referenceValue }, callback);
    // });

    return mongoose.model('Counter_' + this._options.id, CounterSchema);
};

/**
 * Set and handler for some hooks on the schema referenced by this sequence
 *
 * @method     _setHooks
 */
Sequence.prototype._setHooks = function() {
    var _this = this;

    this._schema.pre('save', true, (function(sequence){
        return function(next, done) {
            var doc = this;
            next();
            if (!doc.isNew) {
                return done();
            }
            sequence._setNextCounter(doc, function(err, seq) {
                if (err) return done(err);
                doc[sequence._options.inc_field] = seq;
                done();
            }.bind(doc));
        };
    })(this));

    this._schema.pre('findOneAndUpdate', function(next) {
        // jscs:disable
        var _thisquery = this,
            referenceValue;

        // jscs:enable

        this.model.findOne(_thisquery._conditions, function(err, obj) {
            if (err) return next();
            if (obj) return next();
            else {
                referenceValue = _this._getCounterReferenceField(_thisquery._update);
                _this._setNextCounterByReference(_this.getId(), referenceValue, function(err, seq) {
                    if (err) return next();
                    _thisquery._update['$setOnInsert'] = _thisquery._update['$setOnInsert'] || {};
                    _thisquery._update['$setOnInsert'][_this._options.inc_field] = seq;
                    next();
                });
            }
        });
    });


    this._schema.pre('update', function(next, done) {
        // jscs:disable
        var _thisquery = this,
            referenceValue;

        // jscs:enable


        this.model.findOne(_thisquery._conditions, function(err, obj) {
            if (err) return next();
            if (obj) return next();
            else {
                referenceValue = _this._getCounterReferenceField(_thisquery._update.$set);
                _this._setNextCounterByReference(_this.getId(), referenceValue, function(err, seq) {
                    if (err) return next();
                    _thisquery._update['$setOnInsert'] = _thisquery._update['$setOnInsert'] || {};
                    _thisquery._update['$setOnInsert'][_this._options.inc_field] = seq;
                    next();
                });
            }
        });
    });
};

/**
 * Set some useful methods on the schema
 *
 * @method     _setMethods
 */
Sequence.prototype._setMethods = function() {
    // this._schema.static('getNext', function(id, referenceValue, callback) {
    //     this._counterModel.getNext(id, referenceValue, function(err, counter) {
    //         if (err) return callback(err);
    //         return callback(null, ++counter.seq);
    //     });
    // }.bind(this));

    this._schema.method('setNext', function(id, callback) {
        var sequence = sequenceArchive.getSequence(id);

        if (_.isNull(sequence)) {
            return callback(new Error('Trying to increment a wrong sequence using the id ' + id));
        }

        sequence._setNextCounter(this, function(err, seq) {
            if (err) return callback(err);
            this[sequence._options.inc_field] = seq;
            this.save(callback);
        }.bind(this));
    });
};

/**
 * Utility function to increment a counter in a transaction
 *
 * @method     _setNextCounter
 * @param      {object}    doc       A mongoose model which need to receive the
 *                                   increment
 * @param      {Function}  callback  Called with the sequence counter
 */
Sequence.prototype._setNextCounter = function(doc, callback) {
    var id = this.getId();
    var referenceValue = this._getCounterReferenceField(doc);
    this._setNextCounterByReference(id, referenceValue, callback);
};

Sequence.prototype._setNextCounterByReference = function(id, referenceValue, callback) {
    this._counterModel.findOneAndUpdate(
        { id: id, reference_value: referenceValue },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, passRawResult: true },
        function(err, counter) {
            if (err) return callback(err);
            return callback(null, counter.seq);
        }

    );
};

module.exports = Sequence.getInstance;
