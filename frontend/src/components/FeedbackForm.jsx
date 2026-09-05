import { useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareHeart } from 'lucide-react';
import api from '../services/api';
import { useToast } from './Toast';
import StarRating from './StarRating';
import { BTN_PRIMARY, INPUT_CLASS, LABEL_CLASS } from './ui';

const MAX_COMMENTS = 2000;

/**
 * Star rating + comment form for a delivered order. Handles its own submission
 * to POST /api/feedback so any screen (the dashboard modal or the dedicated
 * order-details page) can render the exact same, professional control.
 */
export default function FeedbackForm({ orderId, onSuccess, submitLabel = 'Submit feedback' }) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (rating === 0) {
      toast.error('Please select a star rating first.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/feedback', { orderId, rating, comments: comments.trim() });
      toast.success('Thank you — your feedback has been recorded.');
      onSuccess?.(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <span className={LABEL_CLASS}>Overall rating</span>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
          <StarRating value={rating} onChange={setRating} size="lg" showValue />
          <p className="hidden text-xs text-gray-400 sm:block">
            Tap a star to rate your overall experience.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="feedback-comments" className={LABEL_CLASS}>
          Comments
          <span className="ml-1 text-gray-400">(optional)</span>
        </label>
        <textarea
          id="feedback-comments"
          rows={4}
          maxLength={MAX_COMMENTS}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          className={INPUT_CLASS}
          placeholder="What did you think of the fit, quality and turnaround time?"
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <MessageSquareHeart className="mr-1 inline h-3.5 w-3.5" />
            Your review helps us and your tailor improve.
          </p>
          <p className="text-xs tabular-nums text-gray-400">
            {comments.length}/{MAX_COMMENTS}
          </p>
        </div>
      </div>

      <button type="submit" disabled={submitting || rating === 0} className={`${BTN_PRIMARY} w-full`}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {submitting ? 'Submitting…' : submitLabel}
      </button>
    </form>
  );
}
