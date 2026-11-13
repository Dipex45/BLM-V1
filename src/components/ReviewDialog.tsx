import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { apiErrorMessage, apiPost } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { BookingRecord } from '../hooks/useMyBookings';
import { easeOutExpo, Spinner } from './ui/motion';

export default function ReviewDialog({ booking, onClose, onSubmitted }: { booking: BookingRecord; onClose: () => void; onSubmitted?: () => void }) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<File[]>([]);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const photoUrls = await Promise.all(photos.map(async (file) => {
        const fileRef = storageRef(storage, `review-photos/${user!.uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
        await uploadBytes(fileRef, file, { contentType: file.type });
        return getDownloadURL(fileRef);
      }));
      await apiPost('/api/reviews', { bookingId: booking.id, rating, title: title.trim(), comment: comment.trim(), photoUrls });
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'We couldn’t post your review. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form onSubmit={submit} onClick={(event) => event.stopPropagation()} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ ease: easeOutExpo, duration: 0.4 }} className="card w-full max-w-lg p-6 sm:p-8" role="dialog" aria-modal="true" aria-label="Review your trip">
        <h2 className="text-xl font-bold">How was your trip?</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{booking.serviceType} · {booking.date}</p>
        <div className="mt-5 flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <motion.button key={value} type="button" whileTap={{ scale: 0.85 }} onClick={() => setRating(value)} role="radio" aria-checked={rating === value} aria-label={`${value} star${value > 1 ? 's' : ''}`}>
              <span className={`material-symbols-outlined text-4xl ${value <= rating ? 'fill-icon text-amber-500' : 'text-outline-variant'}`}>star</span>
            </motion.button>
          ))}
        </div>
        <label className="mt-5 block"><span className="field-label">Title</span><input required minLength={3} maxLength={120} className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Smooth ride to Cotonou" /></label>
        <label className="mt-4 block"><span className="field-label">Your review</span><textarea required minLength={10} maxLength={1500} rows={4} className="field resize-none" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How were the driver, the car and the timing? (at least 10 characters)" /></label>
        <label className="mt-4 block">
          <span className="field-label">Photos <span className="font-normal text-on-surface-variant">(optional, up to 4)</span></span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="field" onChange={(e) => {
            const files = Array.from(e.target.files || []).filter((file) => file.size < 5 * 1024 * 1024).slice(0, 4);
            setPhotos(files);
          }} />
        </label>
        {error && <p className="alert-error mt-4 text-xs">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">{busy ? <><Spinner /> Posting…</> : 'Post review'}</button>
        </div>
      </motion.form>
    </motion.div>
  );
}
