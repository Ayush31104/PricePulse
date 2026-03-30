// ============================================================
// components/ProductCard.jsx — Single product result card
// ============================================================
// Displays one product listing with its image, title, rating,
// price, and a "View Deal" button that links to the product page.
//
// Props:
//   product     — product object from the backend
//   isCheapest  — boolean, true if this is the lowest-priced result
//                 (passed down from ProductList after client-side recalculation)

import { formatCurrency } from '../utils/formatCurrency';
import { StarIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';

const PLATFORM_STYLES = {
  Amazon:   { badge: 'bg-orange-500/20 text-orange-300 border-orange-400/30', dot: 'bg-orange-400' },
  Flipkart: { badge: 'bg-blue-500/20   text-blue-300   border-blue-400/30',   dot: 'bg-blue-400'   },
  eBay:     { badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30', dot: 'bg-yellow-400' },
  Etsy:     { badge: 'bg-rose-500/20   text-rose-300   border-rose-400/30',   dot: 'bg-rose-400'   },
};

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        i <= Math.round(rating)
          ? <StarIcon    key={i} className="h-3.5 w-3.5 text-amber-400" />
          : <StarOutline key={i} className="h-3.5 w-3.5 text-white/20" />
      ))}
    </div>
  );
}

export default function ProductCard({ product, isCheapest: isCheapestProp }) {
  const style = PLATFORM_STYLES[product.platform] || PLATFORM_STYLES.Amazon;

  const title      = product.name       || product.title || 'Unknown Product';
  const productUrl = product.productUrl || product.url   || '#';
  const reviews    = product.reviews    || 0;
  const isCheapest = product.isCheapest || isCheapestProp;

  return (
    <div className={`product-card relative flex flex-col rounded-2xl overflow-hidden
                     ${isCheapest ? 'ring-2 ring-green-400/60 shadow-green-500/20' : ''}`}>

      {/* Best Price ribbon */}
      {isCheapest && (
        <div className="absolute top-3 left-3 z-10 bg-green-500 text-white text-xs font-bold
                        px-2.5 py-1 rounded-full shadow-lg shadow-green-500/40 flex items-center gap-1">
          🏆 Best Price
        </div>
      )}

      {/* Platform badge */}
      <div className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 text-xs font-semibold
                       px-2.5 py-1 rounded-full border ${style.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {product.platform}
      </div>

      {/* Image */}
      <div className="h-48 overflow-hidden bg-white/5">
        <img
          src={product.image || `https://placehold.co/400x300/1e1b4b/94a3b8?text=${encodeURIComponent(product.platform)}`}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
          onError={(e) => {
            e.target.src = `https://placehold.co/400x300/1e1b4b/94a3b8?text=${encodeURIComponent(product.platform)}`;
          }}
        />
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <h3 className="text-sm font-semibold text-white/90 line-clamp-2 leading-snug tracking-tight">
          {title}
        </h3>

        <div className="flex items-center gap-2">
          <StarRating rating={product.rating} />
          <span className="text-xs text-white/50 font-medium">{product.rating}</span>
          <span className="text-xs text-white/30">({reviews.toLocaleString()})</span>
        </div>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/10">
          <div>
            <span className={`text-2xl font-black tracking-tight
                              ${isCheapest ? 'text-green-400' : 'text-white'}`}>
              {formatCurrency(product.price)}
            </span>
            {isCheapest && (
              <p className="text-xs text-green-400/80 font-medium mt-0.5">Lowest price!</p>
            )}
          </div>

          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`view-deal-btn flex items-center gap-1.5 text-xs font-semibold
                        px-4 py-2 rounded-xl text-white
                        ${isCheapest
                          ? 'bg-green-500 hover:bg-green-400 shadow-lg shadow-green-500/30'
                          : 'btn-gradient'}`}
          >
            View Deal
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
