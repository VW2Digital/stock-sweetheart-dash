import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { translateValue } from '@/lib/translateValue';
import { useAITranslateBatch } from '@/hooks/useAITranslate';

interface ReviewsListProps {
  orders: any[];
  reviews: any[];
  lang: string;
  t: (key: string) => string;
  dateLocaleMap: Record<string, string>;
  reviewingOrderId: string | null;
  setReviewingOrderId: (id: string | null) => void;
  reviewRating: number;
  setReviewRating: (n: number) => void;
  reviewComment: string;
  setReviewComment: (s: string) => void;
  reviewSaving: boolean;
  submitReview: (orderId: string, productName: string) => void;
  renderEditor: (order: any, existingReview: any, isReviewing: boolean) => React.ReactNode;
}

export default function ReviewsList({
  orders, reviews, lang, t, dateLocaleMap,
  reviewingOrderId, setReviewingOrderId,
  setReviewRating, setReviewComment,
  renderEditor,
}: ReviewsListProps) {
  // Build stable lists of texts to translate (product names + review comments)
  const productNames = useMemo(
    () => orders.map(o => translateValue(o.product_name || '')),
    [orders],
  );
  const comments = useMemo(() => {
    return orders.map(o => {
      const r = reviews.find(rv => rv.order_id === o.id);
      return r?.comment || '';
    });
  }, [orders, reviews]);

  const translatedNames = useAITranslateBatch(productNames, lang);
  const translatedComments = useAITranslateBatch(comments, lang);

  return (
    <div className="space-y-3">
      {orders.map((order, idx) => {
        const existingReview = reviews.find(r => r.order_id === order.id);
        const isReviewing = reviewingOrderId === order.id;
        const displayName = translatedNames[idx] || translateValue(order.product_name);
        const displayComment = translatedComments[idx] || existingReview?.comment;

        return (
          <div
            key={order.id}
            data-review-order={order.id}
            className={`border rounded-lg p-4 space-y-3 transition-colors ${isReviewing ? 'border-primary/60 bg-primary/5' : 'border-border/50'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {order.dosage && `${translateValue(order.dosage)} · `}
                  {t('order')} #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleDateString(dateLocaleMap[lang])}
                </p>
              </div>
              {existingReview ? (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${s <= existingReview.rating ? 'text-primary fill-primary' : 'text-muted-foreground/30'}`} />
                  ))}
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReviewingOrderId(isReviewing ? null : order.id);
                    setReviewRating(5);
                    setReviewComment('');
                  }}
                >
                  <Star className="w-4 h-4 mr-1" /> {t('review')}
                </Button>
              )}
            </div>

            {existingReview && existingReview.comment && (
              <p className="text-sm text-muted-foreground italic">"{displayComment}"</p>
            )}

            {renderEditor(order, existingReview, isReviewing)}
          </div>
        );
      })}
    </div>
  );
}