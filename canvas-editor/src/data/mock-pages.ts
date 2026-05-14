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
      <a href="#page:order-list" class="text-brand-600 font-medium no-underline">订单</a>
      <a href="#page:order-detail" class="rounded px-1.5 py-0.5 cursor-pointer hover:text-ink-0 no-underline text-ink-2">详情</a>
      <a href="#page:export-config" class="rounded px-1.5 py-0.5 cursor-pointer hover:text-ink-0 no-underline text-ink-2">导出</a>
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
<body class="bg-white text-ink-0">
  <header class="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
      </div>
      <span class="text-sm font-bold">OrderHub</span>
    </div>
    <nav class="flex items-center gap-6 text-sm text-gray-500">
      <a href="#page:order-list" class="rounded px-1.5 py-0.5 cursor-pointer hover:text-gray-900 no-underline text-gray-500">订单</a>
      <a href="#page:order-detail" class="text-indigo-600 font-medium no-underline">详情</a>
      <a href="#page:export-config" class="rounded px-1.5 py-0.5 cursor-pointer hover:text-gray-900 no-underline text-gray-500">导出</a>
    </nav>
  </header>
  <main class="p-6">
  <div class="mb-6 flex items-center gap-3">
    <a href="#page:order-list" class="text-sm text-indigo-600 no-underline hover:underline">&larr; 返回订单列表</a>
  </div>
  <div class="mb-4">
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
  </main>
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
<body class="bg-white text-ink-0">
  <header class="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
      </div>
      <span class="text-sm font-bold">OrderHub</span>
    </div>
    <nav class="flex items-center gap-6 text-sm text-gray-500">
      <a href="#page:order-list" class="rounded px-1.5 py-0.5 cursor-pointer hover:text-gray-900 no-underline text-gray-500">订单</a>
      <a href="#page:order-detail" class="rounded px-1.5 py-0.5 cursor-pointer hover:text-gray-900 no-underline text-gray-500">详情</a>
      <a href="#page:export-config" class="text-indigo-600 font-medium no-underline">导出</a>
    </nav>
  </header>
  <main class="p-6">
  <div class="mb-6 flex items-center gap-3">
    <a href="#page:order-list" class="text-sm text-indigo-600 no-underline hover:underline">&larr; 返回订单列表</a>
  </div>
  <div class="mb-4">
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
  </main>
</body>
</html>`

const landingPageHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"><\/script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#10b981'
      }
    }
  }
}
<\/script>
<style>
  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
  @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); } 50% { box-shadow: 0 0 0 12px rgba(59,130,246,0); } }
  @keyframes slide-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
  .animate-float { animation: float 3s ease-in-out infinite; }
  .animate-pulse-glow { animation: pulse-glow 2s infinite; }
  .animate-slide-up { animation: slide-up 0.6s ease-out forwards; }
  .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
  .delay-100 { animation-delay: 0.1s; } .delay-200 { animation-delay: 0.2s; } .delay-300 { animation-delay: 0.3s; } .delay-400 { animation-delay: 0.4s; } .delay-500 { animation-delay: 0.5s; }
  .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -8px rgba(0,0,0,0.15); }
</style>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">

  <!-- 导航栏 -->
  <nav class="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between animate-fade-in">
    <div class="text-2xl font-bold text-primary tracking-tight flex items-center gap-2">
      <span class="w-3 h-3 bg-primary rounded-full inline-block animate-pulse-glow"></span>
      SpecFlow
    </div>
    <div class="hidden md:flex space-x-8 text-gray-600 font-medium">
      <a href="#page:landing" class="text-primary transition hover:scale-105 no-underline">首页</a>
      <a href="#page:order-list" class="hover:text-primary transition hover:scale-105 no-underline text-gray-600">订单管理</a>
      <a href="#page:order-detail" class="hover:text-primary transition hover:scale-105 no-underline text-gray-600">订单详情</a>
      <a href="#page:export-config" class="hover:text-primary transition hover:scale-105 no-underline text-gray-600">导出</a>
    </div>
    <div class="flex items-center space-x-4">
      <span class="text-gray-500 hover:text-primary transition font-medium cursor-pointer">登录</span>
      <span class="bg-primary text-white px-5 py-2 rounded-full font-semibold shadow-md hover:shadow-lg hover:bg-blue-600 transition hover:scale-105 cursor-pointer">免费开始</span>
    </div>
  </nav>

  <!-- 主英雄区 -->
  <section class="max-w-6xl mx-auto px-4 pt-20 pb-32 flex flex-col lg:flex-row items-center gap-12">
    <div class="flex-1 text-center lg:text-left">
      <span class="inline-block bg-blue-100 text-primary text-sm font-semibold px-4 py-1.5 rounded-full mb-6 animate-slide-up">🚀 全新画布编辑器 2.0</span>
      <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight animate-slide-up delay-100">
        用 <span class="text-primary">SpecFlow</span> 绘制<br>你的产品蓝图
      </h1>
      <p class="mt-6 text-lg md:text-xl text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-slide-up delay-200">
        直观的拖拽式画布，支持流程图、线框图、用户故事映射、思维导图。团队协作实时同步，AI 辅助生成，让产品设计变得简单高效。
      </p>
      <div class="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start animate-slide-up delay-300">
        <span class="bg-primary text-white px-8 py-3.5 rounded-full text-lg font-semibold shadow-lg hover:shadow-xl hover:bg-blue-600 transition w-full sm:w-auto text-center hover:scale-105 cursor-pointer">开始免费使用</span>
        <span class="border-2 border-gray-300 text-gray-700 px-8 py-3.5 rounded-full text-lg font-semibold hover:border-primary hover:text-primary transition w-full sm:w-auto text-center hover:scale-105 cursor-pointer">观看演示</span>
      </div>
      <div class="mt-10 flex items-center gap-8 text-sm text-gray-500 justify-center lg:justify-start animate-fade-in delay-500">
        <div class="flex items-center gap-2"><span class="w-2 h-2 bg-green-400 rounded-full inline-block"></span> 无需信用卡</div>
        <div class="flex items-center gap-2"><span class="w-2 h-2 bg-green-400 rounded-full inline-block"></span> 14天免费试用</div>
        <div class="flex items-center gap-2"><span class="w-2 h-2 bg-blue-400 rounded-full inline-block"></span> 50+ 模板</div>
      </div>
    </div>

    <!-- 右侧画布预览 -->
    <div class="flex-1 w-full max-w-lg lg:max-w-none animate-float">
      <div class="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100 relative">
        <div class="flex items-center justify-between mb-4">
          <div class="flex space-x-2">
            <div class="w-3 h-3 rounded-full bg-red-400"></div>
            <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div class="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div class="flex space-x-2 text-gray-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          </div>
        </div>
        <div class="bg-gray-50 rounded-xl p-6 space-y-4 min-h-[260px]">
          <div class="flex items-center justify-center gap-4 flex-wrap">
            <div class="bg-white rounded-xl shadow-sm px-5 py-3 border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:shadow-md transition cursor-pointer">用户故事</div>
            <div class="bg-white rounded-xl shadow-sm px-5 py-3 border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:shadow-md transition cursor-pointer">线框图</div>
            <div class="bg-white rounded-xl shadow-sm px-5 py-3 border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:shadow-md transition cursor-pointer">流程图</div>
            <div class="bg-white rounded-xl shadow-sm px-5 py-3 border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:shadow-md transition cursor-pointer">思维导图</div>
          </div>
          <div class="grid grid-cols-3 gap-3 mt-4">
            <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100"><div class="h-2 w-16 bg-blue-200 rounded mb-2"></div><div class="h-2 w-10 bg-gray-200 rounded"></div></div>
            <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100"><div class="h-2 w-12 bg-green-200 rounded mb-2"></div><div class="h-2 w-8 bg-gray-200 rounded"></div></div>
            <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100"><div class="h-2 w-14 bg-purple-200 rounded mb-2"></div><div class="h-2 w-9 bg-gray-200 rounded"></div></div>
          </div>
          <div class="flex justify-center mt-2">
            <span class="inline-block bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full animate-pulse">✨ 拖拽添加组件 · 支持 AI 生成</span>
          </div>
        </div>
        <div class="mt-4 text-xs text-gray-400 text-center flex justify-center gap-4">
          <span>👥 实时协作</span><span>📋 版本历史</span><span>📤 一键导出</span><span>🤖 AI 辅助</span>
        </div>
      </div>
    </div>
  </section>

  <!-- 数据统计条 -->
  <section class="max-w-6xl mx-auto px-4 pb-16 animate-fade-in">
    <div class="bg-white rounded-2xl shadow-lg p-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center border border-gray-50">
      <div><div class="text-3xl font-bold text-primary">50K+</div><div class="text-gray-500 text-sm mt-1">活跃用户</div></div>
      <div><div class="text-3xl font-bold text-secondary">120+</div><div class="text-gray-500 text-sm mt-1">国家覆盖</div></div>
      <div><div class="text-3xl font-bold text-purple-600">98%</div><div class="text-gray-500 text-sm mt-1">满意度</div></div>
      <div><div class="text-3xl font-bold text-orange-500">10M+</div><div class="text-gray-500 text-sm mt-1">画布创建</div></div>
    </div>
  </section>

  <!-- 特性卡片区 -->
  <section class="max-w-6xl mx-auto px-4 pb-24">
    <h2 class="text-3xl font-bold text-center text-gray-800 mb-4">为什么选择 SpecFlow？</h2>
    <p class="text-gray-500 text-center max-w-xl mx-auto mb-12">从想法到原型，一站式完成产品设计全流程。超过 50,000 个团队信赖。</p>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition border border-gray-50 hover-lift">
        <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-5">
          <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path></svg>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">灵活的画布</h3>
        <p class="text-gray-500 leading-relaxed">自由拖拽、缩放、连线，支持多种图形和模板，满足不同场景需求。</p>
      </div>
      <div class="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition border border-gray-50 hover-lift">
        <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-5">
          <svg class="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">团队协作</h3>
        <p class="text-gray-500 leading-relaxed">多人实时编辑，评论反馈，让沟通无缝融入设计流程。</p>
      </div>
      <div class="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition border border-gray-50 hover-lift">
        <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-5">
          <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">一键导出</h3>
        <p class="text-gray-500 leading-relaxed">支持导出为 PDF、PNG、SVG，或直接嵌入 Notion、Confluence。</p>
      </div>
    </div>
  </section>

  <!-- CTA 横幅 -->
  <section class="max-w-6xl mx-auto px-4 pb-24 animate-fade-in">
    <div class="bg-gradient-to-r from-primary to-blue-700 rounded-3xl p-12 text-center text-white shadow-2xl">
      <h2 class="text-3xl md:text-4xl font-bold mb-4">准备好开始了吗？</h2>
      <p class="text-blue-100 max-w-lg mx-auto mb-8">加入 50,000+ 产品团队，用 SpecFlow 把想法变成现实。</p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <span class="bg-white text-primary px-8 py-3.5 rounded-full text-lg font-semibold shadow-lg hover:shadow-xl transition hover:scale-105 cursor-pointer">免费开始使用</span>
        <span class="border-2 border-white/50 text-white px-8 py-3.5 rounded-full text-lg font-semibold hover:bg-white/10 transition hover:scale-105 cursor-pointer">预约演示</span>
      </div>
    </div>
  </section>

  <!-- 页脚 -->
  <footer class="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
    <div class="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between">
      <span>© 2025 SpecFlow. All rights reserved.</span>
      <div class="flex space-x-6 mt-4 md:mt-0">
        <span class="hover:text-gray-600 transition cursor-pointer">隐私政策</span>
        <span class="hover:text-gray-600 transition cursor-pointer">服务条款</span>
        <span class="hover:text-gray-600 transition cursor-pointer">帮助中心</span>
      </div>
    </div>
  </footer>

</body>
</html>`

export const mockPages: Page[] = [
  { id: 'landing', title: '首页', html: landingPageHTML },
  { id: 'order-list', title: '订单列表', html: orderListHTML },
  { id: 'order-detail', title: '订单详情', html: orderDetailHTML },
  { id: 'export-config', title: '导出配置', html: exportConfigHTML },
]
