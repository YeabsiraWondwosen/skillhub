import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSupportTicket, useReplyToTicket, useRateTicket } from '@/hooks/useSupport';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Star } from 'lucide-react';

export default function TicketDetailPage() {
  const { ticketId } = useParams();
  const { data: ticketData, isLoading } = useSupportTicket(ticketId);
  const { mutate: reply, isPending: isReplying } = useReplyToTicket();
  const { mutate: rate } = useRateTicket();
  const [replyContent, setReplyContent] = useState('');
  const [rating, setRating] = useState(0);

  const ticket = ticketData?.data?.data;

  if (isLoading) return <div className="page-container flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;
  if (!ticket) return <div className="page-container text-center py-20"><h2>Ticket not found</h2></div>;

  const handleReply = (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    reply({ ticketId, content: replyContent.trim() }, { onSuccess: () => setReplyContent('') });
  };

  return (
    <div className="page-container max-w-3xl mx-auto space-y-6">
      <Link to="/support" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Support
      </Link>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{ticket.ticketId}</span>
            <Badge status={ticket.status}>{ticket.status.replace(/_/g, ' ')}</Badge>
            <Badge status={ticket.priority}>{ticket.priority}</Badge>
            <span className="text-xs text-gray-400 capitalize">{ticket.category?.replace(/_/g, ' ')}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{ticket.subject}</h1>
          <p className="text-xs text-gray-400 mt-1">Created {new Date(ticket.createdAt).toLocaleDateString()}</p>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Conversation ({ticket.messages?.length || 0} messages)</h2>
        {ticket.messages?.map((msg, i) => (
          <div key={i} className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
              msg.senderType === 'user'
                ? 'bg-primary-500 text-white rounded-br-md'
                : 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-white rounded-bl-md'
            }`}>
              <p className="text-xs opacity-60 mb-1">{msg.senderType === 'user' ? 'You' : msg.senderType === 'admin' ? 'Support Team' : 'AI Assistant'}</p>
              {msg.content}
              <p className="text-[10px] opacity-50 mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply */}
      {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
        <form onSubmit={handleReply} className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Reply</h2>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Type your reply..."
            className="input min-h-[100px]"
          />
          <Button type="submit" loading={isReplying} disabled={!replyContent.trim()}>Send Reply</Button>
        </form>
      )}

      {/* Rating */}
      {ticket.status === 'resolved' && !ticket.satisfactionRating && (
        <div className="card p-6 text-center">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Rate this support experience</h2>
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => { rate({ ticketId, rating: star }); setRating(star); }}
                className={`text-2xl ${rating >= star ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'} hover:scale-110 transition-transform`}
              >
                <Star size={26} className={rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
