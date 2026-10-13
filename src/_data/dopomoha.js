// Тексти й схема переходів сервісу самодопомоги /dopomoha/ (покроковий майстер).
// Клінічні тексти — на перегляд власника: docs/dopomoha/CLINICAL-REVIEW.md.
//
// Кожен стан — набір кроків. Адреса кроку: #<стан>-<ключ> (наприклад, #tryvoha-yes).
// Типи кроків:
//   do     — одна дія: title, text, example; далі next (+ nextLabel) або options (кнопки-відповіді)
//   choice — запитання з варіантами-кнопками: options [{ label, sub, icon, next }]
//   pick   — вибір готової дії плитками: options [{ label, icon, next }]
// visual — наочна підказка до кроку (див. src/_includes/dopomoha-visuals.njk).
// Поля title/text/example/sub можуть містити простий HTML (лише з цього файлу, без введення користувача).

const sources = {
  nhsWorries: {
    title: "NHS Every Mind Matters — Tackling your worries",
    url: "https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/tackling-your-worries/",
  },
  nhsTodo: {
    title: "NHS Every Mind Matters — Tackling your to-do list",
    url: "https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/tackling-your-to-do-list/",
  },
  nhsFears: {
    title: "NHS Every Mind Matters — Facing your fears",
    url: "https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/facing-your-fears/",
  },
  cg113: {
    title: "NICE CG113 — Generalised anxiety disorder and panic disorder in adults",
    url: "https://www.nice.org.uk/guidance/cg113/chapter/Recommendations",
  },
  ng222: {
    title: "NICE NG222 — Depression in adults: treatment and management",
    url: "https://www.nice.org.uk/guidance/ng222/chapter/Recommendations",
  },
  whoDepression: {
    title: "ВООЗ — Depressive disorder (depression)",
    url: "https://www.who.int/news-room/fact-sheets/detail/depression",
  },
  cg31: {
    title: "NICE CG31 — Obsessive-compulsive disorder and body dysmorphic disorder: treatment",
    url: "https://www.nice.org.uk/guidance/cg31/chapter/Recommendations",
  },
  nhsOcd: {
    title: "NHS — Obsessive compulsive disorder (OCD): symptoms",
    url: "https://www.nhs.uk/mental-health/conditions/obsessive-compulsive-disorder-ocd/symptoms/",
  },
  nhsOcdTreatment: {
    title: "NHS — Obsessive compulsive disorder (OCD): treatment",
    url: "https://www.nhs.uk/mental-health/conditions/obsessive-compulsive-disorder-ocd/treatment/",
  },
  nhsPanic: {
    title: "NHS — Panic disorder",
    url: "https://www.nhs.uk/mental-health/conditions/panic-disorder/",
  },
  nhsBreathing: {
    title: "NHS — Breathing exercises for stress",
    url: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/",
  },
  whoStress: {
    title: "ВООЗ — Doing What Matters in Times of Stress",
    url: "https://www.who.int/publications/i/item/9789240003927",
  },
  nhsHeart: {
    title: "NHS — Heart attack",
    url: "https://www.nhs.uk/conditions/heart-attack/",
  },
  nhsStroke: {
    title: "NHS — Symptoms of a stroke",
    url: "https://www.nhs.uk/conditions/stroke/symptoms/",
  },
  nhsFainting: {
    title: "NHS — Fainting",
    url: "https://www.nhs.uk/conditions/fainting/",
  },
};

// Ознаки, за яких потрібна невідкладна допомога (гілка паніки й картка «Підготуватися заздалегідь»).
const urgentSigns = [
  "будь-яка втрата свідомості — навіть короткочасна;",
  "новий сильний біль, тиск або стискання в грудях, особливо якщо віддає в руку, шию чи щелепу;",
  "сильне утруднення дихання: задихаєтеся, не можете договорити речення;",
  "раптово перекосилося обличчя, ослабла рука чи нога з одного боку, змінилося мовлення.",
];

const states = [
  {
    id: "tryvoha",
    title: "Тривожуся",
    hint: "Думки про погане не відпускають",
    color: "var(--terracotta)",
    icon: '<path d="M2 12.5h4l2-5 3 9 2.5-6 1.5 3h7"/>',
    safety: "Якщо небезпека реальна просто зараз — спершу дійте за правилами безпеки.",
    start: "dumka",
    simplest: "prosto",
    extra: "piznishe",
    extraLabel: "Відкласти хвилювання на потім",
    guide: { url: "/statti/postiina-tryvoha/", label: "Посібник: постійна тривога" },
    quiz: { url: "/kviz/tryvoga/", label: "Опитувальник тривоги (GAD-7)" },
    why: "Тривога змішує справжні справи й здогадки про майбутнє. Розділяти їх — проблеми, з якими можна щось зробити, і гіпотетичні хвилювання — радить NHS. Мета не заборонити тривогу, а повернути собі частину часу й дій. Якщо з'явилися нові факти — оцініть їх і змініть план.",
    sources: ["nhsWorries"],
    steps: {
      dumka: {
        type: "do", n: 1, of: 3, visual: "thought",
        title: "Про що ця думка?",
        text: "Скажіть її подумки одним реченням.",
        example: "«Не встигну зі звітом» або «А раптом щось станеться з мамою».",
        next: "mozhu", nextLabel: "Далі",
      },
      mozhu: {
        type: "choice", n: 2, of: 3, visual: "fork",
        title: "Чи можете ви щось із цим зробити сьогодні?",
        options: [
          { label: "Так, можу", sub: "є конкретна справа", icon: "yes", next: "krok" },
          { label: "Ні, від мене не залежить", sub: "це про майбутнє чи про інших", icon: "no", next: "araptom" },
          { label: "Не знаю", sub: "тоді поки що — ні", icon: "unsure", next: "araptom" },
        ],
      },
      krok: {
        type: "do", n: 3, of: 3, visual: "step",
        title: "Оберіть найменший крок",
        text: "Одну дію на кілька хвилин — і час, коли ви її зробите.",
        example: "«О 15:00 складу план одного розділу.» «Увечері подзвоню мамі.»",
        next: "end", nextLabel: "Я обрав(ла) крок",
      },
      araptom: {
        type: "do", n: 3, of: 3, visual: "letgo",
        title: "Це думка «а раптом»",
        text: "Відповіді на неї зараз немає, і шукати її не обов'язково. Оберіть одну справу на дві хвилини й зробіть її — навіть якщо тривога ще поруч.",
        example: "Допити чай · помити чашку · дочитати абзац · вийти на балкон.",
        next: "end", nextLabel: "Зробив(ла)",
      },
      prosto: {
        type: "do", simpler: true, visual: "letgo",
        title: "Одна справа поруч",
        text: "Скажіть собі: «Знову думка „а раптом“». І зробіть одну просту дію на хвилину.",
        example: "Допити чай або помити чашку.",
        next: "end", nextLabel: "Зробив(ла)",
      },
      piznishe: {
        type: "do", visual: "clock",
        title: "Відкладіть хвилювання на потім",
        text: "Оберіть 10–15 хвилин пізніше сьогодні — краще вдень, не перед сном. Коли думка повертається, скажіть собі: «Подумаю про це о 18:00» — і поверніться до справи. У цей час: для справжньої проблеми — один крок, для «а раптом» — закрийте тему.",
        example: "11:20 — «А раптом звіт розкритикують?» → «Подумаю о 18:00». 18:00 — крок: завтра звірити звіт із вимогами.",
        next: "end", nextLabel: "Зрозуміло",
        more: { url: "/statti/postiina-tryvoha/#vidkladannia", label: "Детальніше з прикладом" },
      },
    },
  },
  {
    id: "nemaie-syl",
    title: "Немає сил",
    hint: "Важко почати навіть прості справи",
    color: "var(--blue-gray)",
    icon: '<path d="M6.5 16a4 4 0 0 1 .3-8 5 5 0 0 1 9.6-1.4A4.2 4.2 0 0 1 17.5 16h-11z"/><path d="M8 19.5v.01M12 19.5v.01M16 19.5v.01"/>',
    safety: "Якщо з'являються думки про смерть або про те, щоб завдати собі шкоди, — не чекайте вправ: <a href=\"/help/\">термінова допомога</a>.",
    start: "vybir-dii",
    simplest: "menshe",
    extra: "dlia-sebe",
    extraLabel: "Одна дія для себе",
    guide: { url: "/statti/depresiya/", label: "Посібник: коли немає сил" },
    quiz: { url: "/kviz/depresiya/", label: "Опитувальник депресії (PHQ-9)" },
    why: "Повертатися до дій поступово, не чекаючи мотивації, — основа поведінкової активації, яку NICE NG222 включає до варіантів допомоги при депресії. Починати з малого радить NHS, а турботу про себе й зв'язок із близькими ВООЗ називає важливою частиною самодопомоги. Настрій може не змінитися одразу — це не робить крок марним.",
    sources: ["ng222", "nhsTodo", "whoDepression"],
    steps: {
      "vybir-dii": {
        type: "pick", n: 1, of: 2,
        title: "Оберіть одну дію — найменшу з можливих",
        text: "Не треба відчувати бажання. Достатньо обрати.",
        options: [
          { label: "Випити склянку води", icon: "water", next: "voda" },
          { label: "Відкрити штору чи вікно", icon: "window", next: "svitlo" },
          { label: "Прибрати одну річ", icon: "box", next: "rich" },
          { label: "Написати одне повідомлення", icon: "chat", next: "lyst" },
          { label: "Почати одну справу", icon: "doc", next: "sprava" },
        ],
      },
      voda: {
        type: "do", n: 2, of: 2, visual: "icon-water",
        title: "Випийте склянку води",
        text: "Тільки це. Більше нічого не потрібно.",
        options: [{ label: "Зробив(ла)", next: "end", primary: true }, { label: "Не вийшло", next: "menshe" }],
      },
      svitlo: {
        type: "do", n: 2, of: 2, visual: "icon-window",
        title: "Відкрийте штору чи вікно",
        text: "Можна просто постояти поруч хвилину. Більше нічого не потрібно.",
        options: [{ label: "Зробив(ла)", next: "end", primary: true }, { label: "Не вийшло", next: "menshe" }],
      },
      rich: {
        type: "do", n: 2, of: 2, visual: "icon-box",
        title: "Приберіть одну річ",
        text: "Одну чашку, одну футболку, один папірець. Не кімнату — одну річ.",
        options: [{ label: "Зробив(ла)", next: "end", primary: true }, { label: "Не вийшло", next: "menshe" }],
      },
      lyst: {
        type: "do", n: 2, of: 2, visual: "icon-chat",
        title: "Напишіть одне повідомлення",
        text: "Людині, з якою вам безпечно. Можна взяти готовий текст:",
        example: "«Мені зараз важко. Можеш написати чи зателефонувати пізніше?»",
        options: [{ label: "Надіслав(ла)", next: "end", primary: true }, { label: "Не вийшло", next: "menshe" }],
      },
      sprava: {
        type: "do", n: 2, of: 2, visual: "icon-doc",
        title: "Зробіть лише початок справи",
        text: "Не всю справу — тільки перший рух: відкрити файл, знайти номер, дістати потрібну річ. Після цього можна зупинитися.",
        example: "Не «записатися до лікаря», а «знайти номер клініки».",
        options: [{ label: "Зробив(ла)", next: "end", primary: true }, { label: "Не вийшло", next: "menshe" }],
      },
      menshe: {
        type: "do", simpler: true, visual: "icon-seat",
        title: "Нічого страшного. Ще менше",
        text: "Оберіть щось зовсім просте: сісти зручніше, зробити ковток води, подивитися у вікно. Або попросіть когось про одну річ.",
        example: "«Можеш принести мені поїсти?»",
        note: "Якщо не вдається поїсти, попити чи подбати про себе — це привід звернутися по медичну допомогу, а не вимагати від себе більше.",
        next: "end", nextLabel: "Добре",
      },
      "dlia-sebe": {
        type: "do", visual: "icon-music",
        title: "Одна дія для себе",
        text: "Згадайте щось, що раніше подобалося, і візьміть найменшу частину: одну пісню, п'ять хвилин біля вікна, одне фото з альбому. Оцінювати, чи покращився настрій, не обов'язково.",
        example: "«Слухаю одну пісню. Радості поки немає, але я зробив крок, який обрав.»",
        next: "end", nextLabel: "Зробив(ла)",
        more: { url: "/statti/depresiya/#aktyvatsiia", label: "Детальніше про маленький план дня" },
      },
    },
  },
  {
    id: "naviazlyvosti",
    title: "Думки й перевірки по колу",
    hint: "Хочеться знову перевірити або перепитати",
    color: "var(--sand-text)",
    icon: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.5h-4.5"/>',
    safety: "Перевірки, потрібні для реальної безпеки — за інструкцією чи порадою лікаря, — робіть як звичайно. Якщо ви працюєте з терапевтом, ваш спільний план важливіший за цю вправу.",
    start: "shcho",
    simplest: "pauza",
    extra: "zapys",
    extraLabel: "Помітити коло на папері",
    guide: { url: "/statti/okr/", label: "Стаття: ОКР і що допомагає" },
    quiz: null,
    why: "Повторні перевірки, прохання запевнити й «нейтралізуючі» думки NHS відносить до компульсій: вони ненадовго знижують тривогу, але нав'язлива думка повертається, і коло починається знову. NICE CG31 рекомендує КПТ з експозицією та запобіганням реакції; її проходять поступово, з фахівцем або за структурованими матеріалами з його підтримкою. Відкласти ритуал на кілька хвилин — найменший крок у цьому напрямку, не заміна лікування.",
    sources: ["nhsOcd", "cg31", "nhsOcdTreatment", "nhsFears"],
    steps: {
      shcho: {
        type: "choice", n: 1, of: 4,
        title: "Що зараз хочеться зробити?",
        options: [
          { label: "Ще раз перевірити", sub: "двері, плиту, повідомлення, своє здоров'я", icon: "check", next: "vzhe" },
          { label: "Перепитати когось", sub: "«Ти точно не сердишся?», «Все буде добре?»", icon: "ask", next: "kolo-pytaty" },
          { label: "Знайти відповідь", sub: "у голові чи в інтернеті: прокручувати, шукати, доводити собі", icon: "search", next: "kolo-shukaty" },
        ],
      },
      vzhe: {
        type: "choice", n: 2, of: 4,
        title: "Ви вже перевіряли це один раз?",
        options: [
          { label: "Ні, ще не перевіряв(ла)", icon: "no", next: "odyn-raz" },
          { label: "Так, і хочеться ще", icon: "yes", next: "kolo-pereviryty" },
        ],
      },
      "odyn-raz": {
        type: "do", n: 3, of: 3, visual: "icon-check",
        title: "Перевірте один раз — як звичайно",
        text: "Спокійно, без поспіху. І йдіть далі, навіть якщо трохи сумніву лишилося.",
        next: "end", nextLabel: "Перевірив(ла)",
      },
      "kolo-pereviryty": {
        type: "do", n: 3, of: 4, visual: "cycle",
        title: "Так працює коло",
        text: "Ще одна перевірка заспокоїть ненадовго — а потім сумнів повернеться і захочеться перевірити знову.",
        next: "vidklasty", nextLabel: "Що з цим робити?",
      },
      "kolo-pytaty": {
        type: "do", n: 2, of: 3, visual: "cycle-ask",
        title: "Так працює коло",
        text: "Нове запевнення заспокоїть ненадовго — а потім сумнів повернеться і захочеться перепитати знову.",
        next: "vidklasty", nextLabel: "Що з цим робити?",
      },
      "kolo-shukaty": {
        type: "do", n: 2, of: 3, visual: "cycle-search",
        title: "Так працює коло",
        text: "Знайдена відповідь заспокоїть ненадовго — а потім з'явиться нове «а якщо» і захочеться шукати знову.",
        next: "vidklasty", nextLabel: "Що з цим робити?",
      },
      vidklasty: {
        type: "do", final: true, visual: "timer",
        title: "Відкладіть на 5 хвилин",
        text: "Не забороняйте собі — лише відкладіть. Запустіть таймер і займіться звичайною справою поруч.",
        example: "Домити посуд, дочитати сторінку, піти до зупинки.",
        after: "Помітьте, яким стало бажання. Далі вирішуєте ви — і будь-який вибір нормальний.",
        next: "end", nextLabel: "Далі",
      },
      pauza: {
        type: "do", simpler: true, visual: "icon-pause",
        title: "Коротка пауза",
        text: "Перш ніж перевірити чи перепитати — зробіть одну звичайну дію: допийте воду, пройдіться кімнатою, дочитайте речення. Пауза — вже крок, навіть якщо потім перевірите.",
        example: "Хочу втретє запитати, чи не сердиться він. Спершу домиваю тарілку.",
        next: "end", nextLabel: "Зробив(ла)",
      },
      zapys: {
        type: "do", visual: "cycle",
        title: "Помітити коло на папері",
        text: "Згадайте одну недавню ситуацію й запишіть трьома рядками: яка була думка, що ви зробили, щоб відчути впевненість, і скільки тривало полегшення. Лише одну ситуацію — запис не має ставати новою перевіркою.",
        example: "«А раптом я не вимкнув праску» → повернувся і перевірив двічі → полегшало хвилин на десять, потім думка повернулася.",
        next: "end", nextLabel: "Зрозуміло",
        more: { url: "/statti/okr/", label: "Про коло ОКР і лікування" },
      },
    },
  },
  {
    id: "panika",
    title: "Накриває паніка",
    hint: "Раптовий сильний страх і відчуття в тілі",
    color: "var(--accent)",
    icon: '<path d="M12 21.5c5.2 0 9.5-4.3 9.5-9.5S17.2 2.5 12 2.5 2.5 6.8 2.5 12c0 1.7.4 3.3 1.3 4.7L2.5 21.5l4.9-1.3c1.4.8 2.9 1.3 4.6 1.3z"/><path d="M9.5 10.2c0-.7.5-1.2 1.2-1.2h.6c.7 0 1.2.5 1.2 1.2 0 1.4-1.9 1.4-1.9 3.1M12 15.8v.01"/>',
    safety: null,
    big: true,
    start: "znaiome",
    simplest: "odne",
    extra: "kartka",
    extraLabel: "Підготуватися заздалегідь",
    guide: { url: "/statti/panichni-ataky/", label: "Посібник: панічні атаки" },
    quiz: { url: "/kviz/panichni-ataky/", label: "Опитувальник ознак панічних атак" },
    why: "М'яке, непримусове дихання описує NHS; опора на те, що навколо, — скорочений підхід із посібника ВООЗ про стрес. NHS радить під час нападу нагадувати собі, що він мине. Вправа не провокує симптоми і не обіцяє миттєвого ефекту; дихання в пакет, затримки дихання й навмисне часте дихання тут не використовуються. Якщо напади повторюються або ви почали уникати місць і справ, NICE CG113 рекомендує звернутися по КПТ.",
    sources: ["nhsBreathing", "whoStress", "nhsPanic", "cg113"],
    steps: {
      znaiome: {
        type: "choice",
        title: "Це схоже на ваш звичний напад?",
        text: "Тобто такі напади вже бували, лікар їх оцінював, а відчуття знайомі.",
        options: [
          { label: "Так, це знайоме", icon: "yes", next: "sisty" },
          { label: "Ні — це нове, сильніше або інакше", sub: "або я не впевнений(а)", icon: "alert", next: "terminovo", danger: true },
        ],
      },
      terminovo: {
        type: "urgent",
        title: "Нові симптоми потребують медичної оцінки",
        text: "Телефонуйте просто зараз, якщо є хоча б одне:",
        after: "Якщо жодної з цих ознак немає, але симптоми незвичні — зверніться до лікаря сьогодні. Поки чекаєте, можна підтримати себе:",
        next: "sisty", nextLabel: "Кроки підтримки",
      },
      sisty: {
        type: "do", n: 1, of: 5, visual: "icon-seat",
        title: "Сядьте або обіпріться на щось стійке",
        text: "Якщо ви за кермом — безпечно зупиніться.",
        next: "opora", nextLabel: "Далі",
      },
      opora: {
        type: "do", n: 2, of: 5, visual: "icon-feet",
        title: "Відчуйте підлогу під ногами",
        text: "Нічого не змінюйте — просто помітьте опору.",
        next: "try", nextLabel: "Далі",
      },
      try: {
        type: "do", n: 3, of: 5, visual: "icon-eye",
        title: "Назвіть 3 речі, які бачите",
        text: "І один звук, який чуєте.",
        example: "Синя машина, дерево, сумка. Шум автобуса.",
        next: "dykhannia", nextLabel: "Далі",
      },
      dykhannia: {
        type: "do", n: 4, of: 5, visual: "breath",
        title: "Дихайте за колом, якщо це допомагає",
        text: "Вдих — коли коло росте, видих — коли зменшується. Без затримок і без зусиль. Якщо так гірше — дихайте, як вам зручно.",
        next: "khvylia", nextLabel: "Далі",
      },
      khvylia: {
        type: "do", n: 5, of: 5, visual: "wave",
        title: "Це хвиля",
        text: "Вона піднімається і спадає сама. Вам не потрібно зупиняти її просто зараз.",
        next: "end", nextLabel: "Далі",
      },
      odne: {
        type: "do", simpler: true, visual: "icon-seat",
        title: "Тільки одне",
        text: "Сядьте або обіпріться. Якщо поруч є людина — скажіть їй:",
        example: "«Мені погано, побудь поруч».",
        next: "end", nextLabel: "Далі",
      },
      kartka: {
        type: "card",
        title: "Підготуватися заздалегідь",
        text: "Під час нападу читати важко. У спокійний момент складіть свою картку й тримайте її під рукою: роздрукуйте або збережіть як PDF.",
        next: "end", nextLabel: "Готово",
        more: { url: "/statti/panichni-ataky/#mizh", label: "Що робити між нападами" },
      },
    },
  },
];

// Зворотна сумісність зі старими адресами (#стан-main / -simpler / -extra / -done).
for (const s of states) {
  s.aliases = { main: s.start, simpler: s.simplest, extra: s.extra, done: "end" };
}

module.exports = {
  checked: "13 жовтня 2026",
  sources,
  urgentSigns,
  urgentSources: ["nhsHeart", "nhsStroke", "nhsFainting"],
  states,
};
