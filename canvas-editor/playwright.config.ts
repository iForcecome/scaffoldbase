import { defineConfig, devices } from '@playwright/test'

/**
 * 测试约定：
 * - dev server（vite 5173 + fastify 3001）需要预先运行；测试不负责启动
 * - 测试**不允许污染用户真数据**：每个 test 自建一个临时 project，结束删掉
 * - 默认 baseURL 走 vite 代理（5173），让 fetch /api 走前端代理，模拟真实用户流量
 * - workers=1：jsonb specs.pages 单行更新有并发风险，串行更稳
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
