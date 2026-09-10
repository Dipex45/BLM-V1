import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../lib/api";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  customerEmail?: string;
  bookingId?: string;
};
type Message = {
  id: string;
  senderRole: string;
  message: string;
  createdAt?: string;
};

export default function SupportTab({
  tickets,
  onRefresh,
}: {
  tickets: Ticket[];
  onRefresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const loadMessages = async (ticket: Ticket) => {
    setSelected(ticket);
    const response = await apiGet<{ messages: Message[] }>(
      `/api/support/tickets/${ticket.id}/messages`,
    );
    setMessages(response.data.messages);
  };

  useEffect(() => {
    if (selected) void loadMessages(selected);
  }, [tickets]);

  const reply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await apiPost(`/api/support/tickets/${selected.id}/messages`, {
      message: String(form.get("message")),
    });
    event.currentTarget.reset();
    await loadMessages(selected);
    await onRefresh();
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    await apiPost(`/api/support/tickets/${selected.id}/status`, { status });
    setSelected({ ...selected, status });
    await onRefresh();
  };

  return (
    <section className="grid min-h-[640px] overflow-hidden rounded-lg border border-outline bg-white shadow-sm lg:grid-cols-[340px_1fr]">
      <div className="border-b border-outline lg:border-b-0 lg:border-r">
        <div className="border-b border-outline p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
            Support queue
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            {
              tickets.filter(
                (ticket) => !["resolved", "closed"].includes(ticket.status),
              ).length
            }{" "}
            active requests
          </p>
        </div>
        {tickets.length ? (
          <div className="divide-y divide-outline">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => loadMessages(ticket)}
                className={`w-full p-4 text-left hover:bg-surface-container ${selected?.id === ticket.id ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-bold">
                    {ticket.subject}
                  </p>
                  <StatusBadge status={ticket.status} />
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {ticket.customerEmail || "Customer"} / {ticket.category}
                </p>
                {ticket.priority === "urgent" && (
                  <p className="mt-2 text-xs font-bold text-red-700">Urgent</p>
                )}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="support_agent"
            title="Queue is clear"
            description="New customer requests will appear here."
          />
        )}
      </div>
      <div className="flex min-h-[500px] flex-col">
        {selected ? (
          <>
            <header className="flex flex-col gap-3 border-b border-outline p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Ticket #{selected.id.slice(-8)}
                </p>
                <h3 className="mt-1 text-lg font-bold">{selected.subject}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {selected.customerEmail}
                  {selected.bookingId ? ` / Booking ${selected.bookingId}` : ""}
                </p>
              </div>
              <select
                value={selected.status}
                onChange={(event) => updateStatus(event.target.value)}
                className="h-10 rounded-md border border-outline bg-white px-3 text-sm font-semibold"
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting_customer">Waiting for customer</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-background p-5">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[82%] rounded-lg border p-3 text-sm ${message.senderRole === "customer" ? "border-outline bg-white" : "ml-auto border-primary/20 bg-primary/10"}`}
                >
                  <p className="leading-6">{message.message}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {message.senderRole.replaceAll("_", " ")} /{" "}
                    {message.createdAt
                      ? new Date(message.createdAt).toLocaleString()
                      : ""}
                  </p>
                </article>
              ))}
            </div>
            {selected.status !== "closed" && (
              <form
                onSubmit={reply}
                className="flex gap-3 border-t border-outline p-4"
              >
                <input
                  name="message"
                  required
                  placeholder="Reply to customer"
                  className="h-11 min-w-0 flex-1 rounded-md border border-outline bg-surface-container px-3 text-sm"
                />
                <button className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-primary-container">
                  <span className="material-symbols-outlined text-lg">
                    send
                  </span>
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            )}
          </>
        ) : (
          <EmptyState
            icon="forum"
            title="Select a support request"
            description="Read the conversation, reply, and manage its resolution state."
          />
        )}
      </div>
    </section>
  );
}
