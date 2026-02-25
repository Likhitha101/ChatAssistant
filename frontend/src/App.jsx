import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid'; 
import './App.css';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const scrollRef = useRef(null);

  // 1. Session Handling: Persistent UUID in localStorage
  useEffect(() => {
    let id = localStorage.getItem('chat_session_id');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('chat_session_id', id);
    }
    setSessionId(id);
    fetchHistory(id);
  }, []);

  // 2. Auto-scroll to the latest message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchHistory = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/conversations/${id}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error("Could not load chat history.");
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: input }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection error. Please check your server." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="chat-card">
        <header className="header">
          <div className="status-dot"></div>
          <h1>Sam Support AI</h1>
        </header>

        <div className="message-list">
          {messages.length === 0 && !loading && (
            <div className="empty-state">How can I help you with our product today?</div>
          )}
          
          {messages.map((m, i) => (
            <div key={i} className={`message-row ${m.role}`}>
              <div className="bubble">
                {m.content}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="message-row assistant">
              <div className="bubble loading-bubble">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <form className="input-bar" onSubmit={handleSend}>
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;