<script setup>
defineProps({
  prizeCount: {
    type: Number,
    default: 0
  },
  winnerCount: {
    type: Number,
    default: 0
  },
  totalValue: {
    type: String,
    default: '¥0'
  }
})
</script>

<template>
  <section class="stats-section">
    <div class="stats-grid">
      <!-- 奖项类别卡片 -->
      <div class="stat-card">
        <p class="stat-label">奖项类别总数</p>
        <div class="stat-content">
          <span class="stat-value">{{ prizeCount }}</span>
          <span class="stat-badge">比去年 +2</span>
        </div>
      </div>

      <!-- 预计中奖人数卡片 -->
      <div class="stat-card">
        <p class="stat-label">预计中奖总人数</p>
        <div class="stat-content">
          <span class="stat-value">{{ winnerCount }}</span>
          <span class="stat-sub">覆盖所有职级</span>
        </div>
      </div>

      <!-- 奖品总价值卡片 -->
      <div class="stat-card special-card">
        <p class="stat-label special-label">奖品总价值</p>
        <div class="stat-content">
          <span class="stat-value special-value">{{ totalValue }}</span>
          <span class="material-symbols-outlined special-icon">workspace_premium</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stats-section {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 1.25rem;
  border: 1px solid #e6dbdb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

:global(.dark) .stat-card {
  background: #2d1a1a;
  border-color: #3d2a2a;
}

.stat-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #8a6060;
  margin-bottom: 0.25rem;
}

:global(.dark) .stat-label {
  color: #9ca3af;
}

.stat-content {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.stat-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: #181111;
  line-height: 1;
}

:global(.dark) .stat-value {
  color: white;
}

.stat-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: #16a34a;
  margin-bottom: 0.25rem;
}

.stat-sub {
  font-size: 0.75rem;
  color: #8a6060;
  margin-bottom: 0.25rem;
}

:global(.dark) .stat-sub {
  color: #9ca3af;
}

/* 特等奖卡片 */
.special-card {
  background: linear-gradient(135deg, white 0%, rgba(212, 175, 55, 0.05) 100%);
  border: 1px solid rgba(212, 175, 55, 0.3);
}

:global(.dark) .special-card {
  background: linear-gradient(135deg, #2d1a1a 0%, rgba(212, 175, 55, 0.1) 100%);
  border-color: rgba(212, 175, 55, 0.2);
}

.special-label {
  color: #D4AF37;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.special-value {
  color: #181111;
}

:global(.dark) .special-value {
  color: white;
}

.special-icon {
  font-size: 1.25rem;
  color: #D4AF37;
  margin-bottom: 0.25rem;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
