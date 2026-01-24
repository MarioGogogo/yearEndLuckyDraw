import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'draw',
    component: () => import('../view/draw/DrawIndex.vue')
  },
  {
    path: '/backend',
    name: 'backend',
    component: () => import('../view/BackendApp.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
