/* eslint-env mocha */
const chai = require('chai');

const { assert } = chai;
const async = require('async');
const mongoose = require('mongoose');
const sinon = require('sinon');

const { Schema } = mongoose;
const AutoIncrementFactory = require('../index');

const AutoIncrement = AutoIncrementFactory(mongoose);

mongoose.Promise = global.Promise;

const DB_URL = process.env.MONGODB_TEST_URL || 'mongodb://127.0.0.1/mongoose-sequence-testing';

describe('Basic => ', () => {
  beforeAll(() => {
    mongoose.set('useCreateIndex', true);
    mongoose.set('useFindAndModify', false);
  });

  describe('General', () => {
    it('must be instantiated passing mongoose', () => {
      const AI = AutoIncrementFactory;
      assert.throw(AI, Error);
    });

    it('can pass a generic connection', (done) => {
      const connection = mongoose.createConnection(DB_URL, { useNewUrlParser: true });
      const AI = AutoIncrementFactory(connection);
      const ASchema = new Schema({
        id: Number,
        val: String,
      });
      ASchema.plugin(AI, { inc_field: 'id', id: 'aschemaid' });
      const AModel = connection.model('ASchema', ASchema);
      AModel.create({ val: 'hello' }, err => done(err));
    });
  });


  describe('Global sequences => ', () => {
    beforeAll((done) => {
      mongoose.connection.on('open', done);
      mongoose.connection.on('error', done);
      mongoose.connect(DB_URL, { useNewUrlParser: true });
    });

    afterAll((done) => {
      mongoose.connection.db.dropDatabase((err) => {
        if (err) return done(err);
        return mongoose.disconnect(done);
      });
    });

    describe('a simple id field => ', () => {
      let SimpleField;
      let MainId;
      beforeAll(() => {
        const SimpleFieldSchema = new Schema({
          id: Number,
          val: String,
        });
        SimpleFieldSchema.plugin(AutoIncrement, { inc_field: 'id' });
        SimpleField = mongoose.model('SimpleField', SimpleFieldSchema);

        const MainIdSchema = new Schema({}, { _id: false });
        MainIdSchema.plugin(AutoIncrement);
        MainId = mongoose.model('MainId', MainIdSchema);
      });

      it('using the plugin models gain setNext methods', () => {
        const t = new SimpleField();
        assert.isFunction(t.setNext);
      });

      it('is not possible to set an increment field on a non Number field', () => {
        const UnusedSchema = new Schema({
          id: Number,
          val: String,
        });
        assert.throws(() => {
          UnusedSchema.plugin(AutoIncrement, { inc_field: 'val' });
        }, Error);
      });

      it('is not possible to redefine a sequence', () => {
        const UnusedSchema = new Schema({
          id: Number,
          val: String,
        });
        assert.throws(() => {
          UnusedSchema.plugin(AutoIncrement, { inc_field: 'id' });
          UnusedSchema.plugin(AutoIncrement, { inc_field: 'id' });
        }, 'Counter already defined for field "id"');
      });

      it('creating different documents, the counter field is incremented', (done) => {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 5,

          (callback) => {
            count += 1;
            const t = new SimpleField();
            documents.push(t);
            t.save(callback);
          },

          (err) => {
            if (err) return done(err);
            const ids = documents.map(d => d.id);

            try {
              assert.sameDeepMembers(ids, [1, 2, 3, 4, 5]);
            } catch (e) {
              return done(e);
            }

            return done();
          },

        );
      });

      it('creating different documents with .create, the counter field is incremented', (done) => {
        const documents = [{ val: 1 }, { val: 2 }];

        SimpleField.create(documents, (err, inserted) => {
          if (err) return done(err);
          const ids = inserted.map(d => d.id);

          try {
            assert.sameDeepMembers(ids, [6, 7]);
          } catch (e) {
            return done(e);
          }

          return done();
        });
      });

      it.skip('creating different documents with .insertMany, the counter field is incremented', (done) => {
        const documents = [{ val: 1 }, { val: 2 }];

        SimpleField.insertMany(documents, (err, inserted) => {
          if (err) return done(err);
          const ids = inserted.map(d => d.id);

          try {
            assert.sameDeepMembers(ids, [8, 9]);
          } catch (e) {
            return done(e);
          }

          return done();
        });
      });

      it('handle concurrency (hard to test, just an approximation)', (done) => {
        const documents = [];
        const createNew = function (callback) {
          const t = new SimpleField();
          documents.push(t);
          t.save(callback);
        };
        async.parallel(
          [createNew, createNew],
          (err) => {
            if (err) return done(err);
            try {
              assert.notEqual(documents[0].id, documents[1].id);
            } catch (e) {
              return done(e);
            }

            return done();
          },

        );
      });

      it('can create multiple document in parallel when the sequence is on _id', (done) => {
        async.parallel(
          [
            (callback) => { MainId.create({}, callback); },
            (callback) => { MainId.create({}, callback); },
            (callback) => { MainId.create({}, callback); },
          ],
          done,
        );
      });


      it('updating a document do not increment the counter', (done) => {
        SimpleField.findOne({}, (err, entity) => {
          const { id } = entity;
          entity.val = 'something'; // eslint-disable-line
          entity.save((e) => {
            if (e) return done(e);
            assert.deepEqual(entity.id, id);
            return done();
          });
        });
      });

      it('increment _id if no field is specified', (done) => {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 5,

          (callback) => {
            count += 1;
            const t = new MainId();
            documents.push(t);
            t.save(callback);
          },

          (err) => {
            if (err) return done(err);
            const ids = documents.map(d => d._id);

            try {
              assert.deepEqual([4, 5, 6, 7, 8], ids);
            } catch (e) {
              return done(e);
            }

            return done();
          },

        );
      });

      describe('with a double instantiation => ', () => {
        let DoubleFields;

        beforeAll((done) => {
          const DoubleFieldsSchema = new Schema({
            name: String,
            like: Number,
            score: Number,
          });
          DoubleFieldsSchema.plugin(AutoIncrement, { id: 'like_counter', inc_field: 'like', disable_hooks: true });
          DoubleFieldsSchema.plugin(AutoIncrement, { id: 'score_counter', inc_field: 'score', disable_hooks: true });

          DoubleFields = mongoose.model('DoubleFields', DoubleFieldsSchema);

          const double = DoubleFields({ name: 'me' });
          double.save(done);
        });

        it('incrementes the correct counter', (done) => {
          DoubleFields.findOne({ name: 'me' }, (err, double) => {
            if (err) {
              done(err);
              return;
            }
            double.setNext('like_counter', (e, doubleInstance) => {
              if (e) return done(e);
              assert.isUndefined(doubleInstance.score);
              assert.deepEqual(doubleInstance.like, 1);
              return done();
            });
          });
        });
      });
    });

    describe('a manual increment field => ', () => {
      beforeAll(function (done) {
        const ManualSchema = new Schema({
          name: String,
          membercount: Number,
        });
        ManualSchema.plugin(AutoIncrement, { inc_field: 'membercount', disable_hooks: true });
        this.Manual = mongoose.model('Manual', ManualSchema);
        this.Manual.create([{ name: 't1' }, { name: 't2' }], done);
      });


      it('is not incremented on save', function (done) {
        const t = new this.Manual({});
        t.save((err) => {
          if (err) return done(err);
          assert.notEqual(t.membercount, 1);
          return done();
        });
      });

      it('is incremented manually', function (done) {
        this.Manual.findOne({ name: 't1' }, (err, entity) => {
          if (err) { done(err); return; }
          entity.setNext('membercount', (e, entityInstance) => {
            if (e) return done(e);
            assert.deepEqual(entityInstance.membercount, 1);
            return done();
          });
        });
      });

      it('is incremented manually and the value is already saved', function (done) {
        const { Manual } = this;
        Manual.findOne({ name: 't2' }, (err, entity) => {
          if (err) { done(err); return; }
          entity.setNext('membercount', (e/* , entityInstance */) => {
            if (e) { done(e); return; }
            Manual.findOne({ name: 't2' }, (e1, entityInstance1) => {
              if (e1) { done(e1); return; }
              assert.deepEqual(entityInstance1.membercount, 2);
              done();
            });
          });
        });
      });

      it('is not incremented manually with a wrong sequence id', function (done) {
        this.Manual.findOne({ name: 't1' }, (err, entity) => {
          if (err) { done(err); return; }
          entity.setNext('membercountlol', (e/* , entity */) => {
            assert.isNotNull(e);
            done();
          });
        });
      });
    });

    describe('a counter which referes others fields => ', () => {
      let Composed;

      beforeAll(() => {
        const ComposedSchema = new Schema({
          country: Schema.Types.ObjectId,
          city: String,
          inhabitant: Number,
        });
        ComposedSchema.plugin(AutoIncrement, { id: 'inhabitant_counter', inc_field: 'inhabitant', reference_fields: ['city', 'country'] });
        Composed = mongoose.model('Composed', ComposedSchema);
      });

      it('increment on save', (done) => {
        const t = new Composed({ country: mongoose.Types.ObjectId('59c380f51207391238e7f3f2'), city: 'Paris' });
        t.save((err) => {
          if (err) { done(err); return; }
          assert.deepEqual(t.inhabitant, 1);
          done();
        });
      });

      it('saving a document with the same reference increment the counter', (done) => {
        const t = new Composed({ country: mongoose.Types.ObjectId('59c380f51207391238e7f3f2'), city: 'Paris' });
        t.save((err) => {
          if (err) { done(err); return; }
          assert.deepEqual(t.inhabitant, 2);
          done();
        });
      });

      it('saving with a different reference do not increment the counter', (done) => {
        const t = new Composed({ country: mongoose.Types.ObjectId('59c380f51207391238e7f3f2'), city: 'Carcasonne' });
        t.save((err) => {
          if (err) { done(err); return; }
          assert.deepEqual(t.inhabitant, 1);
          done();
        });
      });
    });

    describe('Reference fields => ', () => {
      describe('defining the sequence => ', () => {
        it('is not possible without specifing an id', () => {
          const UnusedSchema = new Schema({
            country: String,
            city: String,
            inhabitant: Number,
          });
          assert.throws(() => {
            UnusedSchema.plugin(AutoIncrement, { inc_field: 'inhabitant', reference_fields: ['country', 'city'], disable_hooks: true });
          }, Error);
        });
      });

      describe('A counter which referes to other fields with manual increment => ', () => {
        let ComposedManual;
        beforeAll(() => {
          const ComposedManualSchema = new Schema({
            country: String,
            city: String,
            inhabitant: Number,
          });
          ComposedManualSchema.plugin(AutoIncrement, {
            id: 'inhabitant_counter_manual', inc_field: 'inhabitant', reference_fields: ['country', 'city'], disable_hooks: true,
          });
          ComposedManual = mongoose.model('ComposedManual', ComposedManualSchema);
        });

        it('with a manual field do not increment on save', (done) => {
          const t = new ComposedManual({ country: 'France', city: 'Paris' });
          t.save((err) => {
            if (err) { done(err); return; }
            assert.notEqual(t.inhabitant, 1);
            done();
          });
        });

        it('with a manual field increment manually', (done) => {
          ComposedManual.findOne({}, (err, entity) => {
            entity.setNext('inhabitant_counter_manual', (e, entitySaved) => {
              if (e) { done(e); return; }
              assert.deepEqual(entitySaved.inhabitant, 1);
              done();
            });
          });
        });
      });

      describe('Two schema with the same references', () => {
        let RefFirst;
        let RefSecond;

        beforeAll(() => {
          const RefFirstSchema = new Schema({
            country: String,
            city: String,
            inhabitant: Number,
          });
          RefFirstSchema.plugin(AutoIncrement, { id: 'shared_inhabitant_counter', inc_field: 'inhabitant', reference_fields: ['country', 'city'] });
          RefFirst = mongoose.model('RefFirst', RefFirstSchema);

          const RefSecondSchema = new Schema({
            country: String,
            city: String,
            inhabitant: Number,
          });
          RefSecondSchema.plugin(AutoIncrement, { id: 'shared_inhabitant_counter_2', inc_field: 'inhabitant', reference_fields: ['country', 'city'] });
          RefSecond = mongoose.model('RefSecond', RefSecondSchema);
        });

        it('do not share the same counter', (done) => {
          const t = new RefFirst({ country: 'France', city: 'Paris' });
          const t2 = new RefSecond({ country: 'France', city: 'Paris' });
          t.save((err) => {
            if (err) { done(err); return; }
            assert.equal(t.inhabitant, 1);
            t2.save((e) => {
              if (e) { done(e); return; }
              assert.equal(t2.inhabitant, 1);
              done();
            });
          });
        });
      });
    });

    describe('Reset counter => ', () => {
      let ResettableSimple;
      let ResettableWithStartSeq;
      let ResettableComposed;

      beforeAll(() => {
        const ResettableSimpleSchema = new Schema({
          id: Number,
          val: String,
        });
        ResettableSimpleSchema.plugin(AutoIncrement, { id: 'resettable_simple_id', inc_field: 'id' });
        ResettableSimple = mongoose.model('ResettableSimple', ResettableSimpleSchema);

        const ResettableWithStartSeqSchema = new Schema({
          id: Number,
          val: String,
        });
        ResettableWithStartSeqSchema.plugin(AutoIncrement, { id: 'resettable_startseq_id', inc_field: 'id', start_seq: 100 });
        ResettableWithStartSeq = mongoose.model('ResettableWithStartSeq', ResettableWithStartSeqSchema);

        const ResettableComposedSchema = new Schema({
          country: String,
          city: String,
          inhabitant: Number,
        });
        ResettableComposedSchema.plugin(AutoIncrement, {
          id: 'resettable_inhabitant_counter',
          inc_field: 'inhabitant',
          reference_fields: ['country', 'city'],
        });
        ResettableComposed = mongoose.model('ResettableComposed', ResettableComposedSchema);
      });

      beforeEach((done) => {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 5,

          (callback) => {
            count += 1;
            const t = new ResettableSimple();
            documents.push(t);
            t.save(callback);
          },

          done,

        );
      });

      beforeEach((done) => {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 5,

          (callback) => {
            count += 1;
            const t = new ResettableWithStartSeq();
            documents.push(t);
            t.save(callback);
          },

          done,

        );
      });

      beforeEach((done) => {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 3,

          (callback) => {
            count += 1;
            const t = new ResettableComposed({ country: 'a', city: 'a' });
            documents.push(t);
            t.save(callback);
          },

          done,

        );
      });

      beforeEach((done) => {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 3,

          (callback) => {
            count += 1;
            const t = new ResettableComposed({ country: 'b', city: 'b' });
            documents.push(t);
            t.save(callback);
          },

          done,

        );
      });

      it('a model gains a static "counterReset" method', () => {
        assert.isFunction(ResettableSimple.counterReset);
        assert.isFunction(ResettableWithStartSeq.counterReset);
      });

      it('after calling it, the counter is 1', (done) => {
        ResettableSimple.counterReset('resettable_simple_id', (err) => {
          if (err) {
            done(err);
            return;
          }
          const t = new ResettableSimple();
          t.save((e, saved) => {
            if (e) {
              done(e);
              return;
            }
            assert.deepEqual(saved.id, 1);
            done();
          });
        });
      });

      it('after calling it, the counter is 100', (done) => {
        ResettableWithStartSeq.counterReset('resettable_startseq_id', (err) => {
          if (err) {
            done(err);
            return;
          }
          const t = new ResettableWithStartSeq();
          t.save((e, saved) => {
            if (e) {
              done(e);
              return;
            }
            assert.deepEqual(saved.id, 100);
            done();
          });
        });
      });

      it('for a referenced counter, the counter is 1 for any reference', (done) => {
        ResettableComposed.counterReset('resettable_inhabitant_counter', (err) => {
          if (err) {
            done(err);
            return;
          }
          const tA = new ResettableComposed({ country: 'a', city: 'a' });
          const tB = new ResettableComposed({ country: 'b', city: 'b' });
          tA.save((e, tAsaved) => {
            if (e) {
              done(e);
              return;
            }
            tB.save((errB, tBsaved) => {
              if (errB) {
                done(errB);
                return;
              }
              assert.deepEqual(tAsaved.inhabitant, 1);
              assert.deepEqual(tBsaved.inhabitant, 1);
              done();
            });
          });
        });
      });

      it('for a referenced counter with a specific value, the counter is 1 for that reference', (done) => {
        ResettableComposed.counterReset(
          'resettable_inhabitant_counter',
          { country: 'a', city: 'a' },
          (err) => {
            if (err) {
              done(err);
              return;
            }
            const tA = new ResettableComposed({ country: 'a', city: 'a' });
            const tB = new ResettableComposed({ country: 'b', city: 'b' });
            tA.save((e, tAsaved) => {
              if (e) {
                done(e);
                return;
              }
              tB.save((errB, tBsaved) => {
                if (errB) {
                  done(errB);
                  return;
                }
                assert.deepEqual(tAsaved.inhabitant, 1);
                assert.notEqual(tBsaved.inhabitant, 1);
                done();
              });
            });
          },
        );
      });
    });

    describe('Error on hook', () => {
      let SimpleField;

      beforeAll(function (done) {
        const SimpleFieldSchema = new Schema({
          id: Number,
          val: String,
        });

        SimpleFieldSchema.plugin((schema, options) => {
          const sequence = AutoIncrement(schema, options);
          sinon.stub(sequence._counterModel, 'findOneAndUpdate').yields(new Error('Incrementing error'));
          return sequence;
        }, { id: 'simple_with_error_counter', inc_field: 'id' });
        SimpleField = mongoose.model('SimpleFieldWithError', SimpleFieldSchema);

        const ManualSchema = new Schema({
          name: String,
          membercount: Number,
        });
        ManualSchema.plugin((schema, options) => {
          const sequence = AutoIncrement(schema, options);
          sinon.stub(sequence, '_createCounter').yields(new Error('Incrementing error'));
          return sequence;
        }, { id: 'errored_manual_counter', inc_field: 'membercount', disable_hooks: true });
        this.Manual = mongoose.model('ManualWithError', ManualSchema);
        this.Manual.create([{ name: 't1' }, { name: 't2' }], done);
      });

      it('do not save the document if an error happens in the plugin', (done) => {
        const t = new SimpleField();
        t.save((err) => {
          assert.isOk(err);
          assert.instanceOf(err, Error);
          done();
        });
      });

      it('do not save the document after a manual incrementation if an error happens in the plugin', function (done) {
        this.Manual.findOne({ name: 't1' }, (err, entity) => {
          if (err) { done(err); return; }
          entity.setNext('errored_manual_counter', (e/* , saved */) => {
            assert.isOk(e);
            assert.instanceOf(e, Error);
            done();
          });
        });
      });
    });

    describe('Parallel/Sequential hook behavior => ', () => {
      describe('hook is registered as parallel => ', () => {
        it('does not pass updated increment value to next hook', (done) => {
          const ParallelHooksSchema = new Schema({
            parallel_id: Number,
            val: String,
          });

          ParallelHooksSchema.plugin(AutoIncrement, { inc_field: 'parallel_id', parallel_hooks: true });
          ParallelHooksSchema.pre('save', function (next) {
            assert.isUndefined(this.parallel_id);
            next();
          });
          const ParallelHooks = mongoose.model('ParallelHooks', ParallelHooksSchema);
          ParallelHooks.create({ val: 't1' }, done);
        });
      });

      describe('hook is registered as sequential => ', () => {
        it('passes updated increment value to next hook', (done) => {
          const SequentialHooksSchema = new Schema({
            sequential_id: Number,
            val: String,
          });

          SequentialHooksSchema.plugin(AutoIncrement, { inc_field: 'sequential_id', parallel_hooks: false });
          SequentialHooksSchema.pre('save', function (next) {
            assert.isDefined(this.sequential_id);
            next();
          });
          const SequentialHooks = mongoose.model('SequentialHooks', SequentialHooksSchema);
          SequentialHooks.create({ val: 't1' }, done);
        });
      });
    });

    describe('Increment nested fields =>', () => {
      describe('Automatic increment on creation =>', () => {
        let NestedField;

        beforeAll(() => {
          const NestedFieldSchema = new Schema({
            parent: { nested: { type: Number } },
          });
          NestedFieldSchema.plugin(AutoIncrement, { inc_field: 'parent.nested' });
          NestedField = mongoose.model('NestedField', NestedFieldSchema);
        });

        it('populates the nested fields with incremented values', (done) => {
          let count = 0;
          const documents = [];

          async.whilst(
            () => count < 5,

            (callback) => {
              count += 1;
              const t = new NestedField();
              documents.push(t);
              t.save(callback);
            },

            (err) => {
              if (err) return done(err);
              const nestedValues = documents.map(d => d.parent.nested);

              try {
                assert.sameDeepMembers(nestedValues, [1, 2, 3, 4, 5]);
              } catch (e) {
                return done(e);
              }

              return done();
            },
          );
        });
      });

      describe('Manual increment =>', () => {
        let NestedManual;
        beforeAll(() => {
          const NestedManualFieldSchema = new Schema({
            name: { type: String },
            parent: { nested: { type: Number } },
          });
          NestedManualFieldSchema.plugin(AutoIncrement, {
            id: 'nested_manual_seq',
            inc_field: 'parent.nested',
            disable_hooks: true,
          });
          NestedManual = mongoose.model('NestedManualField', NestedManualFieldSchema);
          NestedManual.create([{ name: 't1' }, { name: 't2' }]);
        });

        it('is not incremented on save', (done) => {
          const t = new NestedManual({});
          t.save((err) => {
            if (err) return done(err);
            assert.notEqual(t.parent.nested, 1);
            return done();
          });
        });

        it('is incremented manually', (done) => {
          NestedManual.findOne({ name: 't1' }, (err, entity) => {
            if (err) {
              done(err);
              return;
            }
            entity.setNext('nested_manual_seq', (e, entityInstance) => {
              if (e) return done(e);
              assert.deepEqual(entityInstance.parent.nested, 1);
              return done();
            });
          });
        });
      });
    });
  });
});
