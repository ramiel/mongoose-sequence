/**
 * Create a new sequence archive
 */
const SequenceArchive = () => {
  const sequences = new Map();

  /**
   * Check if a sequence already exists
   *
   * @param      {string}   id      The id of the sequence to look for
   * @return     {boolean}
   */
  const existsSequence = (id) => sequences.has(id);

  /**
   * Add a new sequence to the archive
   *
   * @param      {array}          id        The id of the sequence
   * @param      {Autoincrement}  sequence  A sequence
   */
  const addSequence = (id, sequence) => {
    if (!existsSequence(id)) {
      sequences.set(id, sequence);
    }
  };

  /**
   * Get a sequence by id
   *
   * @param      {string}  id      An id for the sequence
   * @return     {object|null}  Return the found sequence or null
   */
  const getSequence = (id) => sequences.get(id) || null;

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
