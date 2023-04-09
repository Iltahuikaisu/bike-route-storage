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

  type Station {
    FID: Int
    Nimi: String
    Namn: String
    Osoite:String
    Adress: String
    Kaupunki: String
    City: String
    Stad:String
    Operaattor:String
    Kapasiteet:Int
    Capacity: Int
    x: Int
    y: Int
  }

  type DataFetch {
    id: String
    url: String
  }

  type Query {
    routes(page: Int, sortKey: String, sortDirection: String): [Route]
    stations: [Station]
    getStationById(id: Int): Station
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
            }
        ) => {
            const { page, sortKey, sortDirection } = args;
            const data = await RouteModel.find()
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
            const result = data.map((value) => ({
                FID: value.FID,
                Name: value.Nimi,
                Nimi: value.Nimi,
                Adress: value.Osoite,
                City: value.Kaupunki,
                Operator: value.Operaattor,
                Capacity: value.Kapasiteet,
                x: value.x,
                y: value.y,
            }));

            return result;
        },
        data: async () => {
            const result = await FetchedDataModel.find();
            return result;
        },
    },
    Route: {},
};

const server = new ApolloServer({
    typeDefs,
    resolvers,
});

const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
});
console.log(process.env.MONGO_URL);
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

console.log(`Server ready at ${url} !!!`);

export default null;
