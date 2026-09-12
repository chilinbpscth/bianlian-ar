# 變臉 · 視藝 AR

香港小學視藝課堂用：實體油色臉譜 → 影相／上傳 → MediaPipe 人臉貼圖 + 揮手變臉。MIT。

## 課堂主線 vs 試玩

| 模式 | 用途 |
| --- | --- |
| **主線：影相／上傳實體面譜** | 列印紙樣 → 剪空眼口 → 油粉彩／水粉填色 → App 影相或上傳 → AR |
| **試玩／備案：iPad 畫面譜** | 冇實體物料、或快速示範時，喺畫面直接畫 |

紙樣、PDF、物料清單見 **[print/](print/)**：

- `face-mask-frame.svg` / `.pdf` — A4 大張紙樣
- `face-mask-frame-4up.svg` / `.pdf` — A4 四格快印
- `物料清單.md` — 剪刀、顏料、濕紙巾、報紙、膠紙、iPad／手機等

## 本機試跑

1. 專案根目錄安裝依賴（package scripts：install）
2. 開開發伺服（package scripts：dev；瀏覽器開提示網址；建議手機／iPad Safari 測相機）
3. 正式建置（package scripts：build）

## 校網白名單

校網／防火牆需放行以下網域，否則相機可用但 AI 模型／字體載入會失敗：

| 用途 | 網域 |
| --- | --- |
| MediaPipe WASM (models.json → wasm) | cdn.jsdelivr.net |
| Face / Hand 模型 (models.json → face / hand) | storage.googleapis.com |
| 介面字體 Noto Sans TC | fonts.googleapis.com |
| 字體檔案 | fonts.gstatic.com |

本站頁面可由 GitHub Pages 提供（*.github.io）。首次載入模型可能需十數秒；若逾約 30 秒仍未完成，畫面會提供「再試一次」。

## AR 變臉與驗證

- 雙人各自保留面譜進度；「手動變臉」會切換畫面內的玩家。
- 掃手要由面外穿過面部，再從另一邊離開。短暫失去手部追蹤會保留 250 毫秒，單純消失不會觸發；每位玩家冷卻 300 毫秒。
- 玩家離開超過 1.5 秒後重新入鏡，由面譜一開始。配對依據位置，交叉走位仍需真機驗證。
- `npm test`：測試掃手、雙人進度、左右眼對位及非同步相機／模型清理（使用 Node VM modules 測試替身）。`npm run build`：正式建置。
- 自動測試不代替 iPad Safari 實測；請驗證正面／側面貼合、快慢掃手、雙人走位、影相及返回重入。
