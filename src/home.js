/** Landing: classroom mainline (physical mask photo) vs digital paint trial. */
export function createHomeScreen(root, { onPhysical, onDigital }) {
  root.innerHTML = `
    <div class="app-shell">
      <header class="top">
        <div>
          <h1>變臉 · 視藝 AR</h1>
          <p>課堂主線：實體油色紙樣 → 影相上傳 → AR 變臉</p>
        </div>
      </header>
      <div class="panel">
        <ol class="steps home-steps">
          <li>列印 <code>print/</code> 紙樣，剪空眼口，用油粉彩／顏料填色</li>
          <li>揀下面「主線」影相或上傳，放入面譜 1–4</li>
          <li>開始變臉：揮手或撳掣轉面譜</li>
        </ol>
        <div class="home-choices">
          <button type="button" class="home-card home-card-main" id="physicalBtn">
            <span class="home-card-badge">主線</span>
            <span class="home-card-title">影相／上傳實體面譜</span>
            <span class="home-card-desc">油粉彩、水粉紙樣影低，再入 AR。適合課堂正式流程。</span>
          </button>
          <button type="button" class="home-card home-card-alt" id="digitalBtn">
            <span class="home-card-badge alt">試玩／備案</span>
            <span class="home-card-title">iPad 畫面譜</span>
            <span class="home-card-desc">冇實體物料、或想快速示範時，喺畫面直接畫。</span>
          </button>
        </div>
        <p class="hint">紙樣同物料清單見專案 <strong>print/</strong> 資料夾。校網請放行 README 白名單網域。</p>
      </div>
    </div>
  `

  root.querySelector("#physicalBtn").onclick = () => onPhysical()
  root.querySelector("#digitalBtn").onclick = () => onDigital()

  return {
    destroy() {
      root.innerHTML = ""
    },
  }
}
