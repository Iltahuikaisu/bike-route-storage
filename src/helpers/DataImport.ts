import axios from "axios";
import { FetchedDataModel } from "../models/FetchedData.js";
import { performance } from 'perf_hooks';

import { ColumnOption, parse } from 'csv-parse';

export const ImportCsv = async ({ columns, csvUrls, name, saveFunction, validationFunction }:
     {
        columns: boolean | ColumnOption[] | ((record: any) => ColumnOption[]) | undefined,
        csvUrls: string[],
        name: string,
        saveFunction: (batch: any[]) => Promise<any>,
        validationFunction: (dataObject: any) => boolean,
    }) => {
    const urls = csvUrls;
for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
  const routeUrl = urls[urlIndex];

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
                    columns: columns ?? true,
                    cast: true,
                    skip_records_with_error: true,
                  }
                ));
              for await (const record of parser) {
                // Work with each record
                records.push(record);
              }
              return records;
            };
          process.stdout.write(`\nImporting ${name} csv ${urlIndex + 1}/${urls.length} csv parse`);
          const importedObjects = await processFile(result.data);

          const batchSize = 1000;
          for (let i = 0; i < importedObjects.length; i += batchSize) {
            
            let time = performance.now();
            const end = i + batchSize < importedObjects.length ? i + batchSize : importedObjects.length - 1;
            const batch = importedObjects.slice(i, end).filter(validationFunction);
            try {
              await saveFunction(batch);
              time = performance.now() - time;
              let minutes = Math.trunc((time * (importedObjects.length - i)/(batchSize * 1000 * 60)));
              let seconds = ((time * (importedObjects.length - i)/(batchSize * 1000)) % 60).toFixed(0);
              process.stdout.write(`\rImporting ${name} csv ${urlIndex + 1}/${urls.length}, ${minutes}m ${seconds}s left`)
            } catch (e) {
              console.error('Mongo error', e);
            }

          }
          process.stdout.write(`\rImporting ${name} csv ${urlIndex + 1}/${urls.length} 100% completed\n`);
          await FetchedDataModel.create({url: routeUrl})
      } catch (e) {
          console.error(e);
      }
  } else {
    console.error('already present', routeUrl)
  }
};
}