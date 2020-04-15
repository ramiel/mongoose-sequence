# Mongoose sequence plugin

[![Build Status](https://travis-ci.org/ramiel/mongoose-sequence.svg?branch=master)](https://travis-ci.org/ramiel/mongoose-sequence)
[![Coverage Status](https://coveralls.io/repos/github/ramiel/mongoose-sequence/badge.svg?branch=master)](https://coveralls.io/github/ramiel/mongoose-sequence?branch=master)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.me/FabrizioRuggeri)
![npm](https://img.shields.io/npm/v/mongoose-sequence)

This plugin lets you create fields which autoincrement their value:  
- every time a new document is inserted in a collection  
or
- when you explicitly want to increment them

This increment can be:  
- __global__: every document has a unique value for the sequence field
- __scoped__: the counter depends on the value of other field(s)

Multiple counters can be set for a collection.

## Migrating 

### From version 3 to version 4

Version 3 is now deprecated. In order to migrate to the new version the only change you need to do is to pass `mongoose` to the required module as explained in the [requiring](#requiring) section.

### From version 4 to version 5

An important fix about scoped counters is not backward compatible. You cannot use version 5 with scoped counters already present on your DB.

## Requisites

This plugin needs mongoose version 4.0.0 or above.


## Installation

`npm install --save mongoose-sequence`

## Requiring

You must pass your DB connection instance for this plugin to work. This is needed in order to create
a collection on your DB where to store increment references.

```js
const mongoose = require('mongoose')
const AutoIncrement = require('mongoose-sequence')(mongoose);
```

If you use different connections you must include it this way

```js
const mongoose = require('mongoose')
const AutoIncrementFactory = require('mongoose-sequence');

const connection = await mongoose.createConnection('mongodb://...');

const AutoIncrement = AutoIncrementFactory(connection);
```

## Global sequences

Let's say you want to have an `id` field in your `user` collection which has a unique auto-incremented value.

The user schema is something like this:

```js
UserSchema = mongoose.Schema({
    name: String
});

mongoose.model('User', UserSchema);
```

You don't need to define the `id` field in your schema because the plugin automatically sets it for you. The only thing you have to do is to call:

```js
UserSchema.plugin(AutoIncrement, {inc_field: 'id'});
```

after requiring the plugin.



Every time a new user is created, the `id` field will have an incremented number. The operation is atomic and is based on [this](https://docs.mongodb.com/v3.0/tutorial/create-an-auto-incrementing-field/) specification.
A commodity collection named `counters` is created for you. You can override the name of this collection but we will see this later with the `options`.

If you want to increment the `_id` field which is special to mongoose, you have to explicitly specify it as a Number and tell mongoose to not interfere:

```js
UserSchema = mongoose.Schema({
    _id: Number,
    name: String
}, { _id: false });
UserSchema.plugin(AutoIncrement);
```

In this case you don't have to specify `inc_field` because the default value is `_id`

## Not automatic sequences 

Let's say our user model has a `rank` field which gives the rank of the user in a tournament. So it saves the arrival order of a user to the end of our amazing game. This field is of course a sequence but has to be incremented every time an event occurs. Because we have concurrent access to our database we want to be sure that the increment of this counter happens safely.
Let's start by modifying our schema:

```js
UserSchema = mongoose.Schema({
    name: String,
    rank: Number
});
```

This time we specified explicitly the field `rank`. There is no difference between defining and omitting the field specification. The only constraint is that the field has to be of type `Number`, otherwise the plugin will raise an error.
So, let's tell the plugin we want the `rank` field to be a safe counter:

```js
UserSchema.plugin(AutoIncrement, {inc_field: 'rank', disable_hooks: true});
```

We specified `disable_hooks`. This avoids the field being incremented when a new document is saved. So, how to increment this field? Your models have a new method: **setNext**. You must specify which sequence you want to increment and a callback. Here's an example:

```js
User.findOne({name:'George'}, function(err, user){
    user.setNext('rank', function(err, user){
        if(err) console.log('Cannot increment the rank because ',err);
    });
});
```

You noticed that the method `setNext` takes, as argument, the counter field name. It is possible to give a name to the counter and use it as reference. For the previous example we can define the counter like this:

```js
UserSchema.plugin(AutoIncrement, {id:'rank_counter', inc_field: 'rank', disable_hooks: true});
```

and then use:

```js
user.setNext('rank_counter', function(err, user){
    ...
});
```

So, if you do not specify the `id`, the field name is used. Even if you're not forced to specify an id, its use is strongly suggested. This is because if you have two different counters, which refers to fields with the same name, they will collide and incrementing one will increment the other too. Counters are not bound to the schema they refer to, so two counters for two different schemas can collide.
So use a unique id to be sure to avoid collision. In the case of a collision the plugin will raise an error.

As we will see, the use of an id for the counter is mandatory when you're defining a `scoped counter`.

**NOTE**: When you call `setNext` the document is automatically saved. This behavior has changed since version 3.0.0. If you use a prior version you have to call save by yourself.

## Advanced

### Scoped counters

Let's say our users are organized by `country` and `city` and we want to save the `inhabitant_number` according to these two pieces of information.  
The schema is like this:

```js
UserSchema = mongoose.Schema({
    name: String,
    country: String,
    city: String,
    inhabitant_number: Number
});
```

Every time a new Parisian is added, the count of Parisians has to be incremented. The inhabitants of New York must not interfere, and have their separate counting. We should define a __scoped__ counter which increments the counter depending on the value of other fields.

```js
UserSchema.plugin(AutoIncrement, {id: 'inhabitant_seq', inc_field: 'inhabitant_number', reference_fields: ['country','city'] });
```

Notice that we have to use an id for our sequence, otherwise the plugin will raise an error.
Now save a new user:
```js
var user = new User({
    name: 'Patrice',
    country: 'France',
    city: 'Paris'
});
user.save();
```

This user will have the `inhabitant_number` counter set to 1.
If now we add a new inhabitant from New York, this will have its counter set to 1 also, because the counter is referred to by the value of the fields `country` and `city`.

If we want to increment this counter manually we have to specify the id of the sequence in the `setNext` method:

```js
user.setNext('inhabitant_seq', function(err, user){
    user.inhabitant_number; // the counter value
});
```

Of course this example is a bit forced and this is for sure not the perfect use case. The fields `country` and `city` have to be present and must not change during the life of the document because no automatic hooks are set on the change of those values. But there are situations when you want a similar behavior.

### Reset a counter

It's possible to programmatically reset a counter through the Model's static method `counterReset(id, reference, callback)`. The method takes these parameters:

- **id**: the counter to reset. It's mandatory
- **reference**: Lets you reset only a specific reference of the counter, if the counter has referenced fields. Optional. By default it resets all the counters for the `id`
- **callback**: A callback which receives an error in case of any. Mandatory

Some examples:


```js
Model.counterReset('counter_id', function(err) {
    // Now the counter is 0
});

Model.counterReset('inhabitants_id', function(err) {
    // If this is a referenced field, now all the counters are 0
});

Model.counterReset('inhabitants_id',{country: 'France', city: 'Paris'}, function(err) {
    // If this is a referenced field, only the counter for Paris/France is 0
});
```

### Nested fields

It is possible to define a nested field as counter, using `.` as the path separator:

```js
NestedSchema = new mongoose.Schema({
    name: { type: String },
    registration: {
        date: { type: Date },
        number: { type: Number }
    }
});

NestedSchema.plugin(AutoIncrement, { id: 'user_registration_seq', inc_field: 'registration.number' });
```


### Options

This plugin accepts the following options:

- **inc_field**: The name of the field to increment. Mandatory, default is `_id`.
- **id**: Id of the sequence. Mandatory only for scoped sequences but its use is strongly encouraged.
- **reference_fields**: The field to reference for a scoped counter. Optional.
- **start_seq**: The number to start the sequence from. Optional, default `1`.
- **inc_amount**: The quantity to increase the counter at each increment. Optional, default `1`.
- **disable_hooks**: If true, the counter will not be incremented on saving a new document. Default `false`.
- **collection_name**: By default the collection name to mantain the status of the counters is `counters`. You can override it using this option.
- **parallel_hooks**: If true, hooks will be registered as parallel.  Default `true`.

## Notes

When using `insertMany` the plugin won't increment the counter because the needed hooks are not called. If you need to create several documents at once, use `create` instead and pass an array of documents (refer to [#7](https://github.com/ramiel/mongoose-sequence/issues/7)).
