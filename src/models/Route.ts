import mongoose from 'mongoose';

const routeSchema = new mongoose.Schema({
    id: String,
    return: String,
	depStatId: String,
	depStatName: String,
	retStatName: String,
	retStatId: Number,
	distance: Number,
	duration: Number
})

const RouteModel = mongoose.model('Route', routeSchema);

export default RouteModel;