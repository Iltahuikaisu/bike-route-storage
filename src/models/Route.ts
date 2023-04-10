import mongoose from 'mongoose';

const routeSchema = new mongoose.Schema({
    return: {
        type: Date,
        required: true,
    },
    departure: {
        type: Date,
        required: true,
    },
    depStatId: {
        type: Number,
        ref: 'Station',
        required: true,
    },
    depStatName: {
        type: String,
        required: true,
    },
    retStatName: {
        type: String,
        required: true,
    },
    retStatId: {
        type: Number,
        ref: 'Station',
        required: true,
    },
    distance: {
        type: Number,
        min: [10, 'Distance travelled less than 10m'],
        required: true,
    },
    duration: {
        type: Number,
        min: [10, 'Route duration less than 10s'],
        required: true,
    },
});

routeSchema.index({ departure: 1, return: 1 }, { unique: true });
routeSchema.index({ retStatId: 1});
routeSchema.index({ depStatId: 1});

export const RouteModel = mongoose.model('Route', routeSchema);
