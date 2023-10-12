import { test } from '@playwright/test';
import axios from 'axios';
import { Telegraf } from 'telegraf';
import crypto from 'crypto';
import { writeFile } from 'fs/promises';
require('dotenv').config();

const getCarsListPageUrl = (page = 0) => {
  return `https://auto.ria.com/uk/search/?indexName=auto,order_auto,newauto_search&categories.main.id=1&country.import.usa.not=-1&region.id[0]=10&price.USD.lte=5000&price.currency=1&abroad.not=0&custom.not=1&page=${page}&size=100`;
};

test('find cars', async ({ page }) => {
  const promises: Array<Promise<any>> = [];

  await page.goto(getCarsListPageUrl(), { waitUntil: 'networkidle' });
  const resultsCount = parseInt(
    (await page.locator('#staticResultsCount').allInnerTexts())
      .toString()
      .replace(/ /g, ''),
  );
  const pagesCount = Math.floor(resultsCount / 100);

  for (let i = 0; i <= pagesCount; i++) {
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
        const url =
          (await carElement.locator('.m-link-ticket').getAttribute('href')) ||
          'undefined';
        const id = await carElement.getAttribute('data-advertisement-id');
        const userId = await carElement.getAttribute('data-user-id');
        const hash = `${id}u${userId}`;
        const car = {
          title,
          price,
          url,
          hash,
        };

        promises.push(
          axios({
            method: "post",
            url: `${process.env.WEBHOOK_URL}`,
            data: car,
          }),
        );

        return Promise.resolve();
      }),
    );
  }

  console.time('sendToServer');

  await Promise.allSettled(promises);

  console.timeEnd('sendToServer');

  await page.close();

  console.log({ resultsCount });
});
