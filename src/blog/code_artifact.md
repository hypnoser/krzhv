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

<div class="neuro-simulator" style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 2rem auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <h3 style="margin-top: 0; margin-bottom: 20px; text-align: center; font-size: 1.5rem; color: #1e293b;">Баланс Дофаміну та Серотоніну</h3>
  
  <div style="margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <label for="dopamine" style="font-weight: 600; color: #334155;">Рівень дофаміну:</label>
      <span id="dopamine-val" style="font-weight: bold; color: #2563eb;">50</span>
    </div>
    <input type="range" id="dopamine" min="0" max="100" value="50" style="width: 100%; cursor: pointer;">
  </div>
  
  <div style="margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <label for="serotonin" style="font-weight: 600; color: #334155;">Рівень серотоніну:</label>
      <span id="serotonin-val" style="font-weight: bold; color: #ea580c;">50</span>
    </div>
    <input type="range" id="serotonin" min="0" max="100" value="50" style="width: 100%; cursor: pointer;">
  </div>
  
  <div id="neuro-result" style="padding: 40px 24px; text-align: center; border-radius: 8px; transition: all 0.4s ease; min-height: 120px; display: flex; align-items: center; justify-content: center;">
    <div id="neuro-state" style="font-size: 1.25rem; font-weight: 600; line-height: 1.5;">Оптимальна продуктивність, впевненість, стан потоку</div>
  </div>
</div>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    const dopInput = document.getElementById('dopamine');
    const serInput = document.getElementById('serotonin');
    const dopVal = document.getElementById('dopamine-val');
    const serVal = document.getElementById('serotonin-val');
    const resultBox = document.getElementById('neuro-result');
    const stateText = document.getElementById('neuro-state');

    function updateState() {
      const d = parseInt(dopInput.value);
      const s = parseInt(serInput.value);
      
      dopVal.textContent = d;
      serVal.textContent = s;

      let state = "";
      let bgColor = "";
      let textColor = "#0f172a";

      // Логіка з 4 станами (межа переходу - 50)
      if (d > 50 && s <= 50) {
        // High D + Low S
        state = "Імпульсивність, тривожна активність, ризик вигорання";
        bgColor = "#fee2e2"; // червонуватий (тривога)
        textColor = "#991b1b";
      } else if (d <= 50 && s > 50) {
        // Low D + High S
        state = "Спокій, але відсутність мотивації (пасивність)";
        bgColor = "#e0f2fe"; // блакитний (спокій)
        textColor = "#075985";
      } else if (d <= 50 && s <= 50) {
        // Low D + Low S
        state = "Апатія, депресивний стан, ангедонія";
        bgColor = "#f3f4f6"; // сірий (апатія)
        textColor = "#374151";
      } else { 
        // High D + High S
        state = "Оптимальна продуктивність, впевненість, стан потоку";
        bgColor = "#dcfce7"; // яскраво-зелений (ресурсний стан)
        textColor = "#166534";
      }

      resultBox.style.backgroundColor = bgColor;
      resultBox.style.color = textColor;
      stateText.textContent = state;
    }

    dopInput.addEventListener('input', updateState);
    serInput.addEventListener('input', updateState);
    
    // Ініціалізація при завантаженні
    updateState();
  });
</script>

> **Взаємодія при стресі:** Цікаво, що серотонін здатний пригнічувати надмірну активність дофаміну. Коли рівень серотоніну падає (наприклад, через хронічний стрес), дофамінова система може виходити з-під контролю, провокуючи компульсивну поведінку (наприклад, думскролінг чи переїдання) як спробу швидко отримати "хімічну винагороду" та зняти напругу.
