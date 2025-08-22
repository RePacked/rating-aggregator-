const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { getPage } = require('../utils/httpClient');
const { formatTitleForUrlSlug } = require('../utils/urlFormatter');

const PROVIDER_NAME = 'Metacritic';
const BASE_URL = config.sources.metacriticBaseUrl;

function buildCandidateUrls(title, type, year) {
    const mediaType = type === 'series' ? 'tv' : 'movie';
    const slug = formatTitleForUrlSlug(title);

    const urls = [];
    if (year) urls.push(`${BASE_URL}/${mediaType}/${slug}-${year}`);
    urls.push(`${BASE_URL}/${mediaType}/${slug}`);
    if (year) urls.push(`${BASE_URL}/${mediaType}/${slug}-${year}-2`);

    return urls;
}

function scrapeMetacriticPage(html, url) {
    const $ = cheerio.load(html);
    const results = [];

    // --- Critics ---
    const criticScore = $('[data-testid="critic-score-info"] .c-siteReviewScore span').first().text().trim();
    if (/^\d+$/.test(criticScore)) {
        const score = parseInt(criticScore, 10);
        if (score >= 0 && score <= 100) {
            results.push({
                source: 'MC',
                value: `${score}/100`,
                url,
            });
        }
    }

    // --- Users ---
    const userScore = $('[data-testid="user-score-info"] .c-siteReviewScore span').first().text().trim();
    if (/^\d+(\.\d+)?$/.test(userScore)) {
        const score = parseFloat(userScore);
        if (score >= 0 && score <= 10) {
            results.push({
                source: 'MC Users',
                value: `${score}/10`,
                url,
            });
        }
    }

    return results.length ? results : null;
}

async function getRating(type, imdbId, streamInfo) {
    if (!streamInfo?.name) {
        logger.warn(`[${PROVIDER_NAME}] Skipping ${imdbId}: No title.`);
        return null;
    }

    const year = streamInfo.year || (streamInfo.date?.split('-')[0] || '');
    const urls = buildCandidateUrls(streamInfo.name, type, year);

    for (const url of urls) {
        logger.debug(`[${PROVIDER_NAME}] Trying ${url}`);
        const res = await getPage(url, PROVIDER_NAME);
        if (res?.status === 200) {
            const result = scrapeMetacriticPage(res.data, url);
            if (result) return result;
        }
    }

    return null;
}

module.exports = {
    name: PROVIDER_NAME,
    getRating,
};
