// ============================================================
// components/ProductList.jsx — Renders the product card grid
// ============================================================
// Takes the full products array from the parent (Home.jsx) and:
//   1. Filters by the active platform selection
//   2. Sorts by the chosen sort option
//   3. Identifies the cheapest item in the filtered+sorted list
//   4. Renders a responsive grid of ProductCard components
//
// Props:
//   products        — full array of product objects from the API
//   sort            — current sort key ("default" | "price_asc" | etc.)
//   activePlatforms — array of platform names to show (e.g. ["Amazon", "Flipkart"])

import { useMemo } from 'react';
import ProductCard from './ProductCard';

export default function ProductList({ products, sort, activePlatforms }) {

  // useMemo re-runs this calculation only when products, sort, or
  // activePlatforms change — avoids unnecessary work on every render
  const processed = useMemo(() => {
    // Step 1: Filter — only keep products from the selected platforms
    let list = activePlatforms.length
      ? products.filter((p) => activePlatforms.includes(p.platform))
      : products;

    // Step 2: Sort — apply the chosen sort order
    // "default" keeps the backend's original order (price_asc from the API)
    switch (sort) {
      case 'price_asc':  return [...list].sort((a, b) => a.price - b.price);
      case 'price_desc': return [...list].sort((a, b) => b.price - a.price);
      case 'rating':     return [...list].sort((a, b) => b.rating - a.rating);
      default:           return list;
    }
  }, [products, sort, activePlatforms]);

  // Find the cheapest product in the currently visible (filtered) list.
  // The backend sets isCheapest on the globally cheapest item, but after
  // platform filtering the cheapest visible item may be different.
  const cheapestId = useMemo(() => {
    if (!processed.length) return null;
    const cheapest = processed.reduce((min, p) => (p.price < min.price ? p : min));
    // Backend uses _id (MongoDB ObjectId string); mock data uses id (number)
    return cheapest._id ?? cheapest.id;
  }, [processed]);

  if (!processed.length) return null;

  return (
    // Responsive grid: 1 column on mobile, up to 4 columns on large screens
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {processed.map((product) => {
        const key        = product._id ?? product.id;
        const isCheapest = key === cheapestId; // true only for the cheapest visible card

        return (
          <ProductCard
            key={key}
            product={product}
            isCheapest={isCheapest}
            allProducts={processed}
          />
        );
      })}
    </div>
  );
}
