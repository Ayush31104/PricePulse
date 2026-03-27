import axios from 'axios';
import * as cheerio from 'cheerio';

async function testSelectors() {
  try {
    const { data: html } = await axios.get('https://www.flipkart.com/search?q=laptop', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(html);
    console.log('Cards found with div[data-id]:', $('div[data-id]').length);
    console.log('Cards found with ._1AtVbE:', $('._1AtVbE').length);

    // Inspect first card HTML
    const firstCard = $('div[data-id]').first();
    console.log('\n--- First Card HTML ---');
    console.log(firstCard.html());

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSelectors();