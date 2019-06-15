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
  before(() => {
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
    before((done) => {
      mongoose.connection.on('open', done);
      mongoose.connection.on('error', done);
      mongoose.connect(DB_URL, { useNewUrlParser: true });
    });

    after((done) => {
      mongoose.connection.db.dropDatabase((err) => {
        if (err) return done(err);
        return mongoose.disconnect(done);
      });
    });

    describe('a simple id field => ', () => {
      before(function () {
        const SimpleFieldSchema = new Schema({
          id: Number,
          val: String,
        });
        SimpleFieldSchema.plugin(AutoIncrement, { inc_field: 'id' });
        this.SimpleField = mongoose.model('SimpleField', SimpleFieldSchema);

        const MainIdSchema = new Schema({}, { _id: false });
        MainIdSchema.plugin(AutoIncrement);
        this.MainId = mongoose.model('MainId', MainIdSchema);
      });

      it('using the plugin models gain setNext methods', function () {
        const t = new this.SimpleField();
        assert.isFunction(t.setNext);
      });

      it('is not possible to set an incremente field on a non Number field', () => {
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

      it('creating different documents, the counter field is incremented', function (done) {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 5,

          (callback) => {
            count += 1;
            const t = new this.SimpleField();
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

      it('creating different documents with .create, the counter field is incremented', function (done) {
        const documents = [{ val: 1 }, { val: 2 }];

        this.SimpleField.create(documents, (err, inserted) => {
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

      xit('creating different documents with .insertMany, the counter field is incremented', function (done) {
        const documents = [{ val: 1 }, { val: 2 }];

        this.SimpleField.insertMany(documents, (err, inserted) => {
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

      it('handle concurrency (hard to test, just an approximation)', function (done) {
        const documents = [];
        const createNew = function (callback) {
          const t = new this.SimpleField();
          documents.push(t);
          t.save(callback);
        }.bind(this);
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

      it('can create multiple document in parallel when the sequence is on _id', function (done) {
        async.parallel(
          [
            function (callback) { this.MainId.create({}, callback); }.bind(this),
            function (callback) { this.MainId.create({}, callback); }.bind(this),
            function (callback) { this.MainId.create({}, callback); }.bind(this),
          ],
          done,
        );
      });


      it('updating a document do not increment the counter', function (done) {
        this.SimpleField.findOne({}, (err, entity) => {
          const { id } = entity;
          entity.val = 'something'; // eslint-disable-line
          entity.save((e) => {
            if (e) return done(e);
            assert.deepEqual(entity.id, id);
            return done();
          });
        });
      });

      it('increment _id if no field is specified', function (done) {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 5,

          (callback) => {
            count += 1;
            const t = new this.MainId();
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

      describe('with a doulbe instantiation => ', () => {
        before(function (done) {
          const DoubleFieldsSchema = new Schema({
            name: String,
            like: Number,
            score: Number,
          });
          DoubleFieldsSchema.plugin(AutoIncrement, { id: 'like_counter', inc_field: 'like', disable_hooks: true });
          DoubleFieldsSchema.plugin(AutoIncrement, { id: 'score_counter', inc_field: 'score', disable_hooks: true });

          this.DoubleFields = mongoose.model('DoubleFields', DoubleFieldsSchema);

          const double = this.DoubleFields({ name: 'me' });
          double.save(done);
        });

        it('incrementes the correct counter', function (done) {
          this.DoubleFields.findOne({ name: 'me' }, (err, double) => {
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
      before(function (done) {
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
      before(function () {
        const ComposedSchema = new Schema({
          country: Schema.Types.ObjectId,
          city: String,
          inhabitant: Number,
        });
        ComposedSchema.plugin(AutoIncrement, { id: 'inhabitant_counter', inc_field: 'inhabitant', reference_fields: ['city', 'country'] });
        this.Composed = mongoose.model('Composed', ComposedSchema);
      });

      it('increment on save', function (done) {
        const t = new this.Composed({ country: mongoose.Types.ObjectId('59c380f51207391238e7f3f2'), city: 'Paris' });
        t.save((err) => {
          if (err) { done(err); return; }
          assert.deepEqual(t.inhabitant, 1);
          done();
        });
      });

      it('saving a document with the same reference increment the counter', function (done) {
        const t = new this.Composed({ country: mongoose.Types.ObjectId('59c380f51207391238e7f3f2'), city: 'Paris' });
        t.save((err) => {
          if (err) { done(err); return; }
          assert.deepEqual(t.inhabitant, 2);
          done();
        });
      });

      it('saving with a different reference do not increment the counter', function (done) {
        const t = new this.Composed({ country: mongoose.Types.ObjectId('59c380f51207391238e7f3f2'), city: 'Carcasonne' });
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
        before(function createSimpleSchemas() {
          const ComposedManualSchema = new Schema({
            country: String,
            city: String,
            inhabitant: Number,
          });
          ComposedManualSchema.plugin(AutoIncrement, {
            id: 'inhabitant_counter_manual', inc_field: 'inhabitant', reference_fields: ['country', 'city'], disable_hooks: true,
          });
          this.ComposedManual = mongoose.model('ComposedManual', ComposedManualSchema);
        });

        it('with a manual field do not increment on save', function (done) {
          const t = new this.ComposedManual({ country: 'France', city: 'Paris' });
          t.save((err) => {
            if (err) { done(err); return; }
            assert.notEqual(t.inhabitant, 1);
            done();
          });
        });

        it('with a manual field increment manually', function (done) {
          this.ComposedManual.findOne({}, (err, entity) => {
            entity.setNext('inhabitant_counter_manual', (e, entitySaved) => {
              if (e) { done(e); return; }
              assert.deepEqual(entitySaved.inhabitant, 1);
              done();
            });
          });
        });
      });

      describe('Two schema with the samere references', () => {
        before(function createTwoSchemas() {
          const RefFirstSchema = new Schema({
            country: String,
            city: String,
            inhabitant: Number,
          });
          RefFirstSchema.plugin(AutoIncrement, { id: 'shared_inhabitant_counter', inc_field: 'inhabitant', reference_fields: ['country', 'city'] });
          this.RefFirst = mongoose.model('RefFirst', RefFirstSchema);

          const RefSecondSchema = new Schema({
            country: String,
            city: String,
            inhabitant: Number,
          });
          RefSecondSchema.plugin(AutoIncrement, { id: 'shared_inhabitant_counter_2', inc_field: 'inhabitant', reference_fields: ['country', 'city'] });
          this.RefSecond = mongoose.model('RefSecond', RefSecondSchema);
        });

        it('do not share the same counter', function (done) {
          const t = new this.RefFirst({ country: 'France', city: 'Paris' });
          const t2 = new this.RefSecond({ country: 'France', city: 'Paris' });
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
      before(function () {
        const ResettableSimpleSchema = new Schema({
          id: Number,
          val: String,
        });
        ResettableSimpleSchema.plugin(AutoIncrement, { id: 'resettable_simple_id', inc_field: 'id' });
        this.ResettableSimple = mongoose.model('ResettableSimple', ResettableSimpleSchema);

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
        this.ResettableComposed = mongoose.model('ResettableComposed', ResettableComposedSchema);
      });

      beforeEach('create simple resettable documents', function (done) {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 5,

          (callback) => {
            count += 1;
            const t = new this.ResettableSimple();
            documents.push(t);
            t.save(callback);
          },

          done,

        );
      });

      beforeEach('create resettable reference document (a)', function (done) {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 3,

          (callback) => {
            count += 1;
            const t = new this.ResettableComposed({ country: 'a', city: 'a' });
            documents.push(t);
            t.save(callback);
          },

          done,

        );
      });

      beforeEach('create resettable reference document (b)', function (done) {
        let count = 0;
        const documents = [];

        async.whilst(
          () => count < 3,

          (callback) => {
            count += 1;
            const t = new this.ResettableComposed({ country: 'b', city: 'b' });
            documents.push(t);
            t.save(callback);
          },

          done,

        );
      });

      it('a model gains a static "counterReset" method', function () {
        assert.isFunction(this.ResettableSimple.counterReset);
      });

      it('after calling it, the counter is 1', function (done) {
        this.ResettableSimple.counterReset('resettable_simple_id', (err) => {
          if (err) {
            done(err);
            return;
          }
          const t = new this.ResettableSimple();
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

      it('for a referenced counter, the counter is 1 for any reference', function (done) {
        this.ResettableComposed.counterReset('resettable_inhabitant_counter', (err) => {
          if (err) {
            done(err);
            return;
          }
          const tA = new this.ResettableComposed({ country: 'a', city: 'a' });
          const tB = new this.ResettableComposed({ country: 'b', city: 'b' });
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

      it('for a referenced counter with a specific value, the counter is 1 for that reference', function (done) {
        this.ResettableComposed.counterReset(
          'resettable_inhabitant_counter',
          { country: 'a', city: 'a' },
          (err) => {
            if (err) {
              done(err);
              return;
            }
            const tA = new this.ResettableComposed({ country: 'a', city: 'a' });
            const tB = new this.ResettableComposed({ country: 'b', city: 'b' });
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
      before(function (done) {
        const SimpleFieldSchema = new Schema({
          id: Number,
          val: String,
        });

        SimpleFieldSchema.plugin((schema, options) => {
          const sequence = AutoIncrement(schema, options);
          sinon.stub(sequence._counterModel, 'findOneAndUpdate').yields(new Error('Incrementing error'));
          return sequence;
        }, { id: 'simple_with_error_counter', inc_field: 'id' });
        this.SimpleField = mongoose.model('SimpleFieldWithError', SimpleFieldSchema);

        const ManualSchema = new Schema({
          name: String,
          membercount: Number,
        });
        ManualSchema.plugin((schema, options) => {
          const sequence = AutoIncrement(schema, options);
          sinon.stub(sequence, '_setNextCounter').yields(new Error('Incrementing error'));
          return sequence;
        }, { id: 'errored_manual_counter', inc_field: 'membercount', disable_hooks: true });
        this.Manual = mongoose.model('ManualWithError', ManualSchema);
        this.Manual.create([{ name: 't1' }, { name: 't2' }], done);
      });

      it('do not save the document if an error happens in the plugin', function (done) {
        const t = new this.SimpleField();
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
  });
});
