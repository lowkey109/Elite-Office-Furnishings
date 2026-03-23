import { Star, ExternalLink } from "lucide-react";

const GOOGLE_PLACE_ID = import.meta.env.VITE_GOOGLE_PLACE_ID as string | undefined;
const GOOGLE_RATING = import.meta.env.VITE_GOOGLE_RATING as string | undefined;
const GOOGLE_REVIEW_COUNT = import.meta.env.VITE_GOOGLE_REVIEW_COUNT as string | undefined;

interface GoogleReviewsBadgeProps {
  variant?: "floating" | "inline";
}

export function GoogleReviewsBadge({ variant = "floating" }: GoogleReviewsBadgeProps) {
  if (!GOOGLE_PLACE_ID) return null;

  const rating = parseFloat(GOOGLE_RATING || "4.9");
  const reviewCount = parseInt(GOOGLE_REVIEW_COUNT || "47", 10);
  const reviewsUrl = `https://search.google.com/local/reviews?placeid=${GOOGLE_PLACE_ID}`;

  const filledStars = Math.floor(rating);
  const hasHalfStar = rating - filledStars >= 0.5;

  if (variant === "inline") {
    return (
      <a
        href={reviewsUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="link-google-reviews-inline"
        className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:border-[rgba(201,168,76,0.3)] rounded-xl px-4 py-2.5 transition-colors group"
        aria-label={`Google Reviews: ${rating} stars from ${reviewCount} reviews`}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-3 h-3 ${i < filledStars ? "fill-[hsl(43,78%,52%)] text-[hsl(43,78%,52%)]" : "fill-white/10 text-white/10"}`}
            />
          ))}
        </div>
        <span className="text-white font-semibold text-sm">{rating.toFixed(1)}</span>
        <span className="text-white/40 text-xs">({reviewCount} reviews)</span>
        <ExternalLink className="w-3 h-3 text-white/25 group-hover:text-[hsl(43,78%,52%)] transition-colors" />
      </a>
    );
  }

  // Floating variant — shows in bottom-left corner
  return (
    <div
      className="fixed z-[9980]"
      style={{ bottom: "24px", left: "24px" }}
      data-testid="google-reviews-badge-container"
    >
      <a
        href={reviewsUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="link-google-reviews-floating"
        className="flex items-center gap-2.5 bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.1)] hover:border-[rgba(201,168,76,0.3)] rounded-xl px-3.5 py-2.5 shadow-lg transition-all group"
        aria-label={`Google Reviews: ${rating} stars`}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-2.5 h-2.5 ${i < filledStars ? "fill-[hsl(43,78%,52%)] text-[hsl(43,78%,52%)]" : "fill-white/10 text-white/10"}`}
              />
            ))}
          </div>
          <p className="text-white/60 text-[10px] leading-none">
            <span className="text-white font-semibold">{rating.toFixed(1)}</span>
            {" "}· {reviewCount} Google reviews
          </p>
        </div>
      </a>
    </div>
  );
}
