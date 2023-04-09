import mongoose from 'mongoose'

const stationSchema = new mongoose.Schema({
    FID: {
        type: Number,
        required: true,
    },
    _id: {
        type: Number,
        required: true,
    },
    Nimi: {
        type: String,
    },
    Namn: {
        type: String,
    },
    Osoite: {
        type: String,
    },
    Adress: {
        type: String,
    },
    Kaupunki: {
        type: String,
    },
    Stad: {
        type: String,
    },
    Operaattor: {
        type: String,
    },
    Kapasiteet: {
        type: Number,
    },
    x: {
        type: Number,
    },
    y: {
        type: Number,
    },
})

export const StationModel = mongoose.model('Station', stationSchema)
