import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

import mongoose from 'mongoose';
import { RouteModel } from './models/Route.js';
import { StationModel } from './models/Station.js';
import { FetchedDataModel } from './models/FetchedData.js';
import { pageSize, routeDataUrls, stationDataUrls } from './constants.js';

import { ImportCsv } from './helpers/DataImport.js';

import { ColumnOption } from 'csv-parse';
import * as dotenv from 'dotenv';

dotenv.config();

const typeDefs = `#graphql
  type Route {
    id: String!
    departure: String
	depStatId: Station
	depStatName: String
    return: String
	retStatName: String
	retStatId: Station
	distance: Int
	duration: Int
  }

  type StationUsage {
    stationName: String
    count: Int
  }

  type Station {
    FID: Int
    Nimi: String
    Namn: String
    Osoite:String
    Adress: String
    Kaupunki: String
    Stad: String
    Operaattor: String
    Kapasiteet: Int
    AverageDistance: Float
    RoutesStartHereCount: Int
    RoutesEndHereCount: Int
    MostPopularDepartures: [StationUsage]
    MostPopularReturns: [StationUsage]
    x: String
    y: String
  }

  type DataFetch {
    id: String
    url: String
  }

  type Query {
    routes(page: Int, sortKey: String, sortDirection: String, dateFrom: String, dateTo: String): [Route]
    stations(dateFrom: String, dateTo: String): [Station]
    getStationById(id: Int, months: [Int]): Station
    data: [DataFetch]
  }
`;

const resolvers = {
    Query: {
        routes: async (
            _root: any,
            args: {
                page: number;
                sortKey: string;
                sortDirection: 'asc' | 'desc';
                dateFrom: string;
                dateTo: string;
            }
        ) => {
            const { page, sortKey, sortDirection, dateFrom, dateTo } = args;
            const data = await RouteModel.find()
                .where('departure')
                .gt(Date.parse(dateFrom))
                .lt(Date.parse(dateTo))
                .sort([[sortKey ?? 'departure', sortDirection ?? 'desc']])
                .skip(pageSize * page)
                .limit(pageSize)
                .populate(['depStatId', 'retStatId']);

            const result = data.map((value) => ({
                id: value._id,
                departure: value.departure.toISOString(),
                depStatId: value.depStatId,
                depStatName: value.depStatName,
                return: value.return.toISOString(),
                retStatName: value.retStatName,
                retStatId: value.retStatId,
                distance: value.distance,
                duration: value.duration,
            }));
            return result;
        },
        stations: async () => {
            const data = await StationModel.find();
            return data;
        },
        data: async () => {
            const result = await FetchedDataModel.find();
            return result;
        },
    },
    Station: {
        x: (parent: any) => parent.x.toString(),
        y: (parent: any) => parent.y.toString(),
        RoutesStartHereCount: async (parent: any) => {
            const count = await RouteModel.find({
                depStatId: parent._id,
            }).countDocuments();
            return count;
        },
        RoutesEndHereCount: async (parent: any) => {
            const count = await RouteModel.find({
                retStatId: parent._id,
            }).countDocuments();
            return count;
        },
        MostPopularDepartures: async (
            parent: { _id: any },
            args: { dateFrom: string; dateTo: string }
        ) => {
            // Get all routes that return here
            let aggregationPipeline: any[] = [
                { $match: { retStatId: parent._id } },
            ];

            if (args.dateFrom && args.dateTo) {
                aggregationPipeline.push({
                    $match: {
                        departure: {
                            $gte: Date.parse(args.dateFrom),
                            $lt: Date.parse(args.dateTo),
                        },
                    },
                });
            }

            // Group by departure station and count group size
            aggregationPipeline = aggregationPipeline.concat([
                {
                    $group: {
                        _id: '$depStatName',
                        count: { $sum: 1 },
                        stationName: '$depStatName',
                    },
                },
                // Get 5 biggest size groups
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]);

            let dataQuery = await RouteModel.aggregate(aggregationPipeline);
            return dataQuery;
        },
        MostPopularReturns: async (
            parent: { _id: any },
            args: { dateFrom: string; dateTo: string }
        ) => {
            let aggregationPipeline: any = [
                { $match: { depStatId: parent._id } },
            ];

            if (args.dateFrom && args.dateTo) {
                aggregationPipeline.push({
                    $match: {
                        departure: {
                            $gte: Date.parse(args.dateFrom),
                            $lt: Date.parse(args.dateTo),
                        },
                    },
                });
            }

            // Group by departure station and count group size
            aggregationPipeline = aggregationPipeline.concat([
                {
                    $group: {
                        _id: '$retStatName',
                        count: { $sum: 1 },
                        stationName: { $first: '$retStatName' }
                    },
                },
                // Get 5 biggest size groups
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]);

            let dataQuery = await RouteModel.aggregate(aggregationPipeline).exec();

            return dataQuery.map((value) => ({count: value.count, stationName: value._id})) ?? {};
        },
        AverageDistance: async (
            parent: { _id: any },
            args: { dateFrom: string; dateTo: string }
        ) => {
            let aggregationPipeline: any = [
                { $match: { depStatId: parent._id },  },
            ];

            if (args.dateFrom && args.dateTo) {
                aggregationPipeline.push({
                    $match: {
                        departure: {
                            $gte: Date.parse(args.dateFrom),
                            $lt: Date.parse(args.dateTo),
                        },
                    },
                });
            }

            aggregationPipeline.push({
                $group: {_id: '$depStatId', average: {$avg: "$distance" }}
            })
            const data = await RouteModel.aggregate(aggregationPipeline).exec()
            return data[0].average ?? 0;
        },
    },
};

const server = new ApolloServer({
    typeDefs,
    resolvers,
});

const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
});

mongoose.connect(`${process.env.MONGO_URL}`);

// Import Routes into MongoDb if not already present

await ImportCsv({
    columns: (firstRow): ColumnOption[] => {
        const columnMapper = new Map<string, string>([
            ['Departure', 'departure'],
            ['Return', 'return'],
            ['Departure station id', 'depStatId'],
            ['Departure station name', 'depStatName'],
            ['Return station id', 'retStatId'],
            ['Return station name', 'retStatName'],
            ['Covered distance (m)', 'distance'],
            ['Duration (sec.)', 'duration'],
        ]);

        const columns = firstRow.map((name: string) =>
            columnMapper.get(name.trim())
        );
        return columns;
    },
    csvUrls: routeDataUrls,
    name: 'routes',
    saveFunction: async (batch) => {
        await RouteModel.insertMany(batch, { ordered: false });
    },
    validationFunction: (value) => {
        if (value.distance > 10 && value.duration > 10) {
            return true;
        }
        return false;
    },
});

// Import Stations into MongoDb if not already present
await ImportCsv({
    columns: (firstRow: string[]): ColumnOption[] => {
        const columns = firstRow.map((name: string) =>
            name.trim() === 'ID' ? '_id' : name.trim()
        );
        return columns;
    },
    csvUrls: stationDataUrls,
    name: 'stations',
    saveFunction: async (batch) => {
        await StationModel.insertMany(batch, { ordered: false });
    },
    validationFunction: () => true,
});

console.log(`Server ready at ${url}`);

export default null;
