# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Vue 3 + Vite 的年终抽奖系统，支持多种炫酷抽奖效果和完整的后台管理功能。所有数据使用 localStorage 持久化。

## 常用命令

```bash
# 开发模式
npm run dev
# 抽奖页面: http://localhost:5173
# 后台管理: http://localhost:5173/backend

# 生产构建
npm run build

# 预览构建产物
npm run preview
```

## 核心架构

### 目录结构
```
src/
├── view/draw/          # 抽奖展示页面 (3种效果)
├── view/components/    # 后台管理页面组件
├── components/         # 通用组件 (ConfirmDialog, ParticipantUpload, PrizeConfig)
├── utils/
│   ├── lotteryAlgorithm.js   # 抽奖算法核心
│   └── lotteryStorage.js     # localStorage 数据管理
└── router/index.js     # 路由: / (抽奖) 和 /backend (后台)
```

### 数据流架构

```
抽奖页面 (DrawIndex.vue)
    ↓
选择奖项 → 从 lotteryStorage 读取配置
    ↓
执行抽奖 → lotteryAlgorithm.draw()
    ↓
保存结果 → addWinnerRecord() + updateParticipantStatus()
    ↓
后台展示 → RecordsPage.vue 读取记录
```

### 存储架构 (lotteryStorage.js)

使用 localStorage 的 5 个独立 key：
- `lottery_participants` - 参与人员（含 status: pending/won）
- `lottery_prizes` - 奖项配置
- `lottery_settings` - 系统设置
- `lottery_winner_records` - 中奖记录（唯一ID: `${Date.now()}_${random}`）
- `lottery_system_data` - 完整备份

**关键函数：**
- `getEligibleParticipants()` - 根据 allowRepeatWins 设置过滤
- `deleteWinnersByPrizeName(prizeName)` - 删除记录并重置状态

### 抽奖算法 (lotteryAlgorithm.js)

使用 **Web Crypto API** (`crypto.getRandomValues`) 替代 `Math.random()`，确保密码学级别的公平性。

**两种模式：**
1. **随机抽取** (`randomDraw`) - Fisher-Yates 洗牌 + 安全随机数
2. **加权抽取** (`weightedDraw`) - 轮盘赌算法 + 二分查找优化
   - 按部门：部门人数越少权重越高
   - 按职级：职级越高权重越低

统一入口：`draw(participants, count, settings)`

### 抽奖效果组件

位于 `src/view/draw/`：
- **Sphere3DScreen.vue** - Three.js 3D 球体滚动
- **TrendyScreen.vue** - 时尚动感效果
- **YimaScreen.vue** - 马年主题特效

这些组件通过系统设置 (`settings.drawEffect`) 动态选择。

## 参与者数据结构

```javascript
{
  id: string | number,
  name: string,
  phone: string,
  department: string,
  position: string,
  status: 'pending' | 'won',
  winTime: string | null,  // ISO timestamp
  avatar?: string
}
```

## 奖项数据结构

```javascript
{
  id: string | number,
  name: string,
  count: number,
  amount?: number,
  level?: number,
  image?: string,
  isSpecial?: boolean  // >= 5000 元自动标记
}
```

## 添加新抽奖效果

1. 在 `src/view/draw/` 创建新组件（参考现有组件）
2. 组件需接收 props：`prize`, `onDrawStart`, `onDrawComplete`
3. 触发抽奖时调用 `onDrawStart()`，完成时调用 `onDrawComplete(winners)`
4. 在 `SettingsPage.vue` 的效果选项中添加新选项

## Excel 导入格式

参与者 Excel 文件需包含列：姓名、手机、部门、职级（列名可模糊匹配）
模板下载功能位于 `ParticipantsPage.vue`
