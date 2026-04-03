// extension/content.js — Product data extractor
// Injected at document_idle into Amazon/Flipkart/eBay/Etsy pages.
// Responds to GET_PRODUCT messages from popup.js.

const TITLE_SEL = [
  '#productTitle',                          // Amazon desktop
  '#title span',                            // Amazon alternate
  'span.B_NuCI',                            // Flipkart old
  'h1.yhB1nd span',                         // Flipkart new
  'h1.x-item-title__mainTitle span',        // eBay
  '#itemTitle',                             // eBay alternate
  'h1[data-buy-box-listing-title]',         // Etsy
  'h1.wt-text-body-03',                     // Etsy alternate
  'h1.pdp-title',                           // Myntra
  'h1.pdp-e-i-head',                        // Snapdeal
  'h1',                                     // generic fallback
];

const PRICE_SEL = [
  // Amazon India — most reliable first
  '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
  '#apex_desktop .a-price .a-offscreen',
  '.a-price[data-a-color="price"] .a-offscreen',
  'span.a-price-whole',
  '#priceblock_ourprice',
  '#priceblock_dealprice',
  '#priceblock_saleprice',
  // Flipkart
  'div._30jeq3._16Jk6d',
  'div._30jeq3',
  // eBay
  'span.x-price-primary span.ux-textspans',
  // Generic structured data
  '[itemprop="price"]',
];

function extractTitle() {
  for (const sel of TITLE_SEL) {
    const text = document.querySelector(sel)?.innerText?.trim();
    if (text && text.length > 2) return text;
  }
  return null;
}

function extractPrice() {
  for (const sel of PRICE_SEL) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const raw = el.getAttribute('content') || el.innerText || '';
    // Keep only digits and a single dot
    const cleaned = raw.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

function getProductData() {
  const title = extractTitle();
  const price = extractPrice();
  const url   = location.href;
  console.log('[PricePulse content] Extracted — title:', title, '| price:', price, '| url:', url);
  return { title, price, url };
}

// Respond to popup requests
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_PRODUCT') {
    sendResponse(getProductData());
    return true;
  }
  // Legacy handlers kept for compatibility
  if (msg.type === 'GET_PRODUCT_TITLE') {
    sendResponse({ title: extractTitle() });
    return true;
  }
  if (msg.type === 'GET_PRODUCT_INFO') {
    sendResponse(getProductData());
    return true;
  }
});

// Let the background know this content script is alive on this tab
chrome.runtime.sendMessage({ type: 'CONTENT_READY', url: location.href }).catch(() => {});
