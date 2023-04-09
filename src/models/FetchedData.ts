import mongoose from 'mongoose'

const fetchedDataSchema = new mongoose.Schema({
    url: String,
})

export const FetchedDataModel = mongoose.model('FetchedData', fetchedDataSchema)
