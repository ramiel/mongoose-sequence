var _ = require('lodash'),
    singleton = null,
    SequenceArchive;
/**
 * Instantiate a new sequence archive
 * @classdesc  Store definied sequences
 *
 * @class
 */
SequenceArchive = function() {
    this.sequences = [];
};

/**
 * Add a new sequence to the archive
 *
 * @method     addSequence
 * @param      {array}          id        The id of the sequence
 * @param      {Autoincrement}  sequence  A sequence
 */
SequenceArchive.prototype.addSequence = function(id, sequence) {
    if (!this.existsSequence(id)) {
        this.sequences.push(
            {
                id: id,
                sequence: sequence
            }
        );
    }
};

/**
 * Get a sequence by id
 *
 * @method     getSequence
 * @param      {string}  id      An id for the sequence
 * @return     {object|null}  Return the found sequence or null
 */
SequenceArchive.prototype.getSequence = function(id) {
    var seq;
    for (var i = 0, len = this.sequences.length; i < len; i++) {
        seq = this.sequences[i];
        if (_.isEqual(seq.id, id))
            return seq.sequence;
    }

    return null;
};

/**
 * Check if a sequence already exists
 *
 * @method     existsSequence
 * @param      {string}   id      The id of the sequence to look for
 * @return     {boolean}  
 */
SequenceArchive.prototype.existsSequence = function(id) {
    var seq;
    for (var i = 0, len = this.sequences.length; i < len; i++) {
        seq = this.sequences[i];
        if (_.isEqual(seq.id, id))
            return true;
    }

    return false;
};

/**
 * Get a singleton SequenceArchive
 *
 * @method     getSingleton
 * @return     {SequenceArchive}  A unique instance of SequenceArchive
 */
SequenceArchive.getSingleton = function() {
    if (!singleton) {
        singleton = new SequenceArchive();
    }

    return singleton;
};

module.exports = SequenceArchive;
