import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    cssCodeSplit: false // 将所有 CSS 打包到一个文件中
  }
})
