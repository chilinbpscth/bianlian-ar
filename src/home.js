/** Landing: classroom mainline (physical mask photo) vs digital paint trial. */
export function createHomeScreen(root, { onPhysical, onDigital }) {
  root.innerHTML = `
    <div class="app-shell studio-home">
      <header class="studio-header">
        <div class="studio-brand"><span class="studio-seal">變</span><div>變臉工房<small>COLOUR · CHARACTER · PLAY</small></div></div>
        <p class="studio-note">一張面譜，一個角色。</p>
      </header>
      <div class="studio-progress" aria-label="創作流程"><span class="on"><b>1</b> 畫面譜</span><span><b>2</b> 戴上面譜</span><span><b>3</b> 變臉演出</span></div>
      <section class="studio-intro"><p>01 / 開始創作</p><h1>你的角色，從一筆開始。</h1><div>用顏色與線條畫出性格，再讓面譜跟着你變臉。</div></section>
      <div class="home-choices">
        <button type="button" class="home-card" id="physicalBtn">
          <span class="home-art paper-mask" aria-hidden="true"><i></i></span>
          <span class="home-card-badge">紙上創作</span><span class="home-card-title">拍下你的面譜 <span>↗</span></span>
          <span class="home-card-desc">把畫好的實體面譜拍下來，帶進變臉舞台。</span>
        </button>
        <button type="button" class="home-card" id="digitalBtn">
          <span class="home-art illustrated-mask" aria-hidden="true"><img src="${import.meta.env.BASE_URL}references/guan-yu-steps.png" alt="" /></span>
          <span class="home-card-badge">畫面創作</span><span class="home-card-title">畫一張面譜 <span>→</span></span>
          <span class="home-card-desc">跟着三步插圖參考，在 iPad 上自由畫。</span>
        </button>
      </div>
      <p class="studio-footnote">眼口留空 · 四張面譜 · 揮手變臉</p>
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
