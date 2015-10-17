var _ = require('lodash'),
    singleton = null,
    SequenceArchive;
/**
 * Instantiate a new sequence archive
 * @classdesc Store definied sequences
 * @class
 */
SequenceArchive = function() {
    this.sequences = [];
};

/**
 * Add a new sequence to the archive
 * @param {array} reference The reference for the archive. Is an array of fields
 * @param {Autoincrement} sequence  A sequence
 */
SequenceArchive.prototype.addSequence = function(reference, sequence) {
    if (!this.existsSequence(reference)) {
        this.sequences.push(
            {
                reference: reference,
                sequence: sequence
            }
        );
    }
};

SequenceArchive.prototype.getSequence = function(reference) {
    var seq;
    for (var i = 0, len = this.sequences.length; i < len; i++) {
        seq = this.sequences[i];
        if (_.isEqual(seq.reference.sort(), reference.sort()))
            return seq;
    }

    return null;
};

SequenceArchive.prototype.existsSequence = function(reference) {
    var seq;
    for (var i = 0, len = this.sequences.length; i < len; i++) {
        seq = this.sequences[i];
        if (_.isEqual(seq.reference.sort(), reference.sort()))
            return true;
    }

    return false;
};

SequenceArchive.getSingleton = function() {
    if (!singleton) {
        singleton = new SequenceArchive();
    }

    return singleton;
};

module.exports = SequenceArchive;
