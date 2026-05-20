# 荒野報馬仔

台灣玩家取向的 Brawl Stars meta、選角與 Counter 工具。前端使用 Vue 3、Vue Router、Tailwind CSS，資料來源整合 Brawlify game data、Brawl Time Ninja 公開天梯統計與繁體中文在地化詞彙。

## 開發

```sh
npm install
npm run assets:icons
npm run data:meta
npm run dev
```

本機玩家戰績查詢會透過 Vite dev server 代理官方 Brawl Stars API。請在 `.env.local` 放入：

```sh
BRAWL_STARS_TOKEN=你的官方 API token
```

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
- GitHub Pages 是純靜態部署，動態玩家戰績查詢仍需要本機 dev proxy 或額外後端代理。
