const _ = require('lodash');
const async = require('async');
const mongoose = require('mongoose');
const SequenceArchive = require('./sequence_archive');

const sequenceArchive = SequenceArchive.getSingleton();
let Sequence;

module.exports = function SequenceFactory(connection) {
  if (arguments.length !== 1) {
    throw new Error('Please, pass mongoose while requiring mongoose-sequence: https://github.com/ramiel/mongoose-sequence#requiring');
  }

  /**
   * Sequence plugin constructor
   * @class Sequence
   * @param {string} schema  the schema object
   * @param {object} options A set of options for this plugin
   * @param {string} [options.inc_field='_id'] The field to increment
   * @param {string} [options.id='same as inc_field'] The id of this sequence.
   * Mandatory only if the sequence use reference fields
   * @param {string|string[]} [options.reference_fields=['_id']] Any field to consider as reference
   * for the counter
   * @param {boolean} [options.disable_hooks] If true any hook will be disabled
   * @param {string} [options.collection_name='counters'] A name for the counter collection
   * @param {boolean} [options.parallel_hooks] If true any hook will be registered as parallel
   * @param {Number} [options.start_seq=1] The number to start the sequence on
   * @param {Number} [options.inc_amount=1] The number to increment by
   * @throws {Error} If id is missing for counter which referes other fields
   * @throws {Error} If A counter collide with another because of same id
   */
  Sequence = function (schema, opts) {
    const defaults = {
      id: null,
      inc_field: '_id',
      start_seq: 1,
      inc_amount: 1,
      reference_fields: null,
      disable_hooks: false,
      collection_name: 'counters',
      parallel_hooks: true,
    };

    const options = {
      ...defaults,
      ...opts,
    };

    if (_.isNull(options.reference_fields)) {
      options.reference_fields = options.inc_field;
      this._useReference = false;
    } else {
      this._useReference = true;
    }

    options.reference_fields = _.isArray(options.reference_fields)
      ? options.reference_fields
      : [options.reference_fields];
    options.reference_fields = options.reference_fields.sort();

    if (this._useReference === true && _.isNull(options.id)) {
      throw new Error('Cannot use reference fields without specifying an id');
    } else {
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
  Sequence.getInstance = function (schema, options) {
    const sequence = new Sequence(schema, options);
    const id = sequence.getId();

    if (sequenceArchive.existsSequence(id)) {
      throw new Error(`Counter already defined for field "${id}"`);
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
  Sequence.prototype.enable = function () {
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
  Sequence.prototype.getId = function () {
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
  Sequence.prototype._getCounterReferenceField = function (doc) {
    let reference = {};

    if (this._useReference === false) {
      reference = null;
    } else {
      Object.keys(this._options.reference_fields).forEach((key) => {
        reference[this._options.reference_fields[key]] = doc[this._options.reference_fields[key]];
      });
    }

    return reference;
  };

  /**
   * Enrich the schema with keys needed by this sequence
   *
   * @method     _createSchemaKeys
   */
  Sequence.prototype._createSchemaKeys = function () {
    const schemaKey = this._schema.path(this._options.inc_field);
    if (_.isUndefined(schemaKey)) {
      const fieldDesc = {};
      fieldDesc[this._options.inc_field] = 'Number';
      this._schema.add(fieldDesc);
    } else if (schemaKey.instance !== 'Number') {
      throw new Error('Auto increment field already present and not of type "Number"');
    }
  };

  /**
   * Create a model for the counter handled by this sequence
   *
   * @method     _createCounterModel
   * @return     {Mongoose~Model}  A mongoose model
   */
  Sequence.prototype._createCounterModel = function () {
    const CounterSchema = mongoose.Schema(
      {
        id: { type: String, required: true },
        reference_value: { type: mongoose.Schema.Types.Mixed, required: true },
        seq: { type: Number, default: this._options.start_seq, required: true },
      },
      {
        collection: this._options.collection_name,
        validateBeforeSave: false,
        versionKey: false,
        _id: false,
      },
    );

    CounterSchema.index({ id: 1, reference_value: 1 }, { unique: true });

    /* Unused. Enable when is useful */
    // CounterSchema.static('getNext', function(id, referenceValue, callback) {
    //     this.findOne({ id: id, reference_value: referenceValue }, callback);
    // });

    return connection.model(`Counter_${this._options.id}`, CounterSchema);
  };

  /**
   * Return a pre-save hook for this sequence
   *
   * @method     _getPreSaveHook
   * @return     {Mongoose~Hook} A mongoose hook
   */
  Sequence.prototype._getPreSaveHook = function () {
    const sequence = this;
    return function (next, done) {
      const doc = this;
      let cb = done;
      if (!sequence._options.parallel_hooks) {
        cb = next;
      }
      if (sequence._options.parallel_hooks) {
        next();
      }
      if (!doc.isNew) {
        cb();
        return;
      }
      sequence._createCounter(doc, (createErr, createSeq) => {
        if (createErr) {
          cb(createErr);
          return;
        }
        if (!_.isNull(createSeq)) {
          doc[sequence._options.inc_field] = createSeq;
          cb();
        } else {
          sequence._setNextCounter(doc, (setError, setSeq) => {
            if (setError) {
              cb(setError);
              return;
            }
            doc[sequence._options.inc_field] = setSeq;
            cb();
          });
        }
      });
    };
  };

  /**
   * Set and handler for some hooks on the schema referenced by this sequence
   *
   * @method     _setHooks
   */
  Sequence.prototype._setHooks = function () {
    if (this._options.parallel_hooks) {
      this._schema.pre('save', true, this._getPreSaveHook());
    } else {
      this._schema.pre('save', this._getPreSaveHook());
    }
  };

  /**
   * Set some useful methods on the schema
   *
   * @method     _setMethods
   */
  Sequence.prototype._setMethods = function () {
    // this._schema.static('getNext', function(id, referenceValue, callback) {
    //     this._counterModel.getNext(id, referenceValue, function(err, counter) {
    //         if (err) return callback(err);
    //         return callback(null, ++counter.seq);
    //     });
    // }.bind(this));

    this._schema.method('setNext', function (id, callback) {
      const sequence = sequenceArchive.getSequence(id);

      if (_.isNull(sequence)) {
        callback(new Error(`Trying to increment a wrong sequence using the id ${id}`));
        return;
      }
      // sequence = sequence.sequence;

      sequence._createCounter(this, (createError, createSeq) => {
        if (createError) {
          callback(createError);
          return;
        }
        if (!_.isNull(createSeq)) {
          this[sequence._options.inc_field] = createSeq;
          this.save(callback);
        } else {
          sequence._setNextCounter(this, (setError, setSeq) => {
            if (setError) {
              callback(setError);
              return;
            }
            this[sequence._options.inc_field] = setSeq;
            this.save(callback);
          });
        }
      });
    });

    this._schema.static('counterReset', (id, reference, callback) => {
      const sequence = sequenceArchive.getSequence(id);
      sequence._resetCounter(id, reference, callback);
    });
  };

  Sequence.prototype._resetCounter = function (id, reference, callback) {
    const condition = { id };
    let cb = callback;
    let seq = 0;
    if (reference instanceof Function) {
      cb = reference;
    } else {
      condition.reference_value = this._getCounterReferenceField(reference);
    }
    if (this._options.start_seq) seq = this._options.start_seq - 1;
    this._counterModel.updateMany(condition, { $set: { seq } }, null, cb);
  };

  /**
   * Utility function to increment a counter in a transaction
   *
   * @method     _setNextCounter
   * @param      {object}    doc       A mongoose model which need to receive the
   *                                   increment
   * @param      {Function}  callback  Called with the sequence counter
   */
  Sequence.prototype._setNextCounter = function (doc, callback) {
    const retriable = (cb) => {
      const id = this.getId();
      const referenceValue = this._getCounterReferenceField(doc);
      const incAmount = this._options.inc_amount;
      this._counterModel.findOneAndUpdate(
        { id, reference_value: referenceValue },
        { $inc: { seq: incAmount } },
        { new: true, upsert: false },
        (err, counter) => {
          if (err) return cb(err);
          return cb(null, counter.seq);
        },
      );
    };

    async.retry(0, retriable, callback);
  };

  /**
 * Utility function to create a record in counter before incrementing
 *
 * @method     _createCounter
 * @param      {object}    doc       A mongoose model which need to receive the
 *                                   increment
 * @param      {Function}  callback  Called with the sequence counter
 */
  Sequence.prototype._createCounter = function (doc, callback) {
    const id = this.getId();
    const referenceValue = this._getCounterReferenceField(doc);
    const startSeq = this._options.start_seq;
    const counterModel = this._counterModel;

    counterModel.findOneAndUpdate(
      {
        id,
        reference_value: referenceValue,
      },
      {},
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        rawResult: true,
      },
      (err, counter) => {
        // mongodb issues parallel upsert with primary key
        // #Ref: https://jira.mongodb.org/browse/SERVER-14322
        // #Ref: https://docs.mongodb.com/manual/reference/method/db.collection.update/#use-unique-indexes
        if (err && err.code !== 11000) {
          return callback(err);
        }
        // lastErrorObject.updatedExisting is true if new entry was upserted
        if (_.has(counter, 'lastErrorObject') && !counter.lastErrorObject.updatedExisting) {
          return callback(null, startSeq);
        }
        return callback(null, null);
      },
    );
  };

  return Sequence.getInstance;
};
