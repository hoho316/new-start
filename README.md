# 长征路线图 · 移动端

> 1934.10 — 1936.10 · 三大主力红军战略转移
> 一个为手机浏览器重新设计的交互式长征路线地图：**全局路线 → 节点详情 → 放大看地形**。

<p align="center">
  <img src="docs/shot-01-overview.jpg" width="240" alt="全景路线">
  <img src="docs/shot-02-detail.jpg" width="240" alt="节点详情">
  <img src="docs/shot-03-terrain.jpg" width="240" alt="放大看地形">
</p>

<p align="center">
  <img src="docs/shot-04-landscape.jpg" width="620" alt="横屏抽屉布局">
</p>

<p align="center">
  <img src="docs/shot-05-index-mobile.png" width="240" alt="index.html 在手机上的降级版式">
  <br>
  <sub>↑ <code>index.html</code> 在 390px 手机上的降级版式（v1.1 起支持，无需跳到 mobile.html 也能看）</sub>
</p>

---

## 目录

- [项目简介](#项目简介)
- [功能说明](#功能说明)
- [使用方法](#使用方法)
- [目录结构](#目录结构)
- [移动端适配说明](#移动端适配说明)
- [技术实现](#技术实现)
- [与 PC 端的关系](#与-pc-端的关系)
- [数据来源与版权](#数据来源与版权)
- [兼容性](#兼容性)
- [常见问题](#常见问题)
- [更新记录](#更新记录)

---

## 项目简介

本项目是一张**中国工农红军长征路线交互地图**，收录 1934 年 10 月至 1936 年 10 月三大主力红军（中央红军、红二方面军、红四方面军）的行军序列，共 **70 个重要节点**、**25 个关键节点**、**19 场战役战斗**。

它包含两个互相独立的页面入口：

| 入口 | 文件 | 适用设备 |
| --- | --- | --- |
| PC 端（已自适应降级） | `index.html` | 桌面 ≥1024px；**≤900px 自动切单列手机版式** |
| **移动端专用** | **`mobile.html`** | **手机浏览器（320–600px，含横屏）** |

> 两个入口**都能在手机上正常打开**：
> - `index.html` 在 ≤900px 时会退化为「顶栏（两行）→ 地图 → 序列列表」的单列流式布局，信息卡片变底部抽屉，无横向滚动；
> - `mobile.html` 是针对手指操作专门重做的体验：三段吸附面板、42px 触控热区、标签防重叠、横屏抽屉。
>
> 手机端推荐访问 `mobile.html`；如果只部署了 `index.html`，它本身也已经可用。

---

## 功能说明

### 1. 地图与路线

| 功能 | 说明 |
| --- | --- |
| 三大主力路线 | 中央红军（红）、红二方面军（青）、红四方面军（紫）三色行军线，可分别显隐 |
| 真实道路拟合 | 行军线不是两点直线，而是经 OSM 步行/公路路径服务拟合后固化的折线，贴合山谷与渡口 |
| 行军阶段切换 | 「阶段一 · 中央红军」41 站 / 「阶段二 · 三大主力」70 站 |
| 4 种底图 | 墨夜地形、地貌晕渲、卫星实景、军事制图（Esri 在线瓦片，免 Key） |
| 水系标注层 | 放大到较高层级自动浮现河流/湖泊名称与线形（最多约 50 条） |
| 自然地理层 | 雪山、草地、大河渡口等自然地理节点归为独立图层，可单独开关（21 个节点） |
| 全景 | 一键回到能容纳当前部队全部路线的视野 |

### 2. 节点与详情

| 功能 | 说明 |
| --- | --- |
| 节点标记 | 按类型区分造型：出发地/会议/战役战斗/转折/渡口/雪山/草地 |
| 触控热区 | 标记视觉尺寸约 16–20px，实际点击热区 **42×42px**，满足手指点选 |
| 节点详情 | 行军方、所在地、节点序号、WGS-84 坐标、地理环境、事件经过、历史意义 |
| 上一站 / 下一站 | 详情面板底部直接串联，不必退出面板 |
| 放大看地形 | 一键切入卫星实景 + 山体晕渲，并按节点类型切换雪山/湿地/水文三种晕渲配色 |

### 3. 行军序列与时间轴

| 功能 | 说明 |
| --- | --- |
| 序列列表 | 按时间排序的 70 站，含日期、省份、类型标签 |
| 时间轴拖动 | 拖到任意时点，地图上路线随之「推进」到该日期 |
| 播放 | 约 620ms/站自动推进，地图跟随平移，可随时暂停 |
| 检索 | 按节点名、地点、战役名实时过滤（如输入「雪山」得 5 条） |

### 4. 移动端专属交互

| 交互 | 说明 |
| --- | --- |
| 三段吸附面板 | 收起（peek）/ 半屏（half）/ 全屏（full），拖动或点击拖拽条切换 |
| 甩动手势 | 快速上滑/下滑直接跨档，带速度判据，不误触 |
| 选中自动定位 | 点击标记 → 面板升到半屏 → 地图自动把节点送到「顶栏—面板」之间可视带中心 |
| 标签降噪 | 低缩放只显示关键节点；标签按实际文字宽度做矩形避让，密集区不叠字 |
| 安全区适配 | 刘海屏/底部小白条用 `env(safe-area-inset-*)` 留白 |
| 横屏抽屉 | 横屏时面板自动变为右侧抽屉，地图常驻左侧，不再互相挤压 |

---

## 使用方法

### 方式一：本地直接打开（最简单）

```bash
# 进入项目目录后，用任意静态服务器启动（必须起服务，不能用 file:// 直接双击）
python -m http.server 8080
# 或
npx serve .
```

- 手机访问：`http://<你的电脑局域网IP>:8080/mobile.html`
- PC 访问：`http://localhost:8080/index.html`

> **为什么要起服务？** 页面按目录加载 `assets/` 下的 JS/CSS 与本地 Leaflet，用 `file://` 直接双击打开会被浏览器的同源策略拦截。

### 方式二：部署到静态托管

本页面是**纯静态**的（无构建、无后端、无 API Key），整个目录可直接放到 GitHub Pages / Vercel / Netlify / Nginx 任意静态空间：

```bash
# GitHub Pages 示例
git add . && git commit -m "deploy"
git push origin main
# 仓库 Settings → Pages → 选择分支根目录即可
```

### 操作速览

1. **看全貌**：打开即是全景，三色路线与 25 个关键节点。
2. **看某站**：点地图上的标记，或上滑底部面板从「行军序列」里点选。
3. **看地形**：在详情面板点「放大看地形」，进入卫星实景 + 晕渲，看雪山/垭口/渡口的真实地貌。
4. **看时间推进**：在「行军序列」里拖时间轴，或点 ▶ 自动播放。
5. **切换图层**：面板 →「图层」，可切阶段、关部队、换底图、关水系/自然地理层。

### 调试入口

页面在 `window.LM_M` 上暴露了调试句柄，便于二次开发与自动化测试：

```js
LM_M.map                     // Leaflet 地图实例
LM_M.state                   // 内部状态（sel / pane / active / terrain ...）
LM_M.selectNode(id)          // 选中节点并定位
LM_M.clearSelection()        // 取消选中
LM_M.enterTerrain(node)      // 进入地形视图
LM_M.exitTerrain()           // 退出地形视图
LM_M.setSnap('peek'|'half'|'full')   // 指定吸附档位
LM_M.measure()               // 重新计算面板尺寸与档位
LM_M.overview()              // 全景
LM_M.declutter()             // 手动触发标签降噪
```

---

## 目录结构

```
longmarch/
├── index.html                  # PC 端入口（≥1181px 桌面版式；≤900px 自动单列降级）
├── mobile.html                 # ★ 移动端入口（新增）
├── README.md                   # ★ 本文档（新增）
├── docs/                       # ★ 文档截图（新增）
│   ├── shot-01-overview.jpg
│   ├── shot-02-detail.jpg
│   ├── shot-03-terrain.jpg
│   ├── shot-04-landscape.jpg
│   └── shot-05-index-mobile.png   # index.html 手机降级版式
├── assets/
│   ├── css/
│   │   ├── style.css           # PC 端样式（末尾新增 ≤900px 响应式区块）
│   │   └── mobile.css          # ★ 移动端样式（新增，约 800 行）
│   ├── js/
│   │   ├── data.js             # 节点 / 部队 / 图例数据（共用，未改动）
│   │   ├── geo.js              # 水系、地貌、加密点数据（共用，未改动）
│   │   ├── routes-geo.js       # 拟合后的路线折线（共用，未改动）
│   │   ├── app.js              # PC 端交互（未改动，只读复用）
│   │   └── mobile.js           # ★ 移动端交互引擎（新增，约 1150 行）
│   └── vendor/leaflet/         # Leaflet 1.9.4 本地化（CSS/JS/图标）
└── tools/
    └── build-routes.js         # 离线生成 routes-geo.js 的脚本（路线拟合）
```

### 新增文件一览

| 路径 | 类型 | 作用 | 行数 |
| --- | --- | --- | --- |
| `longmarch/mobile.html` | 页面 | 移动端入口，独立于 `index.html` | 177 |
| `longmarch/assets/css/mobile.css` | 样式 | 移动端独立样式体系，不加载 `style.css` | 799 |
| `longmarch/assets/js/mobile.js` | 交互 | 移动端交互引擎，命名空间隔离 | 1148 |
| `longmarch/docs/*.jpg` | 资源 | README 展示截图 | — |
| `longmarch/README.md` | 文档 | 本文件 | — |

**复用的既有文件（未做任何修改）**：`assets/js/data.js`、`assets/js/geo.js`、`assets/js/routes-geo.js`、`assets/vendor/leaflet/*`。

---

## 移动端适配说明

### 1. 视口与安全区

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- `width=device-width`：以设备逻辑宽度为基准，不做 320px 定宽缩放。
- `viewport-fit=cover`：允许内容延伸到刘海/圆角区域，配合 `env(safe-area-inset-*)` 做安全区内缩。
- 高度优先使用 `100dvh`（动态视口单位），规避移动浏览器地址栏收起/展开导致的 `100vh` 溢出；并通过 `@supports (height:100dvh)` 渐进增强。

### 2. 响应式断点

以 **390px** 为基准设计宽度，向两端逐级调整：

| 断点 | 适用设备 | 主要变化 |
| --- | --- | --- |
| `max-width: 359px` | iPhone SE / 小屏安卓（320–359） | 顶栏 48px、标题 15px、分段按钮 34px、详情标题 20px、卡片字号整体下调 1–2px |
| 360–429px | 主流竖屏（iPhone 12–15、多数安卓） | **基准布局** |
| `min-width: 430px` | 大屏手机 / 折叠屏外屏 | 面板内边距与卡片间距放大，阅读更松弛 |
| `min-width: 600px` | 小平板 / 横屏大屏 | 面板改为居中浮层（最大 560px），两侧留出地图 |
| `orientation: landscape` 且 `max-height: 560px` | 手机横屏 | 面板转为**右侧抽屉**（宽度 `min(420px, 48vw)`），地图常驻左侧 |
| `prefers-reduced-motion: reduce` | 系统开启「减弱动效」 | 关闭动画与过渡，仅保留状态变化 |

### 3. 触控适配

- **热区放大**：所有标记外包一层 42×42px 透明层（`.mk-hit`），视觉大小不变但点击面积翻倍以上。
- **手势与滚动不打架**：面板拖拽用 Pointer Events 统一处理触摸/鼠标，仅在 `.sheet-grip` 与分段区监听，列表区域保持原生滚动。
- **甩动判据**：松手时按位移速度决定是否跨档，慢速拖动则吸附到最近档位，避免误触。
- **输入框字号 ≥16px**：防止 iOS Safari 聚焦时自动放大页面。

### 4. 布局结构（竖屏）

```
┌───────────────────────────┐
│ 顶栏 52px（安全区下移）      │  ← sticky，不随地图滚动
├───────────────────────────┤
│                           │
│        地图（占满）         │  ← 面板浮在地图之上
│   · 标记（42px 热区）        │
│   · 地形浮条（进入地形时）    │
│                           │
├───────────────────────────┤
│ 拖拽条                     │  ← 面板三段吸附：peek / half / full
│ 分段：行军序列｜节点详情｜图层 │
│ ─────────────────────────  │
│ 内容区（内部滚动）           │
│ ─────────────────────────  │
│ 底栏（常驻，如「放大看地形」） │
└───────────────────────────┘
```

面板采用 `transform: translate3d(0, var(--ty), 0)` 位移并配合 `padding-bottom: var(--ty)`，使**内部内容区高度始终等于屏内可见高度**，从而让底栏按钮永远贴在可见区域内，不会掉到屏幕外。

### 5. 横屏处理

横屏时纵向空间被压缩，底部面板会挤掉地图。因此程序在 `measure()` 中检测「宽 > 高 且 高 ≤ 560」：

- 面板切换为右侧抽屉（`body.land`），纵向占满顶栏以下，不再纵向位移；
- 地图保留左侧约 52% 宽度，标记定位时把目标点送到**左侧剩余区域的中心**，而不是整屏中心；
- 归因标注、地形浮条、Toast 同步改到左侧，避免被抽屉遮挡。

### 6. `index.html` 的响应式降级（v1.1 修复）

手机上直接打开 `index.html` 曾出现「仍是 PC 宽版式、需要左右滑动」。排查结论与修复如下：

**病因（三处叠加）**

| # | 问题 | 说明 |
| --- | --- | --- |
| 1 | `#app` 用了 `1fr` 轨道 | CSS Grid 中 `1fr` 的**自动最小尺寸 = 内容的 min-content**，轨道会被内容撑宽，`1fr` 其实并不「可缩」 |
| 2 | 顶栏是不换行的 flex | `.topbar` 默认 `flex-wrap:nowrap`，品牌 + 5 个统计块 + 4 个底图按钮 + 全景按钮的 min-content ≈ 1000px，直接把 `1fr` 轨道撑到 1000px |
| 3 | 旧媒体查询只改了网格，没改顶栏 | `≤900px` 时 `#app` 换成单列、`.side` 变成 `translateX(-100%)` 的抽屉，但**没有任何按钮去加 `.open`**，序列列表在手机上等于永久隐藏 |

结果：整页按 ~1000px 排版、被浏览器整体缩小 → 看起来像「PC 版没适配」。

**修复**

```css
/* ① 轨道锁死，禁止内容撑宽 */
#app{ grid-template-columns:352px minmax(0,1fr); }

/* ② 顶栏允许换行、子项可收缩 */
@media (max-width:900px){
  .topbar{ flex-wrap:wrap; min-width:0; width:100%!important; }
  .topright{ display:contents; }      /* 拆开嵌套 flex，按钮直接参与换行 */
  .hstats{ display:none; }            /* 5 个统计块是溢宽主因 */
}
```

`index.html` 的响应式断点（与 `mobile.html` 相互独立）：

| 断点 | 变化 |
| --- | --- |
| `max-width:1180px` | 侧栏 352→290px，卡片 426→380px，统计块隐藏第 4、5 个 |
| `max-width:900px` | **单列流式**：顶栏（≤390px 时两行）→ 地图 56dvh → 序列列表；`.side` 取消抽屉改常规区块；信息卡片改底部抽屉（`position:fixed`，`max-height:82dvh`）；时间轴整宽；图例/提示隐藏 |
| `max-width:480px` | 地图 52dvh、标题 16px、底图按钮字号 10.5px、时间轴刻度隐藏 |
| `max-height:560px` 且横屏 | 地图占满 `100dvh - 46px`，序列列表隐藏 |

> 修复后实测：390 / 375 / 320 / 768 / 740×360（横屏）/ 1440 各视口 `document.scrollWidth` **均等于视口宽度**，无横向滚动；1440px 桌面端版式与修复前完全一致。

---

## 技术实现

| 层面 | 方案 |
| --- | --- |
| 地图引擎 | Leaflet 1.9.4（本地化到 `assets/vendor/leaflet/`，不依赖 CDN 与 Key） |
| 底图 | Esri 在线瓦片：`World_Topo_Map` / `World_Imagery` / `NatGeo_World_Map` + `World_Hillshade` 晕渲 |
| 路线几何 | `tools/build-routes.js` 离线生成：OSM 步行路由 + 加密点强制经过 + 绕行比校验 + Catmull-Rom 平滑 + Douglas-Peucker 化简（full/coarse 两级） |
| 标记造型 | CSS `clip-path` 多边形：雪山=六边冰晶、草地=叶片、渡口=水滴，其余为圆标 + 类型字 |
| 标签降噪 | 两段式：先按 26px 方框去重标记（含视口裁剪），再按文字宽度做矩形避让排布标签 |
| 状态管理 | 单一 `state` 对象（`sel / pane / active / terrain / base / water / geo / tlIdx`），UI 由 `refreshUI()` 统一回写 |
| 动画 | 位移用 `requestAnimationFrame` 批处理，避免拖动时频繁写样式 |
| 依赖 | 零框架、零构建、零后端；仅 `data.js / geo.js / routes-geo.js / mobile.js` 四个脚本 |

---

## 与 PC 端的关系

移动端**完全独立**，不会影响 PC 端：

| 维度 | PC 端 | 移动端 |
| --- | --- | --- |
| 入口 | `index.html` | `mobile.html` |
| 样式 | `assets/css/style.css` | `assets/css/mobile.css` |
| 脚本 | `assets/js/app.js` | `assets/js/mobile.js` |
| 数据 | `data.js` / `geo.js` / `routes-geo.js` | 同（只读复用） |

- 移动端页面**不加载** `style.css` 与 `app.js`，PC 端也**不加载** `mobile.css` 与 `mobile.js`。
- 两者只在数据层共享 `data.js` / `geo.js` / `routes-geo.js`，且均为**只读引用**。
- 移动端样式全部限定在 `mobile.css` 内，且顶栏品牌星形改用 `.bstar` 类名，避免与节点标记的 `.mk.star` 同名造型规则互相污染。

> v1.1 起 `index.html` / `style.css` 增加了**≤900px 的响应式降级**（见上一节），目的是「手机直接打开 PC 入口也不至于不可用」。
> 这部分改动**全部包在 `@media (max-width:1180px)` 及更窄的断点里**，≥1181px 的桌面版式一行未动；`app.js` 与数据文件依旧零修改。
> 若只需要桌面版，删掉 `style.css` 末尾的响应式区块即可；`mobile.html` 那套体验不受任何影响。

---

## 数据来源与版权

- **底图与山体晕渲**：&copy; [Esri](https://www.esri.com/)（ArcGIS Online 公开服务，免 Key）
- **路线拟合与地图数据**：&copy; [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)（ODbL）
- **行军路线**：由 OSM 步行/公路路径服务拟合后离线固化；川西无人区段落按史实走向手工加密并平滑
- **坐标**：WGS-84，各地纪念地/渡口/垭口的近似点位，**用于宏观路线呈现，不作导航之用**
- **史实内容**：节点日期、事件经过、历史意义等文字为依据公开史料整理

---

## 兼容性

| 环境 | 状态 |
| --- | --- |
| iOS Safari 15+ | ✅ 已验证（含刘海屏安全区） |
| Android Chrome 100+ | ✅ 已验证 |
| 微信内置浏览器（X5 / XWeb） | ✅ 基本验证（Pointer Events 与 `100dvh` 均支持） |
| 桌面 Chrome / Edge | ✅ 正常（可用 DevTools 设备模拟查看移动端） |
| IE / 旧版 Android WebView | ❌ 不支持（大量使用 `clip-path`、`dvh`、Pointer Events） |

已验证视口：**320×568 / 390×844 / 414×896 / 812×375（横屏）/ 1440×900（PC 回归）**，均无横向溢出、无元素裁切、无面板遮挡。

---

## 常见问题

**Q：手机上打开一片黑，只有文字没有地图？**
A：底图瓦片从 Esri 在线拉取，首次加载受网络影响，弱网下需等待数秒。若长期无瓦片，检查是否被网络策略拦截 `server.arcgisonline.com`。

**Q：为什么没有配置腾讯/高德地图 Key？**
A：本项目刻意选择免 Key 的 Esri 公开瓦片，便于零配置部署与分享；如需国内底图，可在 `mobile.js` 的 `BASES` 中替换 `url` 即可，其余逻辑无需改动。

**Q：为什么低缩放下有些节点不见了？**
A：这是**标签降噪**：低缩放只保留关键节点，放大后其余节点逐级浮现。避免 70 个点在小屏上糊成一团。

**Q：`file://` 双击打开为什么不行？**
A：脚本按目录加载 `assets/`，`file://` 下会被同源策略拦截。请用任意静态服务器（见[使用方法](#使用方法)）。

**Q：手机上打开还是「PC 宽版」、要左右滑，媒体查询像没生效？**
A：按这三步排查：
1. 确认手机访问的是哪个入口——`index.html` 已支持 ≤900px 单列版式，但**手机端推荐 `mobile.html`**；
2. 打开 DevTools 看 `document.documentElement.scrollWidth` 是否大于 `window.innerWidth`，若大于，说明有元素把页面撑宽（本项目 v1.1 已修复顶栏与 `1fr` 轨道这两处）；
3. 确认 `<head>` 里有 `<meta name="viewport" content="width=device-width, initial-scale=1.0">`。若部署平台（部分 CMS / 后台编辑器）会剥离或改写 viewport，需要在那层配置里放开。

**Q：改了 `style.css` 手机上没变化？**
A：多半是缓存。静态服务建议返回 `Cache-Control: no-store`，或在地址后加 `?v=2` 强制刷新。

---

## 更新记录

### v1.1 · `index.html` 响应式修复（本次）
- 修正 `#app` 的 `1fr` 轨道 → `minmax(0,1fr)`，杜绝内容撑宽
- 顶栏改为可换行 + `.topright{display:contents}`，≤390px 时压到两行
- `≤900px` 重建为单列流式布局：顶栏 → 地图 56dvh → 序列列表，取消无开关的旧抽屉
- 信息卡片改底部整宽抽屉（`position:fixed` + `max-height:82dvh`），时间轴整宽，图例/提示让位
- 补 `viewport-fit=cover`、`theme-color`、内联 SVG favicon；恢复被误隐藏的「水系标注 / 自然地理层」开关
- 桌面端（≥1181px）版式零改动

### v1.0 · 移动端独立页面
- 新增 `mobile.html` / `mobile.css` / `mobile.js`，与 PC 端完全解耦
- 三段吸附底部面板 + 甩动手势，底栏常驻可见
- 42px 触控热区、标签两段式避让、视口内降噪
- 320 / 390 / 430 / 600+ 四级响应式，横屏转右侧抽屉
- 安全区与 `100dvh` 适配，iOS 输入框防自动放大

### v0.2 · 地形强化（PC 端）
- 高缩放自动浮现水系标注（约 50 条）
- 雪山 / 草地 / 渡口归为「自然地理」独立图层
- 行军线改为路径服务拟合的真实折线（`tools/build-routes.js`）

### v0.1 · 初版（PC 端）
- 三方面军 70 节点、时间轴推进、检索、图层与底图切换
