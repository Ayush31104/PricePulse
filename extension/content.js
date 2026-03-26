// content.js — extracts product title from supported e-commerce pages

const SELECTORS = [
  // Amazon
  '#productTitle',
  '#title span',
  // Flipkart
  'span.B_NuCI',
  'h1.yhB1nd span',
  // eBay
  'h1.x-item-title__mainTitle span',
  '#itemTitle',
  // Etsy
  'h1[data-buy-box-listing-title]',
  'h1.wt-text-body-03',
  // Myntra
  'h1.pdp-title',
  // Snapdeal
  'h1.pdp-e-i-head',
  // Generic fallback
  'h1',
];

function extractTitle() {
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText?.trim();
      if (text && text.length > 2) return text;
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_PRODUCT_TITLE') {
    sendResponse({ title: extractTitle() });
  }
});
