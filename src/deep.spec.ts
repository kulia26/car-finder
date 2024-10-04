import { test } from '@playwright/test';
import axios from 'axios';
require('dotenv').config();

const VERSION = process.env.VERSION || 'v1';
const INSTANCE = parseInt(process.env.INSTANCE || '-1');
console.log('Starting version: ', VERSION);
// only one city (old)
const getUrlV1 = (page = 0) => {
  return `https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&categories.main.id=1&country.import.usa.not=-1&region.id[0]=10&price.USD.lte=12000&price.currency=1&abroad.not=0&custom.not=1&page=${page}&size=100`;
};

const getUrlV2 = (page = 0) => {
  return `https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&country.import.usa.not=-1&region.id[0]=2&region.id[1]=6&region.id[2]=24&region.id[3]=20&region.id[4]=1&price.USD.gte=2500&price.USD.lte=10000&price.currency=1&abroad.not=0&custom.not=1&page=${page}&size=100`;
};
const getCarsListPageUrl = (page = 0) => {
  return VERSION === 'v1' ? getUrlV1(page) : getUrlV2(page);
};

interface Car {
  title: string;
  price: number;
  url: string;
  hash: string;
  version: string;
}

test('find cars', async ({ page }) => {
  const promises: Array<Promise<any>> = [];

  await page.goto(getCarsListPageUrl(), { waitUntil: 'networkidle' });
  const resultsCount = parseInt(
    (await page.locator('#staticResultsCount').allInnerTexts())
      .toString()
      .replace(/ /g, ''),
  );
  const pagesCount = Math.floor(resultsCount / 100);

  const step = INSTANCE === -1 ? 1 : 5;

  for (let i = INSTANCE === -1 ? 0 : INSTANCE; i <= pagesCount; i = i + step) {
    const carsToSend: Array<Car> = [];
    await page.waitForTimeout(2500 * Math.random());
    await page.goto(getCarsListPageUrl(i), { waitUntil: 'networkidle' });
    const cars = await page.locator('.ticket-item').all();

    console.log(`page: ${i} of ${pagesCount} ...`);

    await Promise.all(
      cars.map(async (carElement) => {
        const title = (
          await carElement.locator('.ticket-title').allInnerTexts()
        ).toString();
        const price = parseInt(
          (await carElement.locator('[data-currency="USD"]').allInnerTexts())
            .toString()
            .replace(/ /g, ''),
        );
        const url = await carElement
          .locator('.m-link-ticket')
          .getAttribute('href');
        const id = await carElement.getAttribute('data-advertisement-id');
        const userId = await carElement.getAttribute('data-user-id');
        const city = (await carElement.locator('.view-location').innerText())
          .toString()
          .replace(/ /g, '');
        const transmission = (
          await carElement.locator('li.item-char:last-child').innerText()
        )
          .toString()
          .replace(/ /g, '');

        const hash = `${id}u${userId}`;

        if (url && id && userId && hash) {
          const car = {
            title,
            price,
            url,
            hash,
            version: VERSION,
            city,
            transmission,
          };

          carsToSend.push(car);
        }

        return Promise.resolve();
      }),
    );

    promises.push(
      axios({
        method: 'post',
        url: `${process.env.WEBHOOK_URL}`,
        data: {
          cars: [...carsToSend],
        },
      }),
    );
  }

  console.time('sendToServer');

  await Promise.allSettled(promises);

  console.timeEnd('sendToServer');

  await page.close();

  console.log({ resultsCount });
});
