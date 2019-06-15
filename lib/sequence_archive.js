const _ = require('lodash');

/**
 * Create a new sequence archive
 */
const SequenceArchive = () => {
  const sequences = [];


  /**
   * Check if a sequence already exists
   *
   * @param      {string}   id      The id of the sequence to look for
   * @return     {boolean}
   */
  const existsSequence = (id) => {
    let seq;
    for (let i = 0, len = sequences.length; i < len; i++) {
      seq = sequences[i];
      if (_.isEqual(seq.id, id)) return true;
    }
    return false;
  };

  /**
  * Add a new sequence to the archive
  *
  * @param      {array}          id        The id of the sequence
  * @param      {Autoincrement}  sequence  A sequence
  */
  const addSequence = (id, sequence) => {
    if (!existsSequence(id)) {
      sequences.push({ id, sequence });
    }
  };

  /**
  * Get a sequence by id
  *
  * @param      {string}  id      An id for the sequence
  * @return     {object|null}  Return the found sequence or null
  */
  const getSequence = (id) => {
    let seq;
    for (let i = 0, len = sequences.length; i < len; i++) {
      seq = sequences[i];
      if (_.isEqual(seq.id, id)) return seq.sequence;
    }
    return null;
  };

  return {
    existsSequence,
    addSequence,
    getSequence,
  };
};

let singleton = null;

/**
 * Get a singleton SequenceArchive
 *
 * @return     {SequenceArchive}  A unique instance of SequenceArchive
 */
SequenceArchive.getSingleton = function () {
  if (!singleton) {
    singleton = SequenceArchive();
  }

  return singleton;
};

module.exports = SequenceArchive;
