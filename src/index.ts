import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'

import mongoose from 'mongoose'
import { RouteModel } from './models/Route.js'
import { StationModel } from './models/Station.js'
import { FetchedDataModel } from './models/FetchedData.js'
import { routeDataUrls, stationDataUrls } from './constants.js'

import { ImportCsv } from './helpers/DataImport.js'

import axios from 'axios'
import { ColumnOption, parse } from 'csv-parse'
import * as dotenv from 'dotenv'

dotenv.config()

const typeDefs = `#graphql
  type Route {
    id: String
    departure: Int
	  depStatId: Int
	  depStatName: String
    return: Int
	  retStatName: String
	  retStat: Station
	  distance: Int
	  duration: Int
  }

  type Station {
    FID: Int
    ID: Int
    Name: String
    Adress: String
    City: String
    Operator: String
    Capacity: Int
    x: Int
    y: Int
  }

  type DataFetch {
    id: String
    url: String
  }

  type Query {
    routes(page: Int): [Route]
    data: [DataFetch]
  }
`

const routes = [
    {
        id: '',
        return: '',
        depStatId: '',
        depStatName: '',
        retStatName: '',
        retStatId: 2,
        distance: 2,
        duration: 2,
    },
]

const resolvers = {
    Query: {
        routes: async ({ page }: { page: number }) => {
            const result = await RouteModel.find()
            console.log(page)
            return result
        },
        data: async () => {
            const result = await FetchedDataModel.find()
            console.log(result)
            return result
        },
    },
}

const server = new ApolloServer({
    typeDefs,
    resolvers,
})

const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
})
console.log(process.env.MONGO_URL)
mongoose.connect(`${process.env.MONGO_URL}`)

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
        ])

        const columns = firstRow.map((name: string) =>
            columnMapper.get(name.trim())
        )
        return columns
    },
    csvUrls: routeDataUrls,
    name: 'routes',
    saveFunction: async (batch) => {
        await RouteModel.insertMany(batch, { ordered: false })
    },
    validationFunction: (value) => {
        if (value.distance > 10 && value.duration > 10) {
            return true
        }
        return false
    },
})

// Import Stadions into MongoDb if not already present
await ImportCsv({
    columns: (firstRow: string[]): ColumnOption[] => {
        const columns = firstRow.map((name: string) => name.trim())
        return columns
    },
    csvUrls: stationDataUrls,
    name: 'stations',
    saveFunction: async (batch) => {
        await StationModel.insertMany(batch, { ordered: false })
    },
    validationFunction: () => true,
})

console.log(`Server ready at ${url} !!!`)

export default null
