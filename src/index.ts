import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

import mongoose from 'mongoose';
import { RouteModel } from './models/Route.js';
import { FetchedDataModel } from './models/FetchedData.js';
import { routeDataUrls } from './constants.js';
import axios from 'axios';
import { ColumnOption, parse } from 'csv-parse';
import * as dotenv from 'dotenv';
import { log } from 'console';
dotenv.config();

const typeDefs = `#graphql
  type Route {
    id: String
    departure: Int
	  depStatId: Int
	  depStatName: String
    return: Int
	  retStatName: String
	  retStatId: Int
	  distance: Int
	  duration: Int
  }

  type DataFetch {
    id: String
    url: String
  }

  type Query {
    routes(page: Int): [Route]
    data: [DataFetch]
  }
`;

const routes = [
    {
        id: "",
        return: "",
        depStatId: "",
        depStatName: "",
        retStatName: "",
        retStatId: 2,
        distance: 2,
        duration: 2,
    }
]

const resolvers = {
    Query: {
        routes: async ({ page }: { page: number }) => {
            const result = 
                await RouteModel.find();
            console.log(page);
            return result;
        },
        data: async () => {
            const result = await FetchedDataModel.find();
            console.log(result)
            return result;
        }
    },
}

const server = new ApolloServer(
    { 
        typeDefs,
        resolvers
    }
);

const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
  }
);
console.log(process.env.MONGO_URL);
mongoose.connect(`${process.env.MONGO_URL}`);


for (let urlIndex = 0; urlIndex < routeDataUrls.length; urlIndex++) {
    const routeUrl = routeDataUrls[urlIndex];
    console.log('route',routeUrl);
    const count =  await FetchedDataModel.countDocuments({url: routeUrl})
    if(count === 0) {
        try {
            const result = await axios(
              {
                url: routeUrl,
                method:"GET",
                responseType: "stream",
              }
            );
            const processFile = async (data: any) => {
                const records = [];
                const parser = data
                  .pipe(parse(
                    {
                      delimiter: ",",

                      columns: (firstRow):ColumnOption[] => {

                        const columnMapper = new Map<string, string>(
                          [
                            ['Departure', 'departure'],
                            ['Return', 'return'],
                            ['Departure station id', 'depStatId'],
                            ['Departure station name', 'depStatName'],
                            ['Return station id', 'retStatId'],
                            ['Return station name', 'retStatName'],
                            ['Covered distance (m)', 'distance'],
                            ['Duration (sec.)', 'duration'],
                          ]
                        );
                          
                        const columns = firstRow.map((name:string) => columnMapper.get(name.trim()));
                        return columns;
                      },
                      cast: true,
                      cast_date: true,
                      skip_records_with_error: true,
                    }
                  ));
                for await (const record of parser) {
                  // Work with each record
                  records.push(record);
                }
                return records;
              };

            const routes = await processFile(result.data);

            const batchSize = 1000;
            console.log('Start import');
            for (let i = 0; i < routes.length; i += batchSize) {
              const end = i + batchSize < routes.length ? i + batchSize : routes.length - 1;
              const batch = routes.slice(i, end).filter((value) => {
                if(value.distance > 10 && value.duration > 10) {
                  return true;
                } 
                return false;
              });
              process.stdout.write(`\rImporting csv ${urlIndex + 1}/${routeDataUrls.length} ${Math.round((100 * i)/routes.length)}% completed`);
              try {
                await RouteModel.create(batch);
              } catch (e) {
                console.error('Mongo error', e);
              }

            }
            
        } catch (e) {
            console.error(e);
        }
    } else {
      console.error('already present', routeUrl)
    }
    await FetchedDataModel.create({url: routeUrl})

};

console.log(`Server ready at ${url} !!!`);

export default null;