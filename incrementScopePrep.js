const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017";
const dbName = 'test';
const CounterCollection = "counters";

const id = 'member_id';
const suffix = '_old';

try {
    MongoClient.connect(url, async(err, client) => {
        if (err) console.log(err);
        
        const db = client.db(dbName);
        const Counter = db.collection(CounterCollection);
    
        const counters = await Counter.find({id}).toArray();

        for (let index = 0; index < counters.length; index++) {
            const counter = counters[index];
            await Counter.update({_id: counter._id}, {$set: {id : `${counter.id}_${suffix}`}});
        }
        console.log('done')
    });
} catch (error) {
    console.log(error)
}
