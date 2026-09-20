---
layout: blog-post.njk
title: "Чому нам не завжди вистачає «гормонів щастя»"
description: "Дофамін відповідає за мотивацію, а серотонін — за спокій. Розбираємося, як їхній баланс (або дисбаланс) формує наш стан."
audience: journal
date: 2026-09-20
---

Часто, описуючи свій емоційний стан, ми спрощуємо все до наявності чи відсутності «гормонів щастя». Але насправді нейрохімія нашого настрою — це не просто наявність чи відсутність радості. Це складна взаємодія різних систем, де дві ключові ролі відіграють дофамін та серотонін. І їхні функції кардинально різняться.

Якщо дофамін — це нейромедіатор **мотивації та досягнення**, то серотонін — нейромедіатор **стабілізації та задоволення поточним станом**. 

Вони працюють у постійній взаємодії, формуючи наш настрій, стресостійкість та здатність долати тривогу.

## Дофамін: Система мотивації та винагороди

Дофамін відповідає не стільки за саме задоволення, скільки за **передчуття** нагороди. Це хімічний сигнал, який змушує нас діяти, шукати ресурси або уникати небезпеки.

Коли дофаміну достатньо, ми відчуваємо драйв, інтерес до нових завдань та бажання змагатися. Але якщо його не вистачає, виникає апатія, прокрастинація та ангедонія. У контексті наслідків психотравмуючих подій (наприклад, ПТСР) дефіцит дофаміну часто проявляється як емоційне оніміння. 

Натомість надлишок або дисрегуляція дофамінової системи може призводити до формування залежностей, імпульсивності та нав'язливого пошуку швидких задоволень.

## Серотонін: Система гальмування та стабільності

Серотонін забезпечує емоційний баланс і діє як внутрішній "гальмовий шлях" для мозку. Він допомагає переносити стрес, не впадаючи в паніку або агресію, і транслює сигнал «ситуація під контролем, ми в безпеці».

Здоровий рівень серотоніну дає нам спокій, здатність витримувати розчарування (фрустрацію) та адаптуватися до соціуму. Дефіцит же призводить до депресивних станів, підвищеної тривожності, проблем зі сном та дратівливості. 

Особливо небезпечний дефіцит серотоніну при травматичному досвіді — він робить центри страху в мозку (амигдалу) гіперреактивними, що змушує людину жити в стані постійного очікування загрози.

---

Щоб краще зрозуміти, як ці дві системи працюють разом, я пропоную вам поекспериментувати з цим інтерактивним симулятором. Змінюйте рівні нейромедіаторів і подивіться, які психоемоційні стани вони формують.

<div class="neuro-widget-wrapper" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 750px; margin: 2rem auto; padding: 24px; background: #fafafa; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
  
  <style>
    .neuro-widget-wrapper * { box-sizing: border-box; }
    .neuro-header { font-size: 1.5rem; color: #111; margin-bottom: 24px; font-weight: 400; }
    
    /* Chart Layout */
    .chart-container { display: flex; position: relative; margin-bottom: 8px; }
    .y-axis { display: flex; flex-direction: column; justify-content: space-between; align-items: center; width: 40px; padding-right: 10px; color: #333; font-size: 0.85rem; }
    .y-axis-label { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; margin: auto 0; }
    
    .chart-area { flex-grow: 1; position: relative; border: 1px solid #ddd; aspect-ratio: 2 / 1; min-height: 300px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; overflow: hidden; }
    
    /* Quadrants */
    .quad { display: flex; align-items: center; justify-content: center; text-align: center; font-size: 0.9rem; color: #444; }
    .quad-tl { background-color: #e9f2eb; } /* Спокій */
    .quad-tr { background-color: #e9f2eb; } /* Потік */
    .quad-bl { background-color: #faeaea; } /* Апатія */
    .quad-br { background-color: #fcf4e4; } /* Тривожна активність */
    
    /* Grid Lines (Middle) */
    .grid-line-v { position: absolute; left: 50%; top: 0; bottom: 0; border-left: 1px dashed #cbd5e1; }
    .grid-line-h { position: absolute; top: 50%; left: 0; right: 0; border-top: 1px dashed #cbd5e1; }
    
    /* Interactive Elements */
    .crosshair-v { position: absolute; top: 0; bottom: 0; border-left: 1px dashed #94a3b8; z-index: 5; pointer-events: none; }
    .crosshair-h { position: absolute; left: 0; right: 0; border-top: 1px dashed #94a3b8; z-index: 5; pointer-events: none; }
    
    .target-dot { position: absolute; width: 20px; height: 20px; background-color: #3b82f6; border-radius: 50%; border: 4px solid rgba(59, 130, 246, 0.3); background-clip: padding-box; transform: translate(-50%, 50%); z-index: 10; pointer-events: none; }
    .dot-label { position: absolute; left: 15px; bottom: 15px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: #334155; white-space: nowrap; }
    
    /* X Axis */
    .x-axis { display: flex; justify-content: space-between; align-items: flex-start; padding-left: 40px; margin-bottom: 32px; color: #333; font-size: 0.85rem; }
    .x-axis-label { text-align: center; flex-grow: 1; font-weight: 500; }
    
    /* Status Section */
    .status-section { text-align: center; margin-bottom: 40px; }
    .status-label { font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 4px; }
    .status-value { font-size: 1.1rem; font-weight: 700; color: #0f172a; }
    
    /* Controls */
    .control-row { display: flex; align-items: center; margin-bottom: 24px; }
    .control-label { width: 150px; font-size: 0.95rem; color: #333; }
    .slider-container { flex-grow: 1; padding: 0 16px; display: flex; align-items: center; }
    
    input[type=range] { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 3px; outline: none; transition: 0.2s; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 24px; border-radius: 4px; background: #222; cursor: pointer; }
    input[type=range]::-moz-range-thumb { width: 16px; height: 24px; border-radius: 4px; background: #222; cursor: pointer; border: none; }
    
    .value-box { width: 60px; height: 40px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 500; font-size: 0.95rem; }
  </style>

  <h2 class="neuro-header">Нейромедіаторний баланс</h2>

  <!-- Chart Area -->
  <div class="chart-container">
    <div class="y-axis">
      <span>100</span>
      <span class="y-axis-label">← Серотонін (Задоволення, Спокій)</span>
      <span>0</span>
    </div>
    
    <div class="chart-area" id="neuro-chart">
      <div class="quad quad-tl">Спокій<br>Пасивність</div>
      <div class="quad quad-tr">Потік<br>Продуктивність</div>
      <div class="quad quad-bl">Апатія<br>Ангедонія</div>
      <div class="quad quad-br">Тривожна активність</div>
      
      <!-- Static Grid Lines -->
      <div class="grid-line-v"></div>
      <div class="grid-line-h"></div>
      
      <!-- Dynamic Elements -->
      <div class="crosshair-v" id="ch-v"></div>
      <div class="crosshair-h" id="ch-h"></div>
      <div class="target-dot" id="target-dot">
        <div class="dot-label" id="dot-text">D:50 S:50</div>
      </div>
    </div>
  </div>
  
  <div class="x-axis">
    <span>0</span>
    <span class="x-axis-label">Дофамін (Мотивація, Драйв) →</span>
    <span>100</span>
  </div>

  <!-- Status Info -->
  <div class="status-section">
    <div class="status-label">ПСИХОЛОГІЧНИЙ СТАН</div>
    <div class="status-value" id="status-text">Збалансований, стабільний стан</div>
  </div>

  <!-- Sliders -->
  <div class="control-row">
    <div class="control-label">Рівень дофаміну</div>
    <div class="slider-container">
      <input type="range" id="dop-slider" min="0" max="100" value="50">
    </div>
    <div class="value-box" id="dop-val">50</div>
  </div>
  
  <div class="control-row">
    <div class="control-label">Рівень серотоніну</div>
    <div class="slider-container">
      <input type="range" id="ser-slider" min="0" max="100" value="50">
    </div>
    <div class="value-box" id="ser-val">50</div>
  </div>

</div>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    const dopSlider = document.getElementById('dop-slider');
    const serSlider = document.getElementById('ser-slider');
    
    const dopVal = document.getElementById('dop-val');
    const serVal = document.getElementById('ser-val');
    
    const targetDot = document.getElementById('target-dot');
    const dotText = document.getElementById('dot-text');
    const chV = document.getElementById('ch-v');
    const chH = document.getElementById('ch-h');
    const statusText = document.getElementById('status-text');

    function updateTrackGradient(slider, val) {
      slider.style.background = `linear-gradient(to right, #111 ${val}%, #e2e8f0 ${val}%)`;
    }

    function updateWidget() {
      const d = parseInt(dopSlider.value);
      const s = parseInt(serSlider.value);
      
      // Update values in UI
      dopVal.textContent = d;
      serVal.textContent = s;
      dotText.textContent = `D:${d} S:${s}`;
      
      // Update slider tracks
      updateTrackGradient(dopSlider, d);
      updateTrackGradient(serSlider, s);
      
      // Update Chart Position (bottom mapping for Y axis)
      targetDot.style.left = d + '%';
      targetDot.style.bottom = s + '%';
      
      chV.style.left = d + '%';
      chH.style.bottom = s + '%';

      // Determine State based on quadrants and exact center
      let stateMsg = "";
      
      // "Мертва зона" для збалансованого стану (навколо 50)
      if (d >= 45 && d <= 55 && s >= 45 && s <= 55) {
        stateMsg = "Збалансований, стабільний стан";
      } else if (d < 50 && s >= 50) {
        stateMsg = "Спокій, Пасивність";
      } else if (d > 50 && s > 50) {
        stateMsg = "Потік, Оптимальна продуктивність";
      } else if (d <= 50 && s < 50) {
        stateMsg = "Апатія, Ангедонія";
      } else if (d >= 50 && s <= 50) {
        stateMsg = "Тривожна активність, Ризик вигорання";
      }

      statusText.textContent = stateMsg;
    }

    dopSlider.addEventListener('input', updateWidget);
    serSlider.addEventListener('input', updateWidget);
    
    // Init
    updateWidget();
  });
</script>

> **Взаємодія при стресі:** Цікаво, що серотонін здатний пригнічувати надмірну активність дофаміну. Коли рівень серотоніну падає (наприклад, через хронічний стрес), дофамінова система може виходити з-під контролю, провокуючи компульсивну поведінку (наприклад, думскролінг чи переїдання) як спробу швидко отримати "хімічну винагороду" та зняти напругу.
