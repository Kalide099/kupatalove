/**
 * KupataLove — Main App Shell
 * Orchestrates all tabs, Socket.IO, notifications, and user session
 */

document.addEventListener('DOMContentLoaded', async () => {
  const { api, getUser, setUser, clearTokens, getAccessToken } = window.KL_API;
  const { initI18n, t } = window.KL_I18n;

  // Guard: must be logged in
  const user = getUser();
  if (!user || !getAccessToken()) {
    window.location.href = '/auth.html';
    return;
  }

  // Init i18n with user's language
  await initI18n(user.language || 'en');

  // ─── Toast Notification System ──────────────────────────────
  const toastContainer = document.getElementById('toast-container');
  const toast = {
    show: (message, type = 'info', duration = 4000) => {
      const icons = { success: '✅', error: '❌', info: '💬', match: '💕' };
      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      el.innerHTML = `
        <span class="toast-icon">${icons[type] || '💬'}</span>
        <span class="toast-text">${message}</span>
        <span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
      toastContainer.appendChild(el);
      setTimeout(() => {
        el.style.animation = 'slide-out-right 0.3s ease forwards';
        setTimeout(() => el.remove(), 300);
      }, duration);
    }
  };
  window.KL_Toast = toast;

  // ─── Socket.IO Connection ───────────────────────────────────
  const socket = io({ auth: { token: getAccessToken() } });
  socket.on('connect', () => console.log('🟢 Socket connected'));
  socket.on('connect_error', (err) => console.warn('Socket error:', err.message));

  // ─── Chat Module ─────────────────────────────────────────────
  const chatModule = new ChatModule(api, socket);

  // Socket events
  socket.on('new_message', (msg) => {
    chatModule.handleNewMessage(msg);
  });
  socket.on('user_typing', ({ userId, isTyping }) => {
    if (userId !== user.id) chatModule.showTypingIndicator(isTyping);
  });
  socket.on('messages_read', ({ matchId }) => {
    // Update read receipts in UI
    document.querySelectorAll('.message.sent .msg-read').forEach(el => el.textContent = '✓✓');
  });
  socket.on('new_match', ({ matchId, fromUserName, fromUserAvatar }) => {
    showMatchCelebration({ matchId, userName: fromUserName, userAvatar: fromUserAvatar });
    toast.show(`You matched with ${fromUserName}! 💕`, 'match', 5000);
    updateBadges();
  });
  socket.on('notification', ({ type, senderName, preview }) => {
    if (type === 'new_message') {
      toast.show(`${senderName}: ${preview}`, 'info');
      updateBadges();
    }
  });

  // ─── Tab Navigation ──────────────────────────────────────────
  const tabs = {
    discover: document.getElementById('tab-discover'),
    matches:  document.getElementById('tab-matches'),
    likes:    document.getElementById('tab-likes'),
    profile:  document.getElementById('tab-profile'),
    subscription: document.getElementById('tab-subscription'),
  };

  const navBtns = document.querySelectorAll('[data-tab]');

  const switchTab = (tabName) => {
    Object.values(tabs).forEach(tab => tab?.classList.remove('active'));
    tabs[tabName]?.classList.add('active');
    navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    // Close chat if switching away from matches
    if (tabName !== 'matches') chatModule.closeChat();
    loadTab(tabName);
  };
  window.switchTab = switchTab;
  window.showReportModal = () => {
    window.KL_Toast?.show('Report feature will be available soon', 'info');
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Check URL params for tab
  const params = new URLSearchParams(location.search);
  const initialTab = params.get('tab') || 'discover';

  // Subscription success toast
  if (params.get('status') === 'success') {
    toast.show(`🎉 Welcome to ${params.get('plan')} plan!`, 'success');
  }

  // ─── Tab Loaders ─────────────────────────────────────────────
  let discoverPage = 0;
  let discoverProfiles = [];
  let swipeUI = null;

  const loadTab = async (tab) => {
    switch (tab) {
      case 'discover':  await loadDiscover(); break;
      case 'matches':   await loadMatches(); break;
      case 'likes':     await loadLikes(); break;
      case 'profile':   await loadProfile(); break;
      case 'subscription': await loadSubscription(); break;
    }
  };

  // ─── Discover ───────────────────────────────────────────────
  const loadDiscover = async () => {
    if (swipeUI && discoverProfiles.length > 0) return; // Already loaded

    const stack = document.getElementById('card-stack');
    stack.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div class="spinner"></div></div>';

    try {
      const data = await api.get(`/discover?page=${discoverPage}&limit=10`);
      discoverProfiles = data.profiles || [];

      swipeUI = new SwipeUI(stack, handleSwipe);
      swipeUI.render(discoverProfiles);

      swipeUI.loadMore = async () => {
        discoverPage++;
        const more = await api.get(`/discover?page=${discoverPage}&limit=10`);
        if (more.profiles?.length) {
          swipeUI.profiles = swipeUI.profiles.concat(more.profiles);
        }
      };

      // Update likes counter
      const likeCounter = document.getElementById('likes-counter');
      if (likeCounter && user.subscription_plan === 'free') {
        likeCounter.textContent = `${user.likes_left_today || 0} likes left today`;
      }
    } catch (err) {
      stack.innerHTML = `<div class="no-cards"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
    }
  };

  const handleSwipe = async (profile, type) => {
    try {
      const result = await api.post(`/likes/${profile.id}`, { type });
      if (result.isMatch) {
        showMatchCelebration({
          matchId: result.match.id,
          userName: result.match.userName,
          userAvatar: result.match.userAvatar,
          icebreaker: result.match.icebreaker,
        });
        socket.emit('match_made', { matchId: result.match.id, otherUserId: profile.id });
        updateBadges();
      }
    } catch (err) {
      if (err.data?.code === 'LIKE_LIMIT_REACHED') {
        toast.show('Daily likes used up! Upgrade to Gold for unlimited likes 💛', 'error', 5000);
      } else {
        console.warn('Swipe error:', err.message);
      }
    }
  };

  // Action buttons
  document.getElementById('btn-dislike')?.addEventListener('click', () => swipeUI?.swipe('left'));
  document.getElementById('btn-like')?.addEventListener('click', () => swipeUI?.swipe('right'));
  document.getElementById('btn-superlike')?.addEventListener('click', () => swipeUI?.swipe('up'));
  document.getElementById('btn-rewind')?.addEventListener('click', () => {
    if (user.subscription_plan === 'free') {
      toast.show('Rewind requires Gold subscription 💛', 'error');
      return;
    }
    if (swipeUI && swipeUI.currentIndex > 0) {
      swipeUI.currentIndex--;
      swipeUI.renderStack();
    }
  });

  // ─── Match Celebration ───────────────────────────────────────
  const celebrationModal = document.getElementById('match-celebration');

  const showMatchCelebration = ({ matchId, userName, userAvatar, icebreaker }) => {
    document.getElementById('match-name').textContent = userName || 'Someone';
    const img = document.getElementById('match-avatar');
    if (userAvatar && img) { img.src = userAvatar; img.classList.remove('hidden'); }

    celebrationModal.classList.remove('hidden');

    // Confetti
    for (let i = 0; i < 50; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.cssText = `
        left:${Math.random() * 100}%;
        background:${['#ff3d6e','#ffd166','#6c63ff','#22c55e'][Math.floor(Math.random() * 4)]};
        animation-duration:${2 + Math.random() * 2}s;
        animation-delay:${Math.random() * 0.5}s;
        width:${6 + Math.random() * 8}px;
        height:${6 + Math.random() * 8}px;
      `;
      celebrationModal.appendChild(c);
      setTimeout(() => c.remove(), 4000);
    }

    document.getElementById('btn-send-message')?.addEventListener('click', () => {
      celebrationModal.classList.add('hidden');
      switchTab('matches');
      setTimeout(() => {
        if (matchId) chatModule.openChat(matchId, { name: userName, avatar: userAvatar }, icebreaker);
      }, 200);
    }, { once: true });

    document.getElementById('btn-keep-swiping')?.addEventListener('click', () => {
      celebrationModal.classList.add('hidden');
    }, { once: true });
  };

  // ─── Matches ─────────────────────────────────────────────────
  let matchesData = [];

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const loadMatches = async () => {
    const container = document.getElementById('matches-list');
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px;"><div class="spinner"></div></div>';

    try {
      matchesData = await api.get('/likes/matches');

      // New matches row
      const newRow = document.getElementById('new-matches-row');
      newRow.innerHTML = matchesData.slice(0, 10).map(m => `
        <div class="new-match-item" onclick="openChatFromMatch(${m.matchId}, ${m.userId}, ${JSON.stringify(m.name || 'User')}, ${JSON.stringify(m.avatar || '')}, ${JSON.stringify(m.ai_icebreaker || '')})">
          <div class="new-match-avatar">
            ${m.avatar
              ? `<img src="${escapeHtml(m.avatar)}" alt="${escapeHtml(m.name || 'User')}">`
              : `<div class="avatar-placeholder" style="width:64px;height:64px;font-size:1.2rem">${escapeHtml((m.name || 'U').charAt(0))}</div>`}
          </div>
          <span class="new-match-name">${escapeHtml(m.name || 'User')}</span>
        </div>`).join('');

      // Conversations
      container.innerHTML = matchesData.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);padding:60px 20px;">No matches yet — start swiping! 💘</div>'
        : matchesData.map(m => `
          <div class="conversation-item" onclick="openChatFromMatch(${m.matchId}, ${m.userId}, ${JSON.stringify(m.name || 'User')}, ${JSON.stringify(m.avatar || '')}, ${JSON.stringify(m.ai_icebreaker || '')})">
            ${m.avatar
              ? `<img class="avatar avatar-md" src="${escapeHtml(m.avatar)}" alt="${escapeHtml(m.name || 'User')}">`
              : `<div class="avatar-placeholder avatar-md" style="font-size:1.1rem">${escapeHtml((m.name || 'U').charAt(0))}</div>`}
            <div class="conv-info">
              <div class="conv-top">
                <span class="conv-name">${escapeHtml(m.name || 'User')}</span>
                <span class="conv-time">${formatTime(m.createdAt)}</span>
              </div>
              <div class="conv-preview">${escapeHtml(m.ai_icebreaker ? '🤖 ' + m.ai_icebreaker.slice(0, 50) + '...' : 'Start a conversation!')}</div>
            </div>
            <div class="badge badge-primary" style="font-size:0.72rem">${m.ai_compatibility_score || 75}%</div>
          </div>`).join('');

    } catch (err) {
      container.innerHTML = `<div style="color:var(--text-muted);">${err.message}</div>`;
    }
  };

  window.openChatFromMatch = (matchId, userId, name, avatar, icebreaker) => {
    chatModule.openChat(matchId, { id: userId, name, avatar }, icebreaker);
  };

  // ─── Likes (who liked me) ─────────────────────────────────────
  const loadLikes = async () => {
    const container = document.getElementById('likes-grid');
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px;"><div class="spinner"></div></div>';

    try {
      const likes = await api.get('/likes/liked-me');
      container.innerHTML = likes.length === 0
        ? '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">No likes yet — you\'ll get there! 💪</div>'
        : likes.map(l => `
          <div class="like-card" onclick="window.location.href='/app.html?tab=discover'">
            <div style="aspect-ratio:3/4;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;font-size:3rem;">😊</div>
            <div class="like-card-info">
              <div class="like-card-name">${l.name}</div>
              <div class="like-card-type">${l.type === 'superlike' ? '⭐ Super liked you' : '❤️ Liked you'}</div>
            </div>
          </div>`).join('');
    } catch (err) {
      if (err.data?.code === 'SUBSCRIPTION_REQUIRED') {
        container.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:40px;max-width:400px;margin:0 auto;">
            <div style="font-size:4rem;margin-bottom:16px;">👀</div>
            <h3>See who liked you</h3>
            <p style="color:var(--text-muted);margin:12px 0 20px;">Upgrade to Gold to see everyone who liked your profile</p>
            <button class="btn btn-primary" onclick="switchTab('subscription')" data-i18n="upgrade_to_gold">Upgrade to Gold</button>
          </div>`;
      }
    }
  };

  // ─── Profile ─────────────────────────────────────────────────
  const loadProfile = async () => {
    try {
      const profile = await api.get('/profile/me');
      setUser(profile);

      document.getElementById('profile-name').textContent = profile.name;
      document.getElementById('profile-bio-input').value = profile.bio || '';
      document.getElementById('profile-city-input').value = profile.city || '';
      document.getElementById('profile-job-input').value = profile.job_title || '';
      document.getElementById('profile-education-input').value = profile.education || '';

      const age = profile.birthdate
        ? Math.floor((Date.now() - new Date(profile.birthdate)) / (1000 * 60 * 60 * 24 * 365.25))
        : '';
      document.getElementById('profile-tagline').textContent = age ? `${age} years old · ${profile.city || ''}` : '';

      // Prompts
      const prompts = profile.prompts || [];
      if (prompts[0]) {
        document.getElementById('prompt-select-1').value = prompts[0].question || '';
        document.getElementById('prompt-answer-1').value = prompts[0].answer || '';
      }
      if (prompts[1]) {
        document.getElementById('prompt-select-2').value = prompts[1].question || '';
        document.getElementById('prompt-answer-2').value = prompts[1].answer || '';
      }

      // Photos grid
      const grid = document.getElementById('photos-grid');
      const photos = profile.photos || [];
      grid.innerHTML = '';
      for (let i = 0; i < 6; i++) {
        const slot = document.createElement('div');
        slot.className = 'photo-slot';
        if (photos[i]) {
          slot.innerHTML = `
            <img src="${photos[i].url}" alt="Photo ${i+1}">
            <div class="photo-delete" onclick="deletePhoto(${photos[i].id}, this)">✕</div>`;
        } else {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.className = 'hidden';
          input.onchange = (e) => uploadPhoto(e.target.files[0]);
          slot.innerHTML = `<div class="add-photo"><span>+</span><span>Add photo</span></div>`;
          slot.onclick = () => input.click();
          slot.appendChild(input);
        }
        grid.appendChild(slot);
      }

      // Subscription plan badge
      const planBadge = document.getElementById('profile-plan-badge');
      if (planBadge) {
        const plans = { free: '🆓 Free', gold: '💛 Gold', platinum: '💜 Platinum' };
        planBadge.textContent = plans[profile.subscription_plan] || 'Free';
      }
    } catch (err) {
      console.error('Load profile error:', err);
    }
  };

  window.deletePhoto = async (photoId, btn) => {
    try {
      await api.delete(`/profile/me/photos/${photoId}`);
      await loadProfile();
      toast.show('Photo deleted', 'success');
    } catch (err) {
      toast.show('Failed to delete photo', 'error');
    }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await api.upload('/profile/me/photos', fd);
      await loadProfile();
      toast.show('Photo uploaded! 📸', 'success');
    } catch (err) {
      toast.show('Upload failed: ' + err.message, 'error');
    }
  };

  document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
    try {
      const prompts = [];
      const p1q = document.getElementById('prompt-select-1').value;
      const p1a = document.getElementById('prompt-answer-1').value.trim();
      if (p1q && p1a) prompts.push({ question: p1q, answer: p1a });

      const p2q = document.getElementById('prompt-select-2').value;
      const p2a = document.getElementById('prompt-answer-2').value.trim();
      if (p2q && p2a) prompts.push({ question: p2q, answer: p2a });

      const updates = {
        bio: document.getElementById('profile-bio-input').value,
        city: document.getElementById('profile-city-input').value,
        job_title: document.getElementById('profile-job-input').value,
        education: document.getElementById('profile-education-input').value,
        prompts,
      };
      await api.put('/profile/me', updates);
      toast.show('Profile saved! ✅', 'success');
    } catch (err) {
      toast.show('Save failed: ' + err.message, 'error');
    }
  });

  // ─── Subscription ────────────────────────────────────────────
  const loadSubscription = async () => {
    const { plan, isActive } = await api.get('/subscriptions/status');
    const currentUser = getUser();

    document.querySelectorAll('.plan-card').forEach(card => {
      card.classList.remove('current');
      const cardPlan = card.dataset.plan;
      if (cardPlan === plan) {
        card.classList.add('current');
        const btn = card.querySelector('.plan-btn');
        if (btn) { btn.textContent = '✓ Current Plan'; btn.disabled = true; }
      }
    });
  };

  document.querySelectorAll('.plan-btn[data-plan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plan = btn.dataset.plan;
      if (!plan || plan === 'free') return;

      btn.disabled = true;
      btn.textContent = 'Loading...';
      try {
        const result = await api.post('/subscriptions/checkout', { plan });
        if (result.mock) {
          toast.show(`✅ ${plan} plan activated (test mode)!`, 'success');
          const u = getUser();
          u.subscription_plan = plan;
          setUser(u);
          await loadSubscription();
        } else {
          window.location.href = result.url;
        }
      } catch (err) {
        toast.show('Checkout failed: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = `Get ${plan.charAt(0).toUpperCase() + plan.slice(1)}`;
      }
    });
  });

  // ─── User menu ───────────────────────────────────────────────
  document.getElementById('btn-user-menu')?.addEventListener('click', () => {
    document.getElementById('user-menu-dropdown')?.classList.toggle('hidden');
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    clearTokens();
    window.location.href = '/index.html';
  });

  // Update nav badges
  const updateBadges = async () => {
    try {
      const matches = await api.get('/likes/matches');
      const badge = document.getElementById('matches-badge');
      if (badge) {
        badge.textContent = matches.length;
        badge.classList.toggle('hidden', matches.length === 0);
      }
    } catch {}
  };

  // ─── Helpers ─────────────────────────────────────────────────
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // ─── Init ─────────────────────────────────────────────────────
  switchTab(initialTab);
  updateBadges();

  // ─── Missing Buttons Handlers ──────────────────────────────────
  document.getElementById('btn-boost')?.addEventListener('click', () => {
    toast.show('Boost requires Platinum subscription! 💜', 'info');
  });

  const matchTabs = document.querySelectorAll('.match-tab-btn');
  matchTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      matchTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('emoji-btn')?.addEventListener('click', () => {
    toast.show('Emoji picker coming soon!', 'info');
  });
  
  document.querySelector('.chat-img-btn')?.addEventListener('click', () => {
    toast.show('Image sending coming soon! 📷', 'info');
  });

  document.querySelectorAll('.chat-header-actions .btn-icon').forEach(btn => {
    if(btn.textContent.includes('👤')) {
      btn.addEventListener('click', () => toast.show('User profile view coming soon!', 'info'));
    }
  });

  // Update user name in sidebar
  const sidebarUserName = document.getElementById('sidebar-user-name');
  if (sidebarUserName) sidebarUserName.textContent = user.name;
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  if (sidebarAvatar && user.avatar) sidebarAvatar.src = user.avatar;
});
