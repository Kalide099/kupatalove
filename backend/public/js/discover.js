/**
 * KupataLove — Swipe / Discover UI
 * Tinder-style draggable card stack with like/dislike/superlike
 */

class SwipeUI {
  constructor(container, onAction) {
    this.container = container;
    this.onAction = onAction;
    this.profiles = [];
    this.currentIndex = 0;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
  }

  render(profiles) {
    this.profiles = profiles;
    this.currentIndex = 0;
    this.renderStack();
  }

  renderStack() {
    this.container.innerHTML = '';
    const visible = this.profiles.slice(this.currentIndex, this.currentIndex + 3);

    if (visible.length === 0) {
      this.container.innerHTML = `
        <div class="no-cards">
          <div class="icon">😴</div>
          <h3 data-i18n="no_more_profiles">No more profiles nearby</h3>
          <p data-i18n="check_back_later" style="color:var(--text-muted);font-size:0.9rem;">Check back later for new matches!</p>
        </div>`;
      return;
    }

    [...visible].reverse().forEach((profile, reverseIdx) => {
      const idx = visible.length - 1 - reverseIdx;
      const card = this.createCard(profile, idx === 0);
      this.container.appendChild(card);
    });

    this.attachDragEvents();
  }

  createCard(profile, isTop) {
    const age = profile.birthdate
      ? Math.floor((Date.now() - new Date(profile.birthdate)) / (1000 * 60 * 60 * 24 * 365.25))
      : '?';

    const photos = profile.photos || [];
    const photoCount = photos.length;
    let currentPhoto = 0;

    const card = document.createElement('div');
    card.className = 'swipe-card';
    card.dataset.userId = profile.id;

    const photoNav = photoCount > 1
      ? `<div class="card-photo-nav">${photos.map((_, i) => `<div class="photo-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}</div>`
      : '';

    const primaryPhoto = photos[0]?.url || profile.avatar;
    const photoHtml = primaryPhoto
      ? `<img class="card-image" src="${primaryPhoto}" alt="${profile.name}" loading="lazy">`
      : `<div class="card-image-placeholder">😊</div>`;

    const aiScore = profile.ai_score || 75;

    card.innerHTML = `
      <div class="card-image-container">
        ${photoHtml}
        <div class="card-gradient"></div>
        ${photoNav}
        <div class="like-stamp">LIKE 💚</div>
        <div class="nope-stamp">NOPE ✗</div>
        <div class="super-stamp">⭐ SUPER</div>
      </div>
      <div class="card-info">
        <div class="card-name-row">
          <span class="card-name">${profile.name}</span>
          <span class="card-age">${age}</span>
        </div>
        <div class="card-dist">📍 ${profile.city || 'Unknown'}</div>
        ${profile.bio ? `<div class="card-bio">${profile.bio}</div>` : ''}
        <div class="card-ai-score">
          🤖 AI Match <div class="ai-score-bar"><div class="ai-score-fill" style="width:${aiScore}%"></div></div> ${aiScore}%
        </div>
      </div>`;

    // Photo nav click
    if (photoCount > 1) {
      const imgEl = card.querySelector('.card-image');
      const dots = card.querySelectorAll('.photo-dot');
      const navEl = card.querySelector('.card-photo-nav');

      navEl.addEventListener('click', (e) => {
        const rect = card.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX > rect.width / 2) {
          currentPhoto = Math.min(currentPhoto + 1, photoCount - 1);
        } else {
          currentPhoto = Math.max(currentPhoto - 1, 0);
        }
        imgEl.src = photos[currentPhoto]?.url || primaryPhoto;
        dots.forEach((d, i) => d.classList.toggle('active', i === currentPhoto));
        e.stopPropagation();
      });
    }

    return card;
  }

  attachDragEvents() {
    const topCard = this.container.querySelector('.swipe-card:last-child');
    if (!topCard) return;

    const onStart = (e) => {
      if (e.target.closest('.card-photo-nav')) return;
      this.isDragging = true;
      this.startX = e.touches ? e.touches[0].clientX : e.clientX;
      this.startY = e.touches ? e.touches[0].clientY : e.clientY;
      this.currentX = this.startX;
      topCard.classList.add('dragging');
    };

    const onMove = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = x - this.startX;
      const dy = y - this.startY;
      const rotate = dx * 0.12;
      this.currentX = x;

      topCard.style.transform = `translateX(${dx}px) translateY(${dy * 0.3}px) rotate(${rotate}deg)`;

      // Show stamps
      const like = topCard.querySelector('.like-stamp');
      const nope = topCard.querySelector('.nope-stamp');
      const superLike = topCard.querySelector('.super-stamp');
      const threshold = 60;

      if (dx > threshold) {
        like.style.opacity = Math.min((dx - threshold) / 80, 1);
        nope.style.opacity = 0;
        superLike.style.opacity = 0;
      } else if (dx < -threshold) {
        nope.style.opacity = Math.min((-dx - threshold) / 80, 1);
        like.style.opacity = 0;
        superLike.style.opacity = 0;
      } else if (dy < -80) {
        superLike.style.opacity = Math.min((-dy - 80) / 60, 1);
        like.style.opacity = 0;
        nope.style.opacity = 0;
      } else {
        like.style.opacity = 0;
        nope.style.opacity = 0;
        superLike.style.opacity = 0;
      }
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      topCard.classList.remove('dragging');

      const style = topCard.style.transform;
      const match = style.match(/translateX\((-?\d+\.?\d*)px\)/);
      const matchY = style.match(/translateY\((-?\d+\.?\d*)px\)/);
      const dx = match ? parseFloat(match[1]) : 0;
      const dy = matchY ? parseFloat(matchY[1]) : 0;

      const THRESHOLD = 100;
      if (dx > THRESHOLD) {
        this.animateOut(topCard, 'right');
      } else if (dx < -THRESHOLD) {
        this.animateOut(topCard, 'left');
      } else if (dy < -100) {
        this.animateOut(topCard, 'up');
      } else {
        topCard.style.transform = '';
        topCard.style.transition = 'transform 0.4s var(--transition-spring)';
        setTimeout(() => topCard.style.transition = '', 400);
      }
    };

    topCard.addEventListener('mousedown', onStart);
    topCard.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

    // Clean up listeners when card removed
    topCard._cleanupEvents = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }

  animateOut(card, direction) {
    const profile = this.profiles[this.currentIndex];
    const type = direction === 'right' ? 'like' : direction === 'left' ? 'dislike' : 'superlike';

    card._cleanupEvents?.();
    card.classList.add(`go-${direction === 'right' ? 'right' : direction === 'left' ? 'left' : 'up'}`);

    setTimeout(() => {
      card.remove();
      this.currentIndex++;
      this.onAction(profile, type);

      // Reattach events to next card
      const nextCard = this.container.querySelector('.swipe-card:last-child');
      if (nextCard) {
        nextCard.style.transform = '';
        setTimeout(() => this.attachDragEvents(), 50);
      }

      if (this.currentIndex >= this.profiles.length - 1) {
        this.loadMore?.();
      }
    }, 350);
  }

  swipe(direction) {
    const topCard = this.container.querySelector('.swipe-card:last-child');
    if (topCard) this.animateOut(topCard, direction);
  }
}

// Export
window.SwipeUI = SwipeUI;
