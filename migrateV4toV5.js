const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017";
const dbName = 'test';
const oldCounterCollection = "counters";
const newCounterCollection = "newcounters";

const Mapping = {
  'id_1': {
    reference_fields: ["ref_field1", "ref_field2"]
  },
  'id_2': {
    reference_fields: ["ref_field3", "ref_field4"]
  }
};


try {
  MongoClient.connect(url, async (err, client) => {
    if (err) console.log(err);

    const db = client.db(dbName);
    const Counter = db.collection(oldCounterCollection);
    const NewCounter = db.collection(newCounterCollection);

    await Promise.all(Object.keys(Mapping).map(async id => {
      const counters = await Counter.find({ id }).toArray();
      for (let index = 0; index < counters.length; index++) {
        const { reference_value, seq } = counters[index];
        const newReferenceValue = {};
        Mapping[id].reference_fields.forEach((ref_id, i) => {
          if (reference_value[i]) {
            newReferenceValue[ref_id] = reference_value[i].slice(1, -1);
          }
        });
        await NewCounter.insert({ id, seq, reference_value: newReferenceValue });
      }
    }));
    console.log('Migration Done')
  });
} catch (error) {
  console.log(error)
}
