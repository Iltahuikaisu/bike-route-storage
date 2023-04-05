import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

import mongoose from 'mongoose';
import Route from './models/Route';
import FetchedDataModel from './models/FetchedData';
import { routeDataUrls } from './constants';
import axios from 'axios';
import { parse } from 'csv-parse/.';

const typeDefs = `
  type Route {
    id: String
    return: String
	depStatId: String
	depStatName: String
	retStatName: String
	retStatId: Number
	distance: Number
	duration: Number;
  }

  type DataFetch {
    id: String
    url: String
  }

  type Query {
    routes(page: number): [Route]
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
        routes: async ({ page }) => {
            const result = 
                await Route.find();
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


routeDataUrls.forEach(async element => {
    const count =  await FetchedDataModel.countDocuments({url: element})
    if(count === 0) {
        try {
            const result = await axios.get(element);

            const processFile = async (data: any) => {
                const records = [];
                const parser = data
                  .pipe(parse({
                  // CSV options if any
                  }));
                for await (const record of parser) {
                  // Work with each record
                  records.push(record);
                }
                return records;
              };

            const routes = await processFile(result.data);
            console.log(routes)
            parse(result.data, {}, (array) => console.log(array[0]));
        } catch (e) {
            console.log(e)
        }
    }
});

console.log(`Server ready at ${url} !!!`);