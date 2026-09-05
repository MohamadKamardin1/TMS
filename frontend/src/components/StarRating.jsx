import { useState } from 'react';
import { Star } from 'lucide-react';

const SIZE_CLASSES = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

const RATING_HINTS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

function StarIcon({ size, filled, dimmed }) {
  return (
    <Star
      className={`${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${
        filled ? 'fill-amber-400 text-amber-400' : dimmed ? 'fill-transparent text-gray-300' : 'text-gray-300'
      }`}
    />
  );
}

/**
 * Five-star rating control. When `onChange` is supplied it renders interactive
 * star buttons (with hover preview + accessible labels); without it, it renders
 * a read-only summary of a submitted rating.
 */
export default function StarRating({ value = 0, onChange, size = 'md', showValue = false, readOnly = false }) {
  const [hover, setHover] = useState(0);

  if (readOnly || !onChange) {
    return (
      <span className="inline-flex items-center gap-2" aria-label={`Rated ${value} out of 5 stars`}>
        <span className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <StarIcon key={star} size={size} filled={star <= Math.round(value)} dimmed={star > Math.round(value)} />
          ))}
        </span>
        {showValue && <span className="text-sm font-medium text-gray-700">{value}/5</span>}
      </span>
    );
  }

  const shown = hover || value;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? '' : 's'} — ${RATING_HINTS[star]}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="rounded p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <StarIcon size={size} filled={star <= shown} dimmed={false} />
          </button>
        ))}
      </span>
      {showValue && (
        <span className="min-w-16 text-sm font-medium text-gray-600">
          {shown > 0 ? `${shown}/5 · ${RATING_HINTS[shown]}` : 'Select a rating'}
        </span>
      )}
    </span>
  );
}
