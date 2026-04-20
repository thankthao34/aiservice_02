import { useState } from 'react';
import { aiService } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { formatPriceVndFromUsd } from '../utils/currency';

export default function ChatBot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Xin chào, mình là trợ lý AI của NEXUS Store. Bạn muốn tư vấn gì hôm nay?' }
  ]);

  const send = async (overrideText = '') => {
    const question = (overrideText || input).trim();
    if (!question || !user) return;
    localStorage.setItem('nexus_last_chat_query', question);
    if (!overrideText) setInput('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setLoading(true);

    try {
      let cartProductIds = [];
      try {
        const raw = localStorage.getItem('nexus_last_cart_product_ids') || '[]';
        cartProductIds = JSON.parse(raw);
      } catch {
        cartProductIds = [];
      }

      const searchContext = localStorage.getItem('nexus_last_search_query') || '';

      const { data } = await aiService.chat({
        user_id: user.id,
        message: question,
        search_context: searchContext,
        cart_product_ids: cartProductIds
      });
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: data.answer,
          meta: `Segment: ${data.segment} | Sources: ${(data.sources || []).join(', ')}`,
          links: data.product_links || []
        }
      ]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'AI tạm thời bận, vui lòng thử lại sau.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-wrap">
      <button className="chat-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? 'Đóng AI' : 'AI Chat'}
      </button>
      {open && (
        <div className="chat-panel card">
          <div className="chat-head">
            <strong>NEXUS AI Advisor</strong>
            {!user && <span>Đăng nhập để sử dụng</span>}
          </div>
          <div className="chat-body">
            {user && (
              <div className="chat-quick-actions">
                <button
                  className="btn ghost"
                  onClick={() => send('Goi y san pham dua tren tim kiem gan day cua toi')}
                  disabled={loading}
                >
                  Goi y theo Search
                </button>
                <button
                  className="btn ghost"
                  onClick={() => send('Tu van danh sach san pham phu hop voi gio hang hien tai')}
                  disabled={loading}
                >
                  Goi y theo Gio hang
                </button>
              </div>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={`msg ${m.role}`}>
                <p>{m.text}</p>
                {m.meta && <small>{m.meta}</small>}
                {!!m.links?.length && (
                  <div className="chat-links">
                    <small>Gợi ý sản phẩm:</small>
                    {m.links.map((link) => (
                      <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
                        {link.name} {link.price ? `- ${formatPriceVndFromUsd(link.price)}` : ''}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && <p className="typing">AI đang trả lời...</p>}
          </div>
          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi..."
              disabled={!user || loading}
            />
            <button className="btn neon" onClick={() => send()} disabled={!user || loading}>Gửi</button>
          </div>
        </div>
      )}
    </div>
  );
}
