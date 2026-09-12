export function openOperaIntro(root) {
  if (root.querySelector('dialog')) return
  const dialog = document.createElement('dialog')
  dialog.className = 'mask-reference'
  dialog.setAttribute('aria-labelledby', 'referenceTitle')
  dialog.innerHTML = `
    <header><div><p class="reference-kicker">認識川劇與變臉</p><h2 id="referenceTitle">什麼是川劇？</h2></div><button type="button" class="ghost" id="closeReference">返回畫板</button></header>
    <p>川劇是中國傳統戲曲的一種，流行於四川、重慶等地。演員用唱、念、做、打來講故事；變臉是其中一種表演技巧。</p>
    <section><h3>面譜的分別，只有情緒嗎？</h3><p>不只情緒。色彩與紋樣也可以表現角色的<strong>性格、身份、年齡及劇情處境</strong>。同一角色，在不同劇目或人生階段也可能有不同面譜。</p></section>
    <section><h3>為什麼要變臉？</h3><p>在戲劇中，變臉可以表現角色突然的心理轉變，例如由驚恐變為憤怒；要連同故事、語氣及動作理解。現代獨立變臉演出，也會展示快速換面的技藝。</p></section>
    <section><h3>畫之前，想三件事</h3><ol><li>他是誰？有什麼性格？</li><li>發生什麼事，令他的心情改變？</li><li>你會怎樣改線條、顏色，再配一句說話或一個動作？</li></ol><p class="hint">不要把「紅＝憤怒、藍＝傷心」當成川劇的固定規則。參考照片先觀察造型，角色意思要看演出背景。</p></section>
    <footer>文化資料：<a href="https://www.ihchina.cn/project_details/10194.html" target="_blank" rel="noopener noreferrer">中國非物質文化遺產網：專訪川劇傳承人夏庭光</a>；<a href="https://www.cqwl.org/web/article/1433541825799856128/web/content_1433541825799856128.html" target="_blank" rel="noopener noreferrer">重慶文聯：談川劇臉譜藝術</a>。</footer>
  `
  root.appendChild(dialog)
  dialog.querySelector('#closeReference').onclick = () => dialog.close()
  dialog.addEventListener('close', () => { dialog.remove(); root.querySelector('#aboutBtn')?.focus() }, { once: true })
  dialog.showModal()
}

export function toggleMaskReference(root) {
  const stage = root.querySelector('.paint-stage')
  const existing = stage.querySelector('.reference-board')
  const toggle = root.querySelector('#demoBtn')
  if (existing) {
    existing.remove()
    stage.classList.remove('with-reference')
    toggle.setAttribute('aria-expanded', 'false')
    return
  }
  const panel = document.createElement('aside')
  panel.className = 'reference-board'
  panel.id = 'referenceBoard'
  panel.setAttribute('aria-label', '面譜三步畫法')
  panel.innerHTML = `
    <header><strong>面譜參考</strong><button type="button" class="ghost" aria-label="收起面譜參考">×</button></header>
    <p class="reference-subtitle">第一幅：跟步驟學，再設計自己的角色</p>
    <nav class="reference-steps" aria-label="選擇畫法步驟">
      <button type="button" data-step="0" aria-pressed="true">1 底色</button>
      <button type="button" data-step="1" aria-pressed="false">2 眉眼</button>
      <button type="button" data-step="2" aria-pressed="false">3 額紋</button>
    </nav>
    <figure>
      <div class="reference-step-image"><img src="${import.meta.env.BASE_URL}references/guan-yu-steps.png" alt="第一步：紅色面譜，保留眼睛和嘴巴開口" /></div>
      <figcaption aria-live="polite"></figcaption>
    </figure>
    <div class="reference-learning"></div>
    <a href="https://www.cqwl.org/web/article/1433541825799856128/web/content_1433541825799856128.html" target="_blank" rel="noopener noreferrer">川劇配色資料 ↗</a> · <a href="https://sc.sina.com.cn/chuanju/baike/index.html#c2" target="_blank" rel="noopener noreferrer">角色寓意來源 ↗</a>`

  const steps = [
    ['1 選主色', '示範是關羽的紅底；自創角色可以選其他色。', '先想：我的角色有什麼性格？'],
    ['2 畫眉眼與鼻線', '眉毛畫在眼睛上方；鼻線由兩眼之間向下，在鼻尖收彎。', '關羽示範：丹鳳眼、臥蠶眉表現英武。'],
    ['3 設計額紋', '「額紋」是額頭上的圖案，不是壓出來的紋。', '這個關羽簡化示範用三筆，取意桃園三結義；不是每張面譜都要三筆。'],
  ]
  const showStep = (index) => {
    const [title, instruction, meaning] = steps[index]
    const img = panel.querySelector('img')
    img.style.top = `${-index * 98}%`
    img.alt = `第${index + 1}步：${title}，${instruction}`
    panel.querySelector('figcaption').innerHTML = `<strong>${title}</strong><p>${instruction}</p><p class="reference-meaning">${meaning}</p>`
    showLearning(index)
    panel.querySelectorAll('[data-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.step) === index)))
  }
  const colours = [
    ['紅', '#c41e3a', '忠勇、耿直', '關羽'], ['黑', '#222', '嚴肅、威嚴', '張飛'],
    ['白', '#fff', '常表現多疑、奸詐', '曹操'], ['紫', '#7c3aed', '穩重、肅穆', '徐延昭'],
    ['黃', '#eab308', '勇猛、彪悍', '典韋'], ['藍', '#1d4ed8', '剛直、不受拘束', '馬武'],
    ['綠', '#16a34a', '勇猛、莽撞', '徐世英'], ['金', '#b99457', '莊嚴、神聖', '神佛角色'],
  ]
  function showLearning(index) {
    const area = panel.querySelector('.reference-learning')
    if (index === 0) {
      area.innerHTML = `<div class="meaning-colours">${colours.map(([name, colour]) => `<button type="button" data-colour="${name}" style="--chip:${colour}">${name}</button>`).join('')}</div><p class="colour-meaning" aria-live="polite">紅色：忠勇、耿直，例如關羽。</p><p class="learning-note">按色看寓意。這是川劇常見用法，要連同角色與劇情理解；不是「紅＝生氣」。</p>`
      area.querySelectorAll('[data-colour]').forEach(button => { button.onclick = () => {
        const [name, , meaning, example] = colours.find(c => c[0] === button.dataset.colour)
        area.querySelector('.colour-meaning').textContent = `${name}色：${meaning}，例如${example}。`
      } })
    } else if (index === 1) {
      area.innerHTML = `<section class="role-learning"><strong>川劇怎樣表現角色變化？</strong><p>要連同人物和劇情觀察，不是只把嘴角改成笑或哭。</p><p><b>關羽：</b>丹鳳眼、臥蠶眉表現英武；這張是簡化教學圖，並非完整傳統譜式。</p><p><b>曹操的不同劇目：</b>《議劍》的臉譜仍帶紅色；《殺奢》則用大粉臉、橫眉、下眼皮紅線，刻畫角色變得兇狠。</p><p class="learning-note">這是具體角色的例子，不可當成所有角色通用的「生氣畫法」，也不表示每種改妝都是即場變臉。</p><a href="https://news.ifeng.com/c/7fkcpizPErL" target="_blank" rel="noopener noreferrer">成都商報：川劇臉譜與劇情 ↗</a><p class="learning-note">畫下一幅前：他是誰？發生了什麼事？先找該角色的實際臉譜，再比較配色與紋樣。</p></section>`
    } else {
      area.innerHTML = `<div class="forehead-examples"><div><span>Ⅲ</span><b>關羽示例</b><p>三筆：結義故事。</p></div><div><span>☾</span><b>包公示例</b><p>月牙：清廉。</p></div><div><span>?</span><b>你的角色</b><p>自選象徵，說出原因。</p></div></div><p class="learning-note">角色、劇目和畫法不同，額紋也會不同。下一幅可以自創圖案，並解釋它與角色的關係。</p>`
    }
  }
  panel.querySelectorAll('[data-step]').forEach(button => { button.onclick = () => showStep(Number(button.dataset.step)) })
  showStep(0)

  panel.querySelector('button').onclick = () => toggleMaskReference(root)
  stage.appendChild(panel)
  stage.classList.add('with-reference')
  toggle.setAttribute('aria-expanded', 'true')
}
