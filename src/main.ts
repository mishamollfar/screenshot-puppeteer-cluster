import * as express from 'express';
import * as cors from 'cors';
import { Cluster } from 'puppeteer-cluster';
import morgan = require('morgan');

const app = express();
app.use(cors());
const port = process.env.SCREENSHOT_PORT || 3005;

const optArgs = [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--no-sandbox',
];

const options: any = {
    headless: true,
    args: optArgs,
    defaultViewport: null,
    waitUntil: 'networkidle2',
    ignoreDefaultArgs: ['--disable-extensions'],
};

(async () => {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 7,
        puppeteerOptions: options,
    });
    await cluster.task(async ({ page, data: url }) => {
        await page.goto('http://' + url);
        // make a screenshot
        await page.setViewport({width: 1220, height: 840});
        await page.waitForSelector('.highcharts-root');
        await page.waitForTimeout(1000);
        const screen = await page.screenshot();
        return screen;
    });

    app.use(morgan('[:date[clf]] :method :url :status - :response-time ms'))

    // setup server
    app.get('/screenshot', async (req, res) => {
        if (!req.query.url) {
            return res.end('Please specify url like this: ?url=example.com');
        }
        try {
            const screen = await cluster.execute(req.query.url);

            // respond with image
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': screen.length
            });
            res.end(screen);
        } catch (err) {
            // catch error
            res.end('Error: ' + err.message);
        }
    });

    app.listen(port, () => {
        console.log(`Screenshot server listening on port ${port}.`);
    });
})();
