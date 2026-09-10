import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState";

type Props = {
  prices: any[];
  formatPrice: (amount: number, currency?: any) => string;
  onSave: (index: number, item: any) => Promise<void>;
  onAdd: () => Promise<void>;
  onRemove: (index: number, title: string) => Promise<void>;
};

export default function PricesTab({
  prices,
  formatPrice,
  onSave,
  onAdd,
  onRemove,
}: Props) {
  const [drafts, setDrafts] = useState<any[]>(prices);
  const [savedAt, setSavedAt] = useState<Record<number, string>>({});
  useEffect(() => setDrafts(prices), [prices]);
  const ngn = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });
  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
            Vehicle and service classes
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Changes affect future server-calculated quotes only.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-lg">add</span>Add
          class
        </button>
      </div>
      {drafts.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map((draft, index) => {
            const source = prices[index] || {};
            const changed = JSON.stringify(draft) !== JSON.stringify(source);
            return (
              <article
                key={`${draft.title}-${index}`}
                className="rounded-lg border border-outline bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <span className="material-symbols-outlined">
                      {draft.icon || "directions_car"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(index, draft.title)}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                    aria-label={`Remove ${draft.title}`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      delete
                    </span>
                  </button>
                </div>
                <label className="mt-4 block text-sm font-semibold">
                  Class name
                  <input
                    value={draft.title || ""}
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
                  />
                </label>
                <label className="mt-3 block text-sm font-semibold">
                  Base price (NGN)
                  <input
                    type="number"
                    min="0"
                    value={draft.price || 0}
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, price: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
                  />
                </label>
                <label className="mt-3 block text-sm font-semibold">
                  Rate per kilometre (NGN)
                  <input
                    type="number"
                    min="0"
                    value={draft.kmRate || 0}
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, kmRate: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
                  />
                </label>
                <label className="mt-3 block text-sm font-semibold">
                  Description
                  <textarea
                    rows={3}
                    value={draft.desc || ""}
                    onChange={(event) =>
                      setDrafts((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, desc: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className="mt-1.5 w-full resize-none rounded-md border border-outline bg-surface-container p-3 text-sm"
                  />
                </label>
                <div className="mt-4 border-t border-outline pt-4">
                  <p className="text-sm font-bold">
                    {ngn.format(draft.price || 0)}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Selected display currency: {formatPrice(draft.price || 0)}
                  </p>
                  {savedAt[index] && (
                    <p className="mt-1 text-xs text-green-700">
                      Saved {savedAt[index]}
                    </p>
                  )}
                  {changed && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onSave(index, draft);
                        setSavedAt((current) => ({
                          ...current,
                          [index]: new Date().toLocaleTimeString(),
                        }));
                      }}
                      className="mt-4 h-10 w-full rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container"
                    >
                      Save changes
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-outline bg-white">
          <EmptyState
            icon="price_change"
            title="No price classes"
            description="Add the first service or vehicle class to start server-side quoting."
          />
        </div>
      )}
    </section>
  );
}
