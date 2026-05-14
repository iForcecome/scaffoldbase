import type { Page } from '../stores/editor-store'

const orderListHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50:'#f0f4ff', 100:'#dbe4ff', 200:'#bac8ff', 300:'#91a7ff', 400:'#748ffc', 500:'#5c7cfa', 600:'#4c6ef5', 700:'#4263eb', 800:'#3b5bdb', 900:'#364fc7' },
        surface: { 0:'#ffffff', 1:'#f8f9fc', 2:'#f1f3f9', 3:'#e9ecf5', 4:'#dde1ed' },
        ink: { 0:'#0f172a', 1:'#334155', 2:'#64748b', 3:'#94a3b8', 4:'#cbd5e1' },
      }
    }
  }
}
</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+SC:wght@300;400;500;600;700;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', 'Noto Sans SC', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
</style>
</head>
<body class="bg-white text-ink-0">
  <!-- App Header -->
  <header class="border-b border-surface-3 px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
      </div>
      <span class="text-sm font-bold">OrderHub</span>
    </div>
    <nav class="flex items-center gap-6 text-sm text-ink-2">
      <span class="text-brand-600 font-medium">订单</span>
      <span class="rounded px-1.5 py-0.5 cursor-pointer hover:text-ink-0">客户</span>
      <span class="rounded px-1.5 py-0.5 cursor-pointer hover:text-ink-0">商品</span>
      <span class="rounded px-1.5 py-0.5 cursor-pointer hover:text-ink-0">统计</span>
      <div class="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold">K</div>
    </nav>
  </header>

  <!-- Main Content -->
  <main class="p-6">
    <!-- Title Bar -->
    <div class="flex items-center justify-between py-1 mb-5">
      <div>
        <h1 class="text-xl font-bold text-ink-0">订单管理</h1>
        <p class="text-sm text-ink-3 mt-0.5">管理和追踪所有订单状态</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="h-9 px-4 rounded-lg bg-white border border-surface-3 text-sm font-medium text-ink-1 flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          导出
        </button>
        <button class="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          新建订单
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="flex items-center gap-3 mb-5">
      <div class="flex-1 flex items-center gap-2 bg-surface-1 rounded-lg px-3 py-2.5">
        <svg class="w-4 h-4 text-ink-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
        <span class="text-sm text-ink-3">搜索订单号、客户名称...</span>
      </div>
      <button class="h-10 px-3.5 rounded-lg border border-surface-3 bg-white text-sm text-ink-1 flex items-center gap-1.5 font-medium">
        <svg class="w-4 h-4 text-ink-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"/></svg>
        状态
        <svg class="w-3 h-3 text-ink-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
      </button>
      <button class="h-10 px-3.5 rounded-lg border border-surface-3 bg-white text-sm text-ink-1 flex items-center gap-1.5 font-medium">
        <svg class="w-4 h-4 text-ink-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>
        日期范围
        <svg class="w-3 h-3 text-ink-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
      </button>
    </div>

    <!-- Data Table -->
    <div class="rounded-xl border border-surface-3 overflow-hidden mb-5">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface-1 border-b border-surface-3">
            <th class="w-10 py-3 px-4"><input type="checkbox" class="w-4 h-4 rounded border-surface-4"></th>
            <th class="text-left py-3 px-4 font-semibold text-ink-1">订单号</th>
            <th class="text-left py-3 px-4 font-semibold text-ink-1">客户</th>
            <th class="text-left py-3 px-4 font-semibold text-ink-1">商品</th>
            <th class="text-right py-3 px-4 font-semibold text-ink-1">金额</th>
            <th class="text-center py-3 px-4 font-semibold text-ink-1">状态</th>
            <th class="text-left py-3 px-4 font-semibold text-ink-1">日期</th>
            <th class="w-10 py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-surface-3">
            <td class="py-3 px-4"><input type="checkbox" class="w-4 h-4 rounded border-surface-4"></td>
            <td class="py-3 px-4 font-mono text-xs font-medium text-brand-600">#ORD-2024001</td>
            <td class="py-3 px-4"><div class="flex items-center gap-2"><div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">张</div><span>张三</span></div></td>
            <td class="py-3 px-4 text-ink-2">MacBook Pro 14"</td>
            <td class="py-3 px-4 text-right font-medium">¥14,999</td>
            <td class="py-3 px-4 text-center"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>已完成</span></td>
            <td class="py-3 px-4 text-ink-3 text-xs">2024-05-12</td>
            <td class="py-3 px-4"><svg class="w-4 h-4 text-ink-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/></svg></td>
          </tr>
          <tr class="border-b border-surface-3">
            <td class="py-3 px-4"><input type="checkbox" class="w-4 h-4 rounded border-surface-4"></td>
            <td class="py-3 px-4 font-mono text-xs font-medium text-brand-600">#ORD-2024002</td>
            <td class="py-3 px-4"><div class="flex items-center gap-2"><div class="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-600">李</div><span>李四</span></div></td>
            <td class="py-3 px-4 text-ink-2">AirPods Pro 2</td>
            <td class="py-3 px-4 text-right font-medium">¥1,899</td>
            <td class="py-3 px-4 text-center"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>已发货</span></td>
            <td class="py-3 px-4 text-ink-3 text-xs">2024-05-11</td>
            <td class="py-3 px-4"><svg class="w-4 h-4 text-ink-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/></svg></td>
          </tr>
          <tr class="border-b border-surface-3">
            <td class="py-3 px-4"><input type="checkbox" class="w-4 h-4 rounded border-surface-4"></td>
            <td class="py-3 px-4 font-mono text-xs font-medium text-brand-600">#ORD-2024003</td>
            <td class="py-3 px-4"><div class="flex items-center gap-2"><div class="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px] font-bold text-pink-600">王</div><span>王五</span></div></td>
            <td class="py-3 px-4 text-ink-2">iPad Air M2</td>
            <td class="py-3 px-4 text-right font-medium">¥4,799</td>
            <td class="py-3 px-4 text-center"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>待付款</span></td>
            <td class="py-3 px-4 text-ink-3 text-xs">2024-05-10</td>
            <td class="py-3 px-4"><svg class="w-4 h-4 text-ink-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/></svg></td>
          </tr>
          <tr>
            <td class="py-3 px-4"><input type="checkbox" class="w-4 h-4 rounded border-surface-4"></td>
            <td class="py-3 px-4 font-mono text-xs font-medium text-brand-600">#ORD-2024004</td>
            <td class="py-3 px-4"><div class="flex items-center gap-2"><div class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-600">赵</div><span>赵六</span></div></td>
            <td class="py-3 px-4 text-ink-2">Apple Watch Ultra</td>
            <td class="py-3 px-4 text-right font-medium">¥6,299</td>
            <td class="py-3 px-4 text-center"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>已取消</span></td>
            <td class="py-3 px-4 text-ink-3 text-xs">2024-05-09</td>
            <td class="py-3 px-4"><svg class="w-4 h-4 text-ink-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/></svg></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between">
      <span class="text-sm text-ink-3">共 128 条记录</span>
      <div class="flex items-center gap-1">
        <button class="w-8 h-8 rounded-lg border border-surface-3 flex items-center justify-center text-ink-3"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg></button>
        <button class="w-8 h-8 rounded-lg bg-brand-600 text-white text-sm font-medium">1</button>
        <button class="w-8 h-8 rounded-lg border border-surface-3 text-ink-2 text-sm">2</button>
        <button class="w-8 h-8 rounded-lg border border-surface-3 text-ink-2 text-sm">3</button>
        <span class="text-ink-3 text-sm px-1">...</span>
        <button class="w-8 h-8 rounded-lg border border-surface-3 text-ink-2 text-sm">13</button>
        <button class="w-8 h-8 rounded-lg border border-surface-3 flex items-center justify-center text-ink-3"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></svg></button>
      </div>
    </div>
  </main>
</body>
</html>`

const orderDetailHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"></script>
<style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: system-ui, sans-serif; }</style>
</head>
<body class="bg-white p-6">
  <div class="mb-6">
    <h1 class="text-xl font-bold mb-1">订单详情</h1>
    <p class="text-sm text-gray-500">查看和管理单个订单的详细信息</p>
  </div>
  <div class="grid grid-cols-2 gap-6">
    <div class="border border-gray-200 rounded-xl p-5">
      <h2 class="text-sm font-semibold text-gray-500 uppercase mb-3">基本信息</h2>
      <div class="space-y-3 text-sm">
        <div class="flex justify-between"><span class="text-gray-500">订单号</span><span class="font-mono font-medium">#ORD-2024001</span></div>
        <div class="flex justify-between"><span class="text-gray-500">客户</span><span>张三</span></div>
        <div class="flex justify-between"><span class="text-gray-500">日期</span><span>2024-05-12</span></div>
        <div class="flex justify-between"><span class="text-gray-500">状态</span><span class="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700">已完成</span></div>
      </div>
    </div>
    <div class="border border-gray-200 rounded-xl p-5">
      <h2 class="text-sm font-semibold text-gray-500 uppercase mb-3">支付信息</h2>
      <div class="space-y-3 text-sm">
        <div class="flex justify-between"><span class="text-gray-500">商品</span><span>MacBook Pro 14"</span></div>
        <div class="flex justify-between"><span class="text-gray-500">金额</span><span class="font-medium">¥14,999</span></div>
        <div class="flex justify-between"><span class="text-gray-500">支付方式</span><span>支付宝</span></div>
        <div class="flex justify-between"><span class="text-gray-500">运费</span><span>¥0</span></div>
      </div>
    </div>
  </div>
</body>
</html>`

const exportConfigHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"></script>
<style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: system-ui, sans-serif; }</style>
</head>
<body class="bg-white p-6">
  <div class="mb-6">
    <h1 class="text-xl font-bold mb-1">导出配置</h1>
    <p class="text-sm text-gray-500">配置数据导出格式和范围</p>
  </div>
  <div class="space-y-4 max-w-lg">
    <div>
      <label class="block text-sm font-medium mb-1.5">导出格式</label>
      <select class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <option>CSV</option>
        <option>Excel (.xlsx)</option>
        <option>JSON</option>
      </select>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1.5">日期范围</label>
      <div class="flex gap-2">
        <input type="date" class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" value="2024-01-01">
        <span class="self-center text-gray-400">—</span>
        <input type="date" class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" value="2024-05-14">
      </div>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1.5">包含字段</label>
      <div class="space-y-2 text-sm">
        <label class="flex items-center gap-2"><input type="checkbox" checked class="rounded"> 订单号</label>
        <label class="flex items-center gap-2"><input type="checkbox" checked class="rounded"> 客户信息</label>
        <label class="flex items-center gap-2"><input type="checkbox" checked class="rounded"> 商品明细</label>
        <label class="flex items-center gap-2"><input type="checkbox" checked class="rounded"> 金额</label>
        <label class="flex items-center gap-2"><input type="checkbox" class="rounded"> 备注</label>
      </div>
    </div>
    <button class="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium mt-4">开始导出</button>
  </div>
</body>
</html>`

export const mockPages: Page[] = [
  { id: 'order-list', title: '订单列表', html: orderListHTML },
  { id: 'order-detail', title: '订单详情', html: orderDetailHTML },
  { id: 'export-config', title: '导出配置', html: exportConfigHTML },
]
