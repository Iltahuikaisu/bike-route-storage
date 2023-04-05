import mongoose from 'mongoose';

const fetchedDataSchema = new mongoose.Schema({
    url: String,
})

const FetchedDataModel = mongoose.model('FetchedData', fetchedDataSchema);

export default FetchedDataModel;