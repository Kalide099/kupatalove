/**
 * KupataLove Chat Module
 * Real-time messaging with Socket.IO + auto-translation badges
 */

class ChatModule {
  constructor(api, socket) {
    this.api = api;
    this.socket = socket;
    this.activeMatchId = null;
    this.typingTimer = null;
    this.isTyping = false;
    this.messages = [];
  }

  async openChat(matchId, otherUser, icebreaker) {
    this.activeMatchId = matchId;

    const chatView = document.getElementById('chat-view');
    const matchesPanel = document.getElementById('matches-panel');
    chatView.classList.remove('hidden');
    matchesPanel?.classList.add('hidden');

    // Populate header
    document.getElementById('chat-user-name').textContent = otherUser?.name || 'Match';
    document.getElementById('chat-back-btn').onclick = () => this.closeChat();

    const avatar = document.getElementById('chat-user-avatar');
    if (avatar) {
      if (otherUser?.avatar) {
        avatar.src = otherUser.avatar;
        avatar.classList.remove('hidden');
      } else {
        avatar.classList.add('hidden');
      }
    }

    // Join socket room
    this.socket?.emit('join_match', { matchId });

    // Show icebreaker if first chat
    const icebreakerBanner = document.getElementById('icebreaker-banner');
    if (icebreaker && icebreakerBanner) {
      icebreakerBanner.querySelector('.icebreaker-text').textContent = icebreaker;
      icebreakerBanner.classList.remove('hidden');
      icebreakerBanner.onclick = () => {
        document.getElementById('chat-input').value = icebreaker;
        icebreakerBanner.classList.add('hidden');
        document.getElementById('chat-input').focus();
      };
    }

    // Load messages
    await this.loadMessages(matchId);

    // Setup send
    const sendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');

    const sendMessage = () => this.sendMessage();
    sendBtn.onclick = sendMessage;
    chatInput.onkeypress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
    chatInput.oninput = () => this.handleTyping();

    // Mark read
    this.socket?.emit('mark_read', { matchId });

    // Setup audio recording
    this.setupAudioRecording();
  }

  setupAudioRecording() {
    const micBtn = document.getElementById('chat-mic-btn');
    if (!micBtn) return;
    
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    micBtn.onclick = async () => {
      if (!isRecording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];
          
          mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voicenote.webm');
            
            try {
              window.KL_Toast?.show('Uploading voice note...', 'info');
              await this.api.upload(`/conversations/${this.activeMatchId}/audio`, formData);
            } catch (err) {
              window.KL_Toast?.show('Failed to send audio', 'error');
            }
          };

          mediaRecorder.start();
          isRecording = true;
          micBtn.textContent = '⏹️';
          micBtn.style.color = 'red';
          window.KL_Toast?.show('Recording started...', 'info', 2000);
        } catch (err) {
          window.KL_Toast?.show('Microphone access denied', 'error');
        }
      } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        isRecording = false;
        micBtn.textContent = '🎙️';
        micBtn.style.color = '';
      }
    };
  }

  async loadMessages(matchId) {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;">Loading...</div>';

    try {
      const messages = await this.api.get(`/conversations/${matchId}/messages`);
      this.messages = messages;
      this.renderMessages(messages);
    } catch (err) {
      messagesContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);">Failed to load messages</div>';
    }
  }

  renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    const currentUser = window.KL_API.getUser();
    container.innerHTML = '';

    if (messages.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.9rem;margin-top:40px;">Send a message to start the conversation! 💬</div>';
      return;
    }

    messages.forEach(msg => this.appendMessage(msg, currentUser.id, false));
    this.scrollToBottom();
  }

  appendMessage(msg, currentUserId, animate = true) {
    const container = document.getElementById('chat-messages');
    const isSent = msg.sender_id === currentUserId;
    const el = document.createElement('div');
    el.className = `message ${isSent ? 'sent' : 'received'}`;

    const time = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const readIcon = isSent ? (msg.is_read ? '✓✓' : '✓') : '';
    const readClass = isSent && msg.is_read ? 'msg-read' : '';

    // Show translated text for recipients, original for senders
    const displayText = (!isSent && msg.is_translated && msg.translated_text)
      ? msg.translated_text
      : msg.original_text;

    const translationBadge = (!isSent && msg.is_translated)
      ? `<div class="translated-badge" onclick="this.nextElementSibling.classList.toggle('show')">
           🌐 Translated — tap to see original
         </div>
         <div class="original-text">${msg.original_text}</div>`
      : '';

    let contentHtml = '';
    if (msg.message_type === 'audio') {
      contentHtml = `
        <audio controls src="${msg.attachment_url}" style="max-width:200px;"></audio>
        <div style="margin-top:8px;font-size:0.9rem;font-style:italic;">"${this.escapeHtml(displayText)}"</div>
      `;
    } else {
      contentHtml = `<div class="bubble">${this.escapeHtml(displayText)}</div>`;
    }

    el.innerHTML = `
      ${contentHtml}
      ${translationBadge}
      <div class="msg-meta">
        <span>${time}</span>
        ${readIcon ? `<span class="${readClass}">${readIcon}</span>` : ''}
      </div>`;

    if (animate) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      container.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transition = 'all 0.2s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    } else {
      container.appendChild(el);
    }
  }

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !this.activeMatchId) return;

    input.value = '';
    this.clearTyping();

    const currentUser = window.KL_API.getUser();

    // Optimistic UI
    const tempMsg = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.id,
      original_text: text,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    this.appendMessage(tempMsg, currentUser.id);
    this.scrollToBottom();

    try {
      // Send via socket for real-time delivery
      if (this.socket?.connected) {
        this.socket.emit('send_message', {
          matchId: this.activeMatchId,
          text,
          messageType: 'text',
        });
      } else {
        // Fallback to REST
        await this.api.post(`/conversations/${this.activeMatchId}/messages`, { text });
      }
    } catch (err) {
      console.error('Send error:', err);
      window.KL_Toast?.show('Failed to send message', 'error');
    }
  }

  handleNewMessage(msg) {
    if (msg.match_id !== this.activeMatchId) return;
    const currentUser = window.KL_API.getUser();
    this.appendMessage(msg, currentUser.id);
    this.scrollToBottom();
    this.socket?.emit('mark_read', { matchId: this.activeMatchId });
  }

  handleTyping() {
    if (!this.isTyping) {
      this.isTyping = true;
      this.socket?.emit('typing', { matchId: this.activeMatchId, isTyping: true });
    }
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.clearTyping(), 2000);
  }

  clearTyping() {
    if (this.isTyping) {
      this.isTyping = false;
      this.socket?.emit('typing', { matchId: this.activeMatchId, isTyping: false });
    }
  }

  showTypingIndicator(show, senderName) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.style.display = show ? 'flex' : 'none';
    }
  }

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
  }

  closeChat() {
    this.activeMatchId = null;
    this.clearTyping();
    document.getElementById('chat-view')?.classList.add('hidden');
    document.getElementById('matches-panel')?.classList.remove('hidden');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }
}

window.ChatModule = ChatModule;
