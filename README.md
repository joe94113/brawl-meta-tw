# 荒野報馬仔

台灣玩家取向的 Brawl Stars meta、選角與 Counter 工具。前端使用 Vue 3、Vue Router、Tailwind CSS，資料來源整合 Brawlify game data、Brawl Time Ninja 公開天梯統計與繁體中文在地化詞彙。

## 開發

```sh
npm install
npm run assets:icons
npm run data:meta
npm run dev
```

玩家戰績查詢需要透過 Cloudflare Worker 代理 Brawl Time Ninja profile 頁面，避免 GitHub Pages 前端直接請求時被 CORS 擋下。部署 Worker 後，請在 `.env.local` 或 GitHub Actions variables 放入：

```sh
VITE_BRAWL_STARS_PROXY_BASE=https://你的-worker.workers.dev
```

這個網址必須是 `workers/brawlstars-proxy` 部署後的 API Worker，不是前端網站網址。可以用下面指令確認：

```sh
curl -i -X OPTIONS -H "Origin: https://joe94113.github.io" -H "Access-Control-Request-Method: GET" "$VITE_BRAWL_STARS_PROXY_BASE/players/%232PVRQGQG"
```

正確回應應該是 `204`，並包含 `Access-Control-Allow-Origin: https://joe94113.github.io`。

## 建置

```sh
npm run build
npm run preview
```

GitHub Pages 會由 `.github/workflows/deploy-pages.yml` 自動建置與部署，並在部署前更新公開 meta 快照與 SEO icon。

## 資料說明

- Meta 榜以 Brawl Time Ninja 近 30 天窗口的 adjusted win rate / use rate 為主要排序依據。
- 角色、模式、配件與能力之星資料來自 Brawlify game data。
- 角色與技能繁中名稱使用 Brawl Stars assets localization 對照。
- GitHub Pages 是純靜態部署，動態玩家戰績查詢需要 Cloudflare Worker 代理。
