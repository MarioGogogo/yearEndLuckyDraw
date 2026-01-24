<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['back'])

function goToBackend() {
  emit('back')
}

onMounted(() => {
  document.documentElement.classList.add('dark')
})

onUnmounted(() => {
  document.documentElement.classList.remove('dark')
})
</script>

<template>
  <div class="yima-screen">
    <div class="chinese-pattern-bg"></div>

    <header class="screen-header">
      <button class="back-btn" @click="goToBackend">
        <span class="material-symbols-outlined">arrow_back</span>
        返回后台
      </button>
      <div class="mode-badge">
        <span class="material-symbols-outlined">auto_awesome</span>
        一马当先
      </div>
    </header>

    <main class="screen-content">
      <div class="title-section">
        <div class="lantern left">
          <span class="lantern-text">福</span>
        </div>
        <h1 class="main-title">
          <span class="char">一</span>
          <span class="char">马</span>
          <span class="char">当</span>
          <span class="char">先</span>
        </h1>
        <div class="lantern right">
          <span class="lantern-text">福</span>
        </div>
      </div>

      <p class="subtitle">2026 灵蛇献瑞 · 马年大吉</p>

      <div class="horse-animation">
        <div class="horse-run">
          <span class="horse-emoji">🐎</span>
          <span class="horse-emoji">🐎</span>
          <span class="horse-emoji">🐎</span>
        </div>
        <div class="sparkles">
          <span class="sparkle">✨</span>
          <span class="sparkle">✨</span>
          <span class="sparkle">✨</span>
        </div>
      </div>

      <div class="draw-area">
        <div class="prize-display">
          <div class="prize-card">
            <span class="prize-icon">🎁</span>
            <span class="prize-text">准备好了</span>
          </div>
        </div>

        <button class="draw-btn">
          <span class="material-symbols-outlined">celebration</span>
          立即开奖
        </button>
      </div>
    </main>

    <footer class="screen-footer">
      <div class="fireworks left"></div>
      <div class="fireworks right"></div>
    </footer>
  </div>
</template>

<style scoped>
.yima-screen {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(180deg, #8B0000 0%, #DC143C 50%, #B22222 100%);
  position: relative;
  overflow: hidden;
}

.chinese-pattern-bg {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5c-3 0-6 3-6 6s3 6 6 6 6-3 6-6-3-6-6-6zm0 20c-8 0-15 5-15 12s7 12 15 12 15-5 15-12-7-12-15-12zm0 25c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9z' fill='%23FFD700' fill-opacity='0.08'/%3E%3C/svg%3E");
  opacity: 0.6;
  pointer-events: none;
}

.screen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 3rem;
  position: relative;
  z-index: 10;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 215, 0, 0.15);
  border: 2px solid rgba(255, 215, 0, 0.4);
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 600;
  color: #FFD700;
  cursor: pointer;
  transition: all 0.3s ease;
}

.back-btn:hover {
  background: rgba(255, 215, 0, 0.25);
  border-color: #FFD700;
  transform: translateX(-4px);
}

.back-btn :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

.mode-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 215, 0, 0.2);
  border: 2px solid #FFD700;
  border-radius: 9999px;
  font-size: 1.125rem;
  font-weight: 700;
  color: #FFD700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}

.mode-badge :deep(.material-symbols-outlined) {
  font-size: 1.25rem;
}

.screen-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  position: relative;
  z-index: 5;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.lantern {
  width: 80px;
  height: 100px;
  background: linear-gradient(180deg, #FF4500 0%, #DC143C 100%);
  border-radius: 50% 50% 45% 45%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px rgba(255, 69, 0, 0.5), inset 0 -20px 40px rgba(0, 0, 0, 0.2);
  animation: lantern-swing 3s ease-in-out infinite;
  position: relative;
}

.lantern.left {
  animation-delay: 0s;
}

.lantern.right {
  animation-delay: 1.5s;
}

.lantern::before {
  content: '';
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 15px;
  background: #8B4513;
  border-radius: 3px;
}

.lantern::after {
  content: '';
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 20px;
  background: linear-gradient(to bottom, #FFD700, transparent);
}

@keyframes lantern-swing {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}

.lantern-text {
  font-size: 2rem;
  font-weight: 900;
  color: #FFD700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.main-title {
  display: flex;
  gap: 0.5rem;
}

.main-title .char {
  font-family: 'Noto Serif SC', 'STKaiti', serif;
  font-size: 5rem;
  font-weight: 900;
  color: #FFD700;
  text-shadow: 4px 4px 0 #8B0000, 6px 6px 20px rgba(0, 0, 0, 0.3);
  animation: char-bounce 2s ease-in-out infinite;
}

.main-title .char:nth-child(1) { animation-delay: 0s; }
.main-title .char:nth-child(2) { animation-delay: 0.1s; }
.main-title .char:nth-child(3) { animation-delay: 0.2s; }
.main-title .char:nth-child(4) { animation-delay: 0.3s; }

@keyframes char-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.subtitle {
  font-size: 1.5rem;
  color: rgba(255, 215, 0, 0.8);
  margin-bottom: 3rem;
  letter-spacing: 0.3em;
}

.horse-animation {
  margin-bottom: 3rem;
}

.horse-run {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.horse-emoji {
  font-size: 3rem;
  animation: horse-gallop 1s ease-in-out infinite;
}

.horse-emoji:nth-child(1) { animation-delay: 0s; }
.horse-emoji:nth-child(2) { animation-delay: 0.2s; }
.horse-emoji:nth-child(3) { animation-delay: 0.4s; }

@keyframes horse-gallop {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-10px) rotate(-5deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(-10px) rotate(5deg); }
}

.sparkles {
  display: flex;
  justify-content: center;
  gap: 3rem;
}

.sparkle {
  font-size: 1.5rem;
  animation: sparkle-fade 1.5s ease-in-out infinite;
}

.sparkle:nth-child(1) { animation-delay: 0s; }
.sparkle:nth-child(2) { animation-delay: 0.5s; }
.sparkle:nth-child(3) { animation-delay: 1s; }

@keyframes sparkle-fade {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

.draw-area {
  text-align: center;
}

.prize-display {
  margin-bottom: 2rem;
}

.prize-card {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 3rem;
  background: rgba(255, 215, 0, 0.1);
  border: 3px solid #FFD700;
  border-radius: 1rem;
  box-shadow: 0 0 40px rgba(255, 215, 0, 0.3), inset 0 0 30px rgba(255, 215, 0, 0.1);
}

.prize-icon {
  font-size: 3rem;
}

.prize-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: #FFD700;
  letter-spacing: 0.2em;
}

.draw-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 3rem;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border: none;
  border-radius: 9999px;
  font-size: 1.5rem;
  font-weight: 900;
  color: #8B0000;
  cursor: pointer;
  box-shadow: 0 8px 30px rgba(255, 215, 0, 0.4), 0 0 60px rgba(255, 165, 0, 0.3);
  transition: all 0.3s ease;
}

.draw-btn:hover {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 12px 40px rgba(255, 215, 0, 0.5), 0 0 80px rgba(255, 165, 0, 0.4);
}

.draw-btn:active {
  transform: translateY(-2px) scale(0.98);
}

.draw-btn :deep(.material-symbols-outlined) {
  font-size: 2rem;
}

.screen-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100px;
  pointer-events: none;
}

.fireworks {
  position: absolute;
  bottom: 20px;
  width: 60px;
  height: 60px;
  background: radial-gradient(circle, #FFD700 0%, transparent 70%);
  border-radius: 50%;
  animation: firework-pulse 2s ease-in-out infinite;
}

.fireworks.left {
  left: 10%;
  animation-delay: 0s;
}

.fireworks.right {
  right: 10%;
  animation-delay: 1s;
}

@keyframes firework-pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.5); opacity: 1; }
}

@media (max-width: 768px) {
  .screen-header {
    padding: 1rem;
  }

  .title-section {
    flex-direction: column;
    gap: 1rem;
  }

  .lantern {
    display: none;
  }

  .main-title .char {
    font-size: 3rem;
  }

  .subtitle {
    font-size: 1rem;
    letter-spacing: 0.1em;
  }

  .horse-emoji {
    font-size: 2rem;
  }

  .prize-card {
    padding: 1rem 1.5rem;
  }

  .draw-btn {
    padding: 1rem 2rem;
    font-size: 1.25rem;
  }
}
</style>
