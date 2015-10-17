# Mongoose sequence plugin

[![Build Status](https://travis-ci.org/ramiel/mongoose-sequence.svg?branch=master)](https://travis-ci.org/ramiel/mongoose-sequence)

This plugin let you create fields which autoincrement their value:  
- every time a new document is inserted in a collection  
or
- when you esplicitly want to increment them

This increment can be:  
- __global__: every document has a unique value for the sequence field
- __scoped__: the counter depends on the value of other field(s)

Multiple counter can be set for a collection

## Global sequences

Let's say you want to have an `id` field in your `user` collection which has an unique auto-incremented value.

The user schema is something like this:

```javascript
UserSchema = mongoose.Schema({
    name: String
});

mongoose.model('User', UserSchema);
```

You don't need to define the `id` field in your schema because the plugin automatically set it for you. The only thing you have to do is to call:

```javascript
UserSchema.plugin(AutoIncrement, {inc_field: 'id'});
```

Every time a new user is created, the `id` field will have an incremental number. The operation is atomic and is based on [this](http://docs.mongodb.org/manual/tutorial/create-an-auto-incrementing-field/) specification.
A commodity collection named `counters` is created for you. You can override the name of this collection but we will see this later with the `options`.

If you want to increment the `_id` field which is special to mongoose, you have to explicitly specify it as a Number and tell mongoose to not interfer:

```javascript
UserSchema = mongoose.Schema({
    _id: Number,
    name: String
}, { _id: false });
UserSchema.plugin(AutoIncrement);
```

In this case you don't have to specify `inc_field` because the default value is `_id`

## Not automatic sequences 

Let say our user model has a `like` field which counts how many likes the user has in our amazing application. This field is of course a sequence but has to be incremented everytime an event occours. Because we have concurrent access to database we want to be sure that the increment of this counter happens safely.
Let's start modify our schema

```javascript
UserSchema = mongoose.Schema({
    name: String,
    like: Number
});
```

this time we specified explicitly the field `like`. There is no difference between defining and omitting the field specification. The only constraints is that the field has to be of type `Number`, otherwise the plugin will raise an error.
So, let's say to the plugin we want the `like` field to be a safe counter

```javascript
UserSchema.plugin(AutoIncrement, {inc_field: 'like', disable_hooks: true});
```

We specified `disable_hooks`. This avoid the field to be incremented when a new document is saved. So, how to increment this field? Your models has a new method: `setNext`. You must specify which sequence you want to increment and a callback. Here an example:

```javascript
User.findOne({name:'George'}, function(err, user){
    user.setNext('like', function(err, user){
        if(err) console.log('Cannot increment the likes because',err);
    });
});
```

You noticed that the method `setNext` takes, as argument, the counter field name. Is possible to give a name to the counter and use it as reference. For the previous example we can define the counter like this:

```javascript
UserSchema.plugin(AutoIncrement, {id:'like_counter', inc_field: 'like', disable_hooks: true});
```

and then using

```javascript
user.setNext('like_counter', function(err, user){
    ...
});
```

So, if you not specify the `id`, the field name is used. Even if you're not forced to specify an id, its use is strongly suggested. This because if you have two different counters, which refers to fields with the same name, they will collide and incrementing one, will increment the other too.
So use unique id to be sure to avoid collision.

As we will see, the use of an id for the counter is mandatory when you're are defining a `scoped counter`.


## Advanced

### Scoped counters

Let say our users are organized for `country` and `city`. And we want to save the `inhabitant_number` according to the two informations.  
The schema is like this:

```javascript
UserSchema = mongoose.Schema({
    name: String,
    country: String,
    city: String,
    inhabitants: Number
});
```

Every time a new Parisian is added the counting of Parisians have to be incremented. The inhabitants of New York must not interfer and have their separated counting. We should define a __scoped__ counter which says, increment the counter, depending on the value of other fields.

```
UserSchema.plugin(AutoIncrement, {id: 'inhabitant_seq', inc_field: 'inhabitants', reference_fields: ['country','city'] });
```

Notice that we have to use an id for our sequence, otherwise the plugin will raise an error.
Now save a new user
```
var user = new User({
    name: 'Patrice',
    country: 'France',
    city: 'Paris'
});
user.save();
```

This user will have the `inhabitants` counter to 1.
If now we add a new inhabitant from New York, this will have the counter to 1 also, because the counter is referenced to the value of the fields country and city.

If we want to increment manually this counter we have to specify the id of the sequence in the `setNext` method

```javascript
user.setNext('inhabitant_seq', function(err, user){
    user.inhabitants; // the counter value
});
```

Of course this example is a bit forced and this is for sure not the perfect use case. The field country and city have to be present and must not change during the life of the document because no automatic hook are set on the change of those values. But there are situation when you want a similar behaviour.

### Options

This plugin accept a series of options.

- __inc_field__: The name of the field to increment. Mandatory, default is `_id`
- __id__: Id of the sequence. Is mandatory only for scoped sequences but its use is strongly encouraged.
- __reference_fields__: The field to reference for a scoped counter. Optional
- __disable_hooks__: If true, the counter will not be incremented on saving a new document
- __collection_name__: By default the collection name for the counters is `counters`. You can override it using this option
