/*eslint-env mocha */
var chai = require('chai'),
    assert = chai.assert,
    async = require('async'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    AutoIncrement = require('../index'),
    sinon = require('sinon');

mongoose.Promise = global.Promise;

describe('Basic => ', function() {

    before(function connection(done) {
        mongoose.connection.on('open', done);
        mongoose.connection.on('error', done);
        mongoose.connect('mongodb://127.0.0.1/mongoose-sequence-testing');
    });

    after(function destroyingAll(done) {
        mongoose.connection.db.dropDatabase(function(err) {
            if (err) return done(err);
            mongoose.disconnect(done);
        });
    });



    describe('Global sequences => ', function() {

        describe('a simple id field => ', function() {

            before(function() {
                var SimpleFieldSchema = new Schema({
                    id: Number,
                    val: String
                });
                SimpleFieldSchema.plugin(AutoIncrement, {inc_field: 'id'});
                this.SimpleField = mongoose.model('SimpleField', SimpleFieldSchema);

                var MainIdSchema = new Schema({}, { _id: false });
                MainIdSchema.plugin(AutoIncrement);
                this.MainId = mongoose.model('MainId', MainIdSchema);
            });

            it('using the plugin models gain setNext methods', function() {
                var t = new this.SimpleField();
                assert.isFunction(t.setNext);
            });

            it('is not possible to set an incremente field on a non Number field', function(){
                var UnusedSchema = new Schema({
                    id: Number,
                    val: String
                });
                assert.throws(function(){
                    UnusedSchema.plugin(AutoIncrement, {inc_field: 'val'});
                }, Error);
            });

            it('is not possible to redefine a sequence', function(){
                var UnusedSchema = new Schema({
                    id: Number,
                    val: String
                });
                assert.throws(function(){
                    UnusedSchema.plugin(AutoIncrement, {inc_field: 'id'});
                    UnusedSchema.plugin(AutoIncrement, {inc_field: 'id'});
                }, 'Counter already defined for field "id"');
            });

            it('creating different documents, the counter field is incremented', function(done) {
                var count = 0,
                    documents = [];

                async.whilst(
                    function() { return count < 5; },

                    function(callback) {
                        count++;
                        var t = new this.SimpleField();
                        documents.push(t);
                        t.save(callback);
                    }.bind(this),

                    function(err) {
                        if (err) return done(err);
                        var ids = documents.map(function(d) {return d.id;});

                        try {
                            assert.sameDeepMembers(ids, [1, 2, 3, 4, 5]);
                        }catch (e) {
                            return done(e);
                        }

                        return done();
                    }

                );
            });

            it('creating different documents with .create, the counter field is incremented', function(done) {
                var documents = [{val: 1}, {val: 2}];

                this.SimpleField.create(documents, function(err, inserted) {
                    if (err) return done(err);
                    var ids = inserted.map(function(d) {return d.id;});

                    try {
                        assert.sameDeepMembers(ids, [6, 7]);
                    }catch (e) {
                        return done(e);
                    }

                    return done();
                });
            });

            xit('creating different documents with .insertMany, the counter field is incremented', function(done) {
                var documents = [{val: 1}, {val: 2}];

                this.SimpleField.insertMany(documents, function(err, inserted) {
                    if (err) return done(err);
                    var ids = inserted.map(function(d) {return d.id;});

                    try {
                        assert.sameDeepMembers(ids, [8, 9]);
                    }catch (e) {
                        return done(e);
                    }

                    return done();
                });
            });

            it('handle concurrency (hard to test, just an approximation)', function(done) {
                var documents = [],
                    createNew = function(callback) {
                        var t = new this.SimpleField();
                        documents.push(t);
                        t.save(callback);
                    }.bind(this);
                async.parallel(
                    [createNew, createNew],
                    function(err) {
                        if (err) return done(err);
                        try {
                            assert.notEqual(documents[0].id, documents[1].id);
                        }catch (e) {
                            return done(e);
                        }

                        done();
                    }

                );
            });

            it('updating a document do not increment the counter', function(done) {
                this.SimpleField.findOne({}, function(err, entity) {
                    var id = entity.id;
                    entity.val = 'something';
                    entity.save(function(err) {
                        if (err) return done(err);
                        assert.deepEqual(entity.id, id);
                        done();
                    });
                });
            });

            it('increment _id if no field is specified', function(done) {
                var count = 0,
                    documents = [];

                async.whilst(
                    function() { return count < 5; },

                    function(callback) {
                        count++;
                        var t = new this.MainId();
                        documents.push(t);
                        t.save(callback);
                    }.bind(this),

                    function(err) {
                        if (err) return done(err);
                        var ids = documents.map(function(d) {return d._id;});

                        try {
                            assert.deepEqual(ids, [1, 2, 3, 4, 5]);
                        }catch (e) {
                            return done(e);
                        }

                        done();
                    }

                );
            });

            describe('with a doulbe instantiation => ', function(){

                before(function(done){
                    var DoubleFieldsSchema = new Schema({
                        name: String,
                        like: Number,
                        score: Number
                    });
                    DoubleFieldsSchema.plugin(AutoIncrement, {id: 'like_counter', inc_field: 'like', disable_hooks: true});
                    DoubleFieldsSchema.plugin(AutoIncrement, {id: 'score_counter', inc_field: 'score', disable_hooks: true});

                    this.DoubleFields = mongoose.model('DoubleFields', DoubleFieldsSchema);

                    var double = this.DoubleFields({name: 'me'});
                    double.save(done);
                });

                it('incrementes the correct counter', function(done){
                    this.DoubleFields.findOne({name: 'me'}, function(err, double){
                        if(err) return done(err);
                        double.setNext('like_counter', function(err, double){
                            if(err) return done(err);
                            assert.isUndefined(double.score);
                            assert.deepEqual(double.like, 1);
                            done();
                        });
                    });
                });
            });

        });

        describe('a manual increment field => ', function() {

            before(function(done) {
                var ManualSchema = new Schema({
                    name: String,
                    membercount: Number
                });
                ManualSchema.plugin(AutoIncrement, {inc_field: 'membercount', disable_hooks: true});
                this.Manual = mongoose.model('Manual', ManualSchema);
                this.Manual.create([{name: 't1'},{name: 't2'}], done);

            });


            it('is not incremented on save', function(done) {
                var t = new this.Manual({});
                t.save(function(err) {
                    if (err) return done(err);
                    assert.notEqual(t.membercount, 1);
                    done();
                });
            });

            it('is incremented manually', function(done) {
                this.Manual.findOne({name: 't1'}, function(err, entity) {
                    if(err) return done(err);
                    entity.setNext('membercount', function(err, entity) {
                        if (err) return done(err);
                        assert.deepEqual(entity.membercount, 1);
                        done();
                    });
                });
            });

            it('is incremented manually and the value is already saved', function(done) {
                var Manual = this.Manual;
                Manual.findOne({name: 't2'}, function(err, entity) {
                    if(err) return done(err);
                    entity.setNext('membercount', function(err, entity) {
                        if (err) return done(err);
                        Manual.findOne({name: 't2'}, function(err, entity){
                            if (err) return done(err);
                            assert.deepEqual(entity.membercount, 2);
                            done();
                        });
                    });
                });
            });

            it('is not incremented manually with a wrong sequence id', function(done) {
                this.Manual.findOne({name: 't1'}, function(err, entity) {
                    if(err) return done(err);
                    entity.setNext('membercountlol', function(err, entity) {
                        assert.isNotNull(err);
                        done();
                    });
                });
            });

        });

        describe('a counter which referes others fields => ', function() {

            before(function() {
                var ComposedSchema = new Schema({
                    country: String,
                    city: String,
                    inhabitant: Number
                });
                ComposedSchema.plugin(AutoIncrement, {id: 'inhabitant_counter', inc_field: 'inhabitant', reference_fields: ['country', 'city']});
                this.Composed = mongoose.model('Composed', ComposedSchema);
            });

            it('increment on save', function(done) {
                var t = new this.Composed({country:'France', city:'Paris'});
                t.save(function(err) {
                    if (err) return done(err);
                    assert.deepEqual(t.inhabitant, 1);
                    done();
                });
            });

            it('saving a document with the same reference increment the counter', function(done) {
                var t = new this.Composed({country:'France', city:'Paris'});
                t.save(function(err) {
                    if (err) return done(err);
                    assert.deepEqual(t.inhabitant, 2);
                    done();
                });
            });

            it('saving with a different reference do not increment the counter', function(done) {
                var t = new this.Composed({country:'USA', city:'New York'});
                t.save(function(err) {
                    if (err) return done(err);
                    assert.deepEqual(t.inhabitant, 1);
                    done();
                });
            });

        });

        describe('Reference fields => ', function(){

            describe('defining the sequence => ', function(){

                it('is not possible without specifing an id', function(){
                    var UnusedSchema = new Schema({
                        country: String,
                        city: String,
                        inhabitant: Number
                    });
                    assert.throws(function(){
                        UnusedSchema.plugin(AutoIncrement, {inc_field: 'inhabitant', reference_fields: ['country', 'city'], disable_hooks: true});
                    }, Error);

                });
            });

            describe('A counter which referes to other fields with manual increment => ', function() {

                before(function createSimpleSchemas() {
                    var ComposedManualSchema = new Schema({
                        country: String,
                        city: String,
                        inhabitant: Number
                    });
                    ComposedManualSchema.plugin(AutoIncrement, {id:'inhabitant_counter_manual', inc_field: 'inhabitant', reference_fields: ['country', 'city'], disable_hooks: true});
                    this.ComposedManual = mongoose.model('ComposedManual', ComposedManualSchema);
                });

                it('with a manual field do not increment on save', function(done) {
                    var t = new this.ComposedManual({country:'France', city:'Paris'});
                    t.save(function(err) {
                        if (err) return done(err);
                        assert.notEqual(t.inhabitant, 1);
                        done();
                    });
                });

                it('with a manual field increment manually', function(done) {
                    this.ComposedManual.findOne({}, function(err, entity) {
                        entity.setNext('inhabitant_counter_manual', function(err, entity) {
                            if (err) return done(err);
                            assert.deepEqual(entity.inhabitant, 1);
                            done();
                        });
                    });
                });

            });

            describe('Two schema with the samere references', function(){

                before(function createTwoSchemas() {
                    var RefFirstSchema = new Schema({
                        country: String,
                        city: String,
                        inhabitant: Number
                    });
                    RefFirstSchema.plugin(AutoIncrement, {id:'shared_inhabitant_counter', inc_field: 'inhabitant', reference_fields: ['country', 'city']});
                    this.RefFirst = mongoose.model('RefFirst', RefFirstSchema);

                    var RefSecondSchema = new Schema({
                        country: String,
                        city: String,
                        inhabitant: Number
                    });
                    RefSecondSchema.plugin(AutoIncrement, {id:'shared_inhabitant_counter_2', inc_field: 'inhabitant', reference_fields: ['country', 'city']});
                    this.RefSecond = mongoose.model('RefSecond', RefSecondSchema);
                });

                it('do not share the same counter', function(done){
                    var t = new this.RefFirst({country:'France', city:'Paris'});
                    var t2 = new this.RefSecond({country:'France', city:'Paris'});
                    t.save(function(err) {
                        if (err) return done(err);
                        assert.equal(t.inhabitant, 1);
                        t2.save(function(err){
                            if (err) return done(err);
                            assert.equal(t2.inhabitant, 1);
                            done();
                        });
                    });
                });
            });

        });

        describe('Reset counter => ', function(){

            before(function() {
                var ResettableSimpleSchema = new Schema({
                    id: Number,
                    val: String
                });
                ResettableSimpleSchema.plugin(AutoIncrement, {id: 'resettable_simple_id', inc_field: 'id'});
                this.ResettableSimple = mongoose.model('ResettableSimple', ResettableSimpleSchema);

                var ResettableComposedSchema = new Schema({
                    country: String,
                    city: String,
                    inhabitant: Number
                });
                ResettableComposedSchema.plugin(AutoIncrement, {
                    id: 'resettable_inhabitant_counter',
                    inc_field: 'inhabitant',
                    reference_fields: ['country', 'city']
                });
                this.ResettableComposed = mongoose.model('ResettableComposed', ResettableComposedSchema);
            });

            beforeEach('create simple resettable documents',function(done) {
                var count = 0,
                    documents = [];

                async.whilst(
                    function() { return count < 5; },

                    function(callback) {
                        count++;
                        var t = new this.ResettableSimple();
                        documents.push(t);
                        t.save(callback);
                    }.bind(this),

                    done

                );
            });

            beforeEach('create resettable reference document (a)',function(done) {
                var count = 0,
                    documents = [];

                async.whilst(
                    function() { return count < 3; },

                    function(callback) {
                        count++;
                        var t = new this.ResettableComposed({country: 'a', city: 'a'});
                        documents.push(t);
                        t.save(callback);
                    }.bind(this),

                    done

                );
            });

            beforeEach('create resettable reference document (b)',function(done) {
                var count = 0,
                    documents = [];

                async.whilst(
                    function() { return count < 3; },

                    function(callback) {
                        count++;
                        var t = new this.ResettableComposed({country: 'b', city: 'b'});
                        documents.push(t);
                        t.save(callback);
                    }.bind(this),

                    done

                );
            });

            it('a model gains a static "counterReset" method', function() {
                assert.isFunction(this.ResettableSimple.counterReset);
            });

            it('after calling it, the counter is 1', function(done){
                this.ResettableSimple.counterReset('resettable_simple_id', function(err) {
                    if(err) {
                        return done(err);
                    }
                    var t = new this.ResettableSimple();
                    t.save(function(err, saved) {
                        if(err) {
                            return done(err);
                        }
                        assert.deepEqual(saved.id, 1);
                        done();
                    });
                }.bind(this));
            });

            it('for a referenced counter, the counter is 1 for any reference', function(done){
                this.ResettableComposed.counterReset('resettable_inhabitant_counter', function(err) {
                    if(err) {
                        return done(err);
                    }
                    var tA = new this.ResettableComposed({country: 'a', city: 'a'});
                    var tB = new this.ResettableComposed({country: 'b', city: 'b'});
                    tA.save(function(err, tAsaved) {
                        if(err) {
                            return done(err);
                        }
                        tB.save(function(err, tBsaved){
                            if(err) {
                                return done(err);
                            }
                            assert.deepEqual(tAsaved.inhabitant, 1);
                            assert.deepEqual(tBsaved.inhabitant, 1);
                            done();
                        });
                    });
                }.bind(this));
            });

            it('for a referenced counter with a specific value, the counter is 1 for that reference', function(done){
                this.ResettableComposed.counterReset(
                    'resettable_inhabitant_counter',
                    {country: 'a', city: 'a'},
                    function(err) {
                        if(err) {
                            return done(err);
                        }
                        var tA = new this.ResettableComposed({country: 'a', city: 'a'});
                        var tB = new this.ResettableComposed({country: 'b', city: 'b'});
                        tA.save(function(err, tAsaved) {
                            if(err) {
                                return done(err);
                            }
                            tB.save(function(err, tBsaved){
                                if(err) {
                                    return done(err);
                                }
                                assert.deepEqual(tAsaved.inhabitant, 1);
                                assert.notEqual(tBsaved.inhabitant, 1);
                                done();
                            });
                        });
                    }.bind(this));
            });
        });

        describe('Error on hook', function(){
            before(function(done) {
                var SimpleFieldSchema = new Schema({
                    id: Number,
                    val: String
                });

                SimpleFieldSchema.plugin(function(schema, options) {
                    var sequence = AutoIncrement(schema, options);
                    sinon.stub(sequence._counterModel, 'findOneAndUpdate').yields(new Error('Incrementing error'));
                    return sequence;
                }, {id: 'simple_with_error_counter', inc_field: 'id'});
                this.SimpleField = mongoose.model('SimpleFieldWithError', SimpleFieldSchema);

                var ManualSchema = new Schema({
                    name: String,
                    membercount: Number
                });
                ManualSchema.plugin(function(schema, options) {
                    var sequence = AutoIncrement(schema, options);
                    sinon.stub(sequence, '_setNextCounter').yields(new Error('Incrementing error'));
                    return sequence;
                }, {id:'errored_manual_counter', inc_field: 'membercount', disable_hooks: true});
                this.Manual = mongoose.model('ManualWithError', ManualSchema);
                this.Manual.create([{name: 't1'},{name: 't2'}], done);
            });

            it('do not save the document if an error happens in the plugin', function(done) {
                var t = new this.SimpleField();
                t.save(function(err) {
                    assert.isOk(err);
                    assert.instanceOf(err, Error);
                    done();
                });
            });

            it('do not save the document after a manual incrementation if an error happens in the plugin', function(done) {
                this.Manual.findOne({name: 't1'}, function(err, entity) {
                    if(err) return done(err);
                    entity.setNext('errored_manual_counter', function(err, entity) {
                        assert.isOk(err);
                        assert.instanceOf(err, Error);
                        done();
                    });
                });
            });
        });

    });
});
