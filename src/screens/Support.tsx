import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import StatusBadge from "./admin/components/StatusBadge";
import EmptyState from "./admin/components/EmptyState";
import { useAdminFeedback } from "./admin/hooks/useAdminFeedback";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  bookingId?: string;
  lastMessagePreview?: string;
  updatedAt?: string;
};
type Message = {
  id: string;
  senderRole: string;
  message: string;
  createdAt?: string;
};

export default function Support() {
  const { notify, feedbackLayer } = useAdminFeedback();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTickets = async () => {
    setLoading(true);
    try {
      setTickets(
        (await apiGet<{ tickets: Ticket[] }>("/api/support/tickets")).data
          .tickets,
      );
    } catch (error: any) {
      notify(error.message || "Support tickets could not be loaded.", "error");
    } finally {
      setLoading(false);
    }
  };

  const openTicket = async (ticket: Ticket) => {
    setSelected(ticket);
    try {
      setMessages(
        (
          await apiGet<{ messages: Message[] }>(
            `/api/support/tickets/${ticket.id}/messages`,
          )
        ).data.messages,
      );
    } catch (error: any) {
      notify(error.message || "Conversation could not be loaded.", "error");
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  const createTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiPost("/api/support/tickets", {
        subject: String(form.get("subject")),
        category: String(form.get("category")),
        priority: String(form.get("priority")),
        bookingId: String(form.get("bookingId") || "") || undefined,
        phone: String(form.get("phone") || "") || undefined,
        message: String(form.get("message")),
      });
      event.currentTarget.reset();
      await loadTickets();
      notify(
        "Support ticket opened. The operations team has been notified.",
        "success",
      );
    } catch (error: any) {
      notify(error.message || "The ticket could not be opened.", "error");
    }
  };

  const reply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await apiPost(`/api/support/tickets/${selected.id}/messages`, {
        message: String(form.get("message")),
      });
      event.currentTarget.reset();
      await openTicket(selected);
      await loadTickets();
      notify("Reply sent.", "success");
    } catch (error: any) {
      notify(error.message || "Reply could not be sent.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Customer care
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Support centre
          </h1>
          <p className="mt-3 text-base leading-7 text-on-surface-variant">
            Open a traceable request for a booking, payment, driver, or
            logistics concern. Every reply remains attached to the ticket.
          </p>
        </header>
        <div className="mt-8 grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <section className="rounded-lg border border-outline bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
                Open a ticket
              </h2>
              <form onSubmit={createTicket} className="mt-5 space-y-4">
                <Field name="subject" label="Subject" />
                <label className="block text-sm font-semibold">
                  Category
                  <select
                    name="category"
                    className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
                  >
                    <option value="booking">Booking</option>
                    <option value="payment">Payment</option>
                    <option value="driver">Driver</option>
                    <option value="logistics">Logistics</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <label className="block text-sm font-semibold">
                    Priority
                    <select
                      name="priority"
                      className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                  <Field
                    name="bookingId"
                    label="Booking ID (optional)"
                    required={false}
                  />
                </div>
                <Field
                  name="phone"
                  label="WhatsApp phone (optional)"
                  required={false}
                />
                <label className="block text-sm font-semibold">
                  Message
                  <textarea
                    name="message"
                    required
                    minLength={10}
                    rows={5}
                    className="mt-1.5 w-full resize-none rounded-md border border-outline bg-surface-container p-3 text-sm"
                  />
                </label>
                <button className="h-11 w-full rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container">
                  Open ticket
                </button>
              </form>
            </section>
          </div>
          <section className="overflow-hidden rounded-lg border border-outline bg-white shadow-sm">
            <div className="border-b border-outline px-5 py-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
                Your requests
              </h2>
            </div>
            {loading ? (
              <div className="animate-pulse space-y-3 p-5">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-20 rounded-lg bg-surface-container"
                  />
                ))}
              </div>
            ) : tickets.length ? (
              <div className="grid min-h-[520px] md:grid-cols-[260px_1fr]">
                <div className="border-b border-outline md:border-b-0 md:border-r">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => openTicket(ticket)}
                      className={`block w-full border-b border-outline p-4 text-left hover:bg-surface-container ${selected?.id === ticket.id ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-bold">
                          {ticket.subject}
                        </p>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-on-surface-variant">
                        {ticket.lastMessagePreview}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="flex min-h-[420px] flex-col">
                  {selected ? (
                    <>
                      <div className="border-b border-outline p-4">
                        <h3 className="font-bold">{selected.subject}</h3>
                        <p className="mt-1 font-mono text-xs text-on-surface-variant">
                          #{selected.id}
                        </p>
                      </div>
                      <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {messages.map((message) => (
                          <article
                            key={message.id}
                            className={`max-w-[85%] rounded-lg p-3 text-sm ${message.senderRole === "customer" ? "ml-auto bg-primary text-white" : "bg-surface-container text-on-surface"}`}
                          >
                            <p className="leading-6">{message.message}</p>
                            <p className="mt-1 text-xs opacity-70">
                              {message.createdAt
                                ? new Date(message.createdAt).toLocaleString()
                                : "Sending"}
                            </p>
                          </article>
                        ))}
                      </div>
                      {selected.status !== "closed" && (
                        <form
                          onSubmit={reply}
                          className="flex gap-2 border-t border-outline p-4"
                        >
                          <input
                            name="message"
                            required
                            placeholder="Write a reply"
                            className="h-11 min-w-0 flex-1 rounded-md border border-outline bg-surface-container px-3 text-sm"
                          />
                          <button
                            className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white"
                            aria-label="Send reply"
                          >
                            <span className="material-symbols-outlined">
                              send
                            </span>
                          </button>
                        </form>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      icon="support_agent"
                      title="Select a ticket"
                      description="Choose a request to read its full conversation."
                    />
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon="support_agent"
                title="No support tickets"
                description="Open a request and the operations team will follow it through to resolution."
              />
            )}
          </section>
        </div>
      </div>
      {feedbackLayer}
    </div>
  );
}

function Field({
  name,
  label,
  required = true,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        name={name}
        required={required}
        className="mt-1.5 h-11 w-full rounded-md border border-outline bg-surface-container px-3 text-sm"
      />
    </label>
  );
}
