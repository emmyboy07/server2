const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());

async function createBrowser() {
    console.log("🚀 Launching headless browser...");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en'
    });

    return { browser, page };
}

app.get('/direct-download', async (req, res) => {
    const movieUrl = req.query.url;
    const season = parseInt(req.query.se || '0', 10);
    const episode = parseInt(req.query.ep || '0', 10);

    if (!movieUrl || !movieUrl.includes('moviebox.ng')) {
        return res.status(400).json({ error: "❌ Provide a valid MovieBox URL using 'url' query param." });
    }

    const subjectIdMatch = movieUrl.match(/id=(\d+)/);
    if (!subjectIdMatch) {
        return res.status(400).json({ error: "❌ Cannot extract subjectId from the given URL." });
    }

    const subjectId = subjectIdMatch[1];
    const downloadApiUrl = `https://moviebox.ng/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=${season}&ep=${episode}`;

    let browser;
    try {
        const { browser: b, page } = await createBrowser();
        browser = b;

        console.log(`🌐 Going to page: ${movieUrl}`);
        await page.goto(movieUrl, { waitUntil: 'domcontentloaded' });

        console.log(`📡 Fetching download data for subjectId: ${subjectId}`);
        const downloadData = await page.evaluate(async (url, referer) => {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Referer': referer,
                        'Accept': 'application/json'
                    },
                    credentials: 'include'
                });
                return await response.json();
            } catch (err) {
                return { error: 'Failed to fetch download data inside browser.' };
            }
        }, downloadApiUrl, movieUrl);

        if (downloadData?.error) {
            return res.status(500).json({ error: downloadData.error });
        }

        return res.json({
            subjectId,
            movieUrl,
            downloadApiUrl,
            data: downloadData
        });

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 11000;
app.listen(PORT, () => {
    console.log(`✅ Direct download server running at http://localhost:${PORT}`);
});
