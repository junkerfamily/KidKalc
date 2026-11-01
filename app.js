// KidKalc — a visual calculator for kids.
// Every answer is shown with pictures first; the number only appears when asked.

const MIN = 1;
const MAX = 12;

const ITEMS = [
  { id: "dots",      icon: "",   one: "dot",      many: "dots",      label: "Dots" },
  { id: "carrots",   icon: "🥕", one: "carrot",   many: "carrots",   label: "Carrots" },
  { id: "baseballs", icon: "⚾", one: "baseball", many: "baseballs", label: "Baseballs" },
  { id: "flowers",   icon: "🌸", one: "flower",   many: "flowers",   label: "Flowers" },
  { id: "apples",    icon: "🍎", one: "apple",    many: "apples",    label: "Apples" },
  { id: "stars",     icon: "⭐", one: "star",     many: "stars",     label: "Stars" },
];

const OPS = [
  { sym: "+", word: "add" },
  { sym: "−", word: "take away" },
  { sym: "×", word: "times" },
  { sym: "÷", word: "share" },
];

const state = { a: 3, b: 4, op: "+", item: "carrots", played: false, done: false, revealed: false };
let runId = 0;       // bumps whenever a new animation starts, so old ones stop
let lastSay = null;  // re-run when the item changes so words stay right
let lastAnswer = null;

const $ = (s) => document.querySelector(s);
const stage = $("#stage");
const story = $("#story");
const answerBox = $("#answer");
const revealBtn = $("#revealBtn");
const replayBtn = $("#replayBtn");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const currentItem = () => ITEMS.find((i) => i.id === state.item);
const word = (n) => (n === 1 ? currentItem().one : currentItem().many);
const isAre = (n) => (n === 1 ? "is" : "are");

function say(fn) {
  lastSay = fn;
  story.textContent = fn();
}

/* ---------- items ---------- */

function makeItem(cls = "") {
  const e = el("div", "item " + cls);
  e.append(el("span", "ico"));
  paintItem(e);
  return e;
}

function paintItem(e) {
  const it = currentItem();
  e.classList.toggle("dot", !it.icon);
  e.querySelector(".ico").textContent = it.icon;
}

function group(cols, n) {
  const g = el("div", "group");
  g.style.gridTemplateColumns = `repeat(${Math.max(1, Math.min(cols, n))}, var(--s))`;
  return g;
}

// Pick an item size so `cols` items (plus `extra` px) fit across the stage.
function setSize(cols, extra = 0, max = 60) {
  const w = stage.clientWidth - 40 - extra;
  const s = clamp(Math.floor(w / cols - 6), 18, max);
  stage.style.setProperty("--s", s + "px");
  return s;
}

/* ---------- controls ---------- */

function buildControls() {
  const picker = $("#itemPicker");
  for (const it of ITEMS) {
    const b = el("button", "chip");
    b.setAttribute("role", "radio");
    b.dataset.id = it.id;
    b.append(it.icon ? el("span", "ico", it.icon) : el("span", "mini-dot"), it.label);
    b.addEventListener("click", () => setItem(it.id));
    picker.append(b);
  }

  const ops = $("#opPicker");
  for (const op of OPS) {
    const b = el("button", "op");
    b.setAttribute("role", "radio");
    b.dataset.op = op.sym;
    b.append(el("span", "sym", op.sym), el("span", "word", op.word));
    b.addEventListener("click", () => setOp(op.sym));
    ops.append(b);
  }

  document.querySelectorAll(".stepper").forEach((st) => {
    st.querySelectorAll(".step").forEach((btn) =>
      btn.addEventListener("click", () => change(st.dataset.key, +btn.dataset.dir))
    );
  });

  $("#goBtn").addEventListener("click", play);
  revealBtn.addEventListener("click", reveal);
  replayBtn.addEventListener("click", play);
}

function syncControls() {
  document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-checked", c.dataset.id === state.item));
  document.querySelectorAll(".op").forEach((o) => o.setAttribute("aria-checked", o.dataset.op === state.op));
  $("#numA").textContent = state.a;
  $("#numB").textContent = state.b;
  document.querySelectorAll(".stepper").forEach((st) => {
    const v = state[st.dataset.key];
    st.querySelector('[data-dir="1"]').disabled = v >= MAX;
    st.querySelector('[data-dir="-1"]').disabled = v <= MIN;
  });
}

function syncButtons() {
  revealBtn.hidden = !state.played;
  replayBtn.hidden = !state.played;
  revealBtn.disabled = !state.done || state.revealed;
  revealBtn.textContent = state.revealed ? "There it is! 🎉" : state.done ? "Show the answer!" : "Watch first…";
}

function change(key, dir) {
  const v = clamp(state[key] + dir, MIN, MAX);
  if (v === state[key]) return;
  state[key] = v;
  const n = key === "a" ? $("#numA") : $("#numB");
  n.classList.remove("bump");
  void n.offsetWidth;
  n.classList.add("bump");
  syncControls();
  showPreview();
}

function setOp(sym) {
  state.op = sym;
  syncControls();
  showPreview();
}

// Swapping items keeps the picture on screen and just changes what's drawn.
function setItem(id) {
  state.item = id;
  syncControls();
  stage.querySelectorAll(".item").forEach(paintItem);
  if (lastSay) story.textContent = lastSay();
  if (lastAnswer && !answerBox.hidden) lastAnswer();
}

/* ---------- preview (before pressing =) ---------- */

function showPreview() {
  runId++;
  Object.assign(state, { played: false, done: false, revealed: false });
  answerBox.hidden = true;
  lastAnswer = null;
  syncButtons();

  const { a, b, op } = state;
  stage.innerHTML = "";
  const p = el("div", "preview");
  const eq = el("div", "big-eq");
  eq.innerHTML = `${a} ${op} ${b} = <span class="q">?</span>`;
  p.append(eq);

  if (op === "−" && b > a) {
    p.classList.add("oops");
    p.append(el("p", null, `You can't take away ${b} when you only have ${a}.`));
    say(() => `Oops! Make the first number bigger, or the second number smaller.`);
  } else {
    p.append(el("p", null, "Press the big green = button to see it!"));
    const hints = {
      "+": () => `Let's put ${a} ${word(a)} and ${b} ${word(b)} together.`,
      "−": () => `Let's start with ${a} ${word(a)} and take ${b} away.`,
      "×": () => `Let's plant ${a} ${a === 1 ? "row" : "rows"} with ${b} ${word(b)} in each row.`,
      "÷": () => `Let's share ${a} ${word(a)} into ${b} ${b === 1 ? "basket" : "baskets"}.`,
    };
    say(hints[op]);
  }
  stage.append(p);
}

/* ---------- play ---------- */

async function play() {
  const t = ++runId;
  const ok = () => t === runId;
  Object.assign(state, { played: true, done: false, revealed: false });
  answerBox.hidden = true;
  lastAnswer = null;
  stage.innerHTML = "";
  syncButtons();

  const run = { "+": playAdd, "−": playSub, "×": playMul, "÷": playDiv }[state.op];
  const finished = await run(ok);
  if (!ok() || !finished) return;
  state.done = true;
  syncButtons();
}

// Smoothly move elements from their old spots (`first`) to where they are now.
function flip(items, first, dur = 600, stagger = 15) {
  items.forEach((e, i) => {
    const f = first.get(e);
    const l = e.getBoundingClientRect();
    e.animate(
      [{ transform: `translate(${f.left - l.left}px, ${f.top - l.top}px)` }, { transform: "none" }],
      { duration: dur, delay: i * stagger, easing: "cubic-bezier(.5,0,.2,1)", fill: "backwards" }
    );
  });
  return sleep(dur + items.length * stagger);
}

async function addOneByOne(container, n, cls, ok, delay) {
  for (let i = 0; i < n; i++) {
    container.append(makeItem(cls));
    await sleep(delay);
    if (!ok()) return false;
  }
  return true;
}

/* + : two groups pop in, then slide together into one group */
async function playAdd(ok) {
  const { a, b } = state;
  setSize(10, 80);

  const wrap = el("div", "row-wrap");
  const gA = group(5, a);
  const sign = el("div", "sign", "+");
  const gB = group(5, b);
  wrap.append(gA, sign, gB);
  stage.append(wrap);

  say(() => `Here ${isAre(a)} ${a} ${word(a)}.`);
  if (!(await addOneByOne(gA, a, "a pop", ok, clamp(1800 / a, 120, 320)))) return false;
  await sleep(500);
  if (!ok()) return false;

  say(() => `Now add ${b} more!`);
  if (!(await addOneByOne(gB, b, "b pop", ok, clamp(1800 / b, 120, 320)))) return false;
  await sleep(800);
  if (!ok()) return false;

  say(() => `Push them all together!`);
  sign.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(0)" }], { duration: 250, fill: "forwards" });
  await sleep(260);
  if (!ok()) return false;

  const items = [...gA.children, ...gB.children];
  const first = new Map(items.map((e) => [e, e.getBoundingClientRect()]));
  const all = group(10, a + b);
  items.forEach((e) => {
    e.classList.remove("pop");
    all.append(e);
  });
  wrap.replaceWith(all);
  await flip(items, first, 700);
  if (!ok()) return false;

  say(() => `How many ${word(2)} are there now? Try counting them!`);
  return true;
}

/* − : start with a group, then items wiggle and fly away, leaving ghosts */
async function playSub(ok) {
  const { a, b } = state;
  if (b > a) {
    showPreview();
    return false;
  }
  setSize(5, 0, 64);

  const g = group(5, a);
  stage.append(g);
  say(() => `You have ${a} ${word(a)}.`);
  if (!(await addOneByOne(g, a, "a pop", ok, clamp(1800 / a, 120, 320)))) return false;
  await sleep(700);
  if (!ok()) return false;

  say(() => `Now take ${b} away!`);
  const list = [...g.children];
  for (let i = a - 1; i >= a - b; i--) {
    takeAway(list[i]);
    await sleep(clamp(3000 / b, 260, 600));
    if (!ok()) return false;
  }
  await sleep(900);
  if (!ok()) return false;

  say(() => (a === b ? `Uh oh! How many are left now?` : `How many ${word(2)} are left? Try counting them!`));
  return true;
}

async function takeAway(e) {
  e.classList.remove("pop");
  e.classList.add("gone"); // marked right away so it's never counted
  e.animate(
    [{ transform: "none" }, { transform: "rotate(-14deg)" }, { transform: "rotate(14deg)" }, { transform: "none" }],
    { duration: 260 }
  );
  await sleep(260);
  e.animate(
    [{ transform: "none", opacity: 1 }, { transform: "translateY(-70px) scale(.4) rotate(40deg)", opacity: 0 }],
    { duration: 450, easing: "ease-in", fill: "forwards" }
  );
  await sleep(450);
  e.getAnimations().forEach((an) => an.cancel());
  e.classList.add("ghost");
  e.animate([{ opacity: 0 }, { opacity: 0.22 }], { duration: 300 });
}

/* × : a garden with rows of soil, planted one row at a time */
async function playMul(ok) {
  const { a, b } = state;

  const garden = el("div", "garden");
  const rows = [];
  for (let r = 0; r < a; r++) {
    const row = el("div", "g-row");
    const plants = el("div", "g-plants");
    plants.style.gridTemplateColumns = `repeat(${b}, var(--s))`;
    const tally = el("div", "g-tally");
    row.append(el("div", "g-label", r + 1), plants, tally);
    garden.append(row);
    rows.push({ row, plants, tally });
  }
  stage.append(garden);
  // Measure the garden with zero-size plants to learn its fixed overhead, then size plants to fit.
  stage.style.setProperty("--s", "0px");
  const pad = parseFloat(getComputedStyle(stage).paddingLeft) * 2;
  const overhead = garden.scrollWidth;
  stage.style.setProperty("--s", clamp(Math.floor((stage.clientWidth - pad - overhead) / b), 14, 56) + "px");
  const note = el("p", "garden-note", "");
  stage.append(note);

  say(() => `Our garden has ${a} ${a === 1 ? "row" : "rows"}. Let's plant ${b} ${word(b)} in each row!`);
  await sleep(800);
  if (!ok()) return false;

  const itemDelay = clamp(5000 / (a * b), 25, 150);
  const rowPause = clamp(2400 / a, 120, 400);
  for (let r = 0; r < a; r++) {
    say(() => `Planting row ${r + 1}…`);
    for (let c = 0; c < b; c++) {
      rows[r].plants.append(makeItem("sprout"));
      await sleep(itemDelay);
      if (!ok()) return false;
    }
    await sleep(rowPause);
    if (!ok()) return false;
  }

  note.textContent = `${a} ${a === 1 ? "row" : "rows"} going down · ${b} in each row going across`;
  say(() => `How many ${word(2)} are in the whole garden?`);
  return true;
}

/* ÷ : a pile is dealt out one at a time into baskets, like sharing cards */
async function playDiv(ok) {
  const { a, b } = state;
  const per = Math.max(1, Math.ceil(a / b));
  const bCols = Math.min(per, 4);
  setSize(Math.max(6, Math.min(b, 4) * (bCols + 1)), 20, 50);

  const pileBox = el("div", "pile-box");
  const pileTitle = el("div", "box-title", "To share");
  const pile = group(6, a);
  pileBox.append(pileTitle, pile);

  const basketsWrap = el("div", "baskets");
  const baskets = [];
  for (let j = 0; j < b; j++) {
    const bk = el("div", "basket");
    const g = el("div", "group");
    g.style.gridTemplateColumns = `repeat(${bCols}, var(--s))`;
    bk.append(g, el("div", "basket-name", `Basket ${j + 1}`));
    basketsWrap.append(bk);
    baskets.push({ bk, g });
  }
  stage.append(pileBox, basketsWrap);

  say(() => `Here ${isAre(a)} ${a} ${word(a)} to share.`);
  if (!(await addOneByOne(pile, a, "a pop", ok, clamp(1500 / a, 100, 260)))) return false;
  await sleep(600);
  if (!ok()) return false;

  say(() => `Let's share them fairly. One for each basket, again and again!`);
  await sleep(900);
  if (!ok()) return false;

  const items = [...pile.children];
  const rounds = Math.floor(a / b);
  const dealDelay = clamp(4500 / a, 180, 450);
  let idx = 0;
  for (let round = 0; round < rounds; round++) {
    for (let j = 0; j < b; j++) {
      deal(items[idx++], baskets[j].g);
      await sleep(dealDelay);
      if (!ok()) return false;
    }
  }
  await sleep(600);
  if (!ok()) return false;

  if (a % b) {
    pileBox.classList.add("leftover");
    pileTitle.textContent = "Left over";
    say(() =>
      rounds === 0
        ? `There aren't enough for every basket to get one! How many are in each basket?`
        : `Not enough for another round, so some are left over. How many ${word(2)} are in each basket?`
    );
  } else {
    pileBox.remove();
    say(() => `All shared! How many ${word(2)} are in each basket?`);
  }
  return true;
}

function deal(e, target) {
  const first = e.getBoundingClientRect();
  e.classList.remove("pop");
  e.replaceWith(el("div", "slot"));
  target.append(e);
  const last = e.getBoundingClientRect();
  e.animate(
    [
      { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px)` },
      { transform: "translateY(-10px)", offset: 0.85 },
      { transform: "none" },
    ],
    { duration: 480, easing: "cubic-bezier(.4,0,.2,1)" }
  );
}

/* ---------- reveal the answer ---------- */

async function reveal() {
  if (!state.done || state.revealed) return;
  state.revealed = true;
  syncButtons();
  const t = runId;
  const ok = () => t === runId;
  const { a, b, op } = state;

  if (op === "+" || op === "−") {
    const items = [...stage.querySelectorAll(".item:not(.gone)")];
    say(() => `Let's count them together!`);
    const d = clamp(2200 / Math.max(items.length, 1), 70, 300);
    for (let i = 0; i < items.length; i++) {
      items[i].append(el("span", "badge", i + 1));
      await sleep(d);
      if (!ok()) return;
    }
  } else if (op === "×") {
    say(() => `Let's skip count down the rows!`);
    const tallies = [...stage.querySelectorAll(".g-tally")];
    for (let r = 0; r < tallies.length; r++) {
      tallies[r].textContent = (r + 1) * b;
      tallies[r].animate([{ transform: "scale(0)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 350 });
      await sleep(clamp(3000 / a, 220, 500));
      if (!ok()) return;
    }
  } else {
    say(() => `Let's count what's in each basket!`);
    const q = Math.floor(a / b);
    for (const bk of stage.querySelectorAll(".basket")) {
      bk.append(el("div", "count", q));
      await sleep(clamp(1800 / b, 120, 350));
      if (!ok()) return;
    }
    const left = stage.querySelector(".pile-box.leftover");
    if (left) left.querySelector(".box-title").textContent = `Left over: ${a % b}`;
  }

  await sleep(300);
  if (!ok()) return;
  lastAnswer = renderAnswer;
  renderAnswer();
  answerBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderAnswer() {
  const { a, b, op } = state;
  let res, line;
  if (op === "+") {
    const n = a + b;
    res = `${n}`;
    line = `${a} and ${b} more makes ${n} ${word(n)} in all! 🎉`;
  } else if (op === "−") {
    const n = a - b;
    res = `${n}`;
    line = n === 0 ? `None left! All ${a} were taken away. 🎉` : `${n} ${word(n)} ${n === 1 ? "is" : "are"} left! 🎉`;
  } else if (op === "×") {
    const n = a * b;
    res = `${n}`;
    line = `${a} ${a === 1 ? "row" : "rows"} of ${b} makes ${n} ${word(n)} in the garden! 🌱`;
  } else {
    const q = Math.floor(a / b);
    const r = a % b;
    res = r ? `${q} <small>R ${r}</small>` : `${q}`;
    line = r
      ? `Each basket gets ${q} ${word(q)}, and ${r} ${isAre(r)} left over. 🧺`
      : `Each basket gets ${q} ${word(q)}. A fair share! 🧺`;
  }

  answerBox.innerHTML = "";
  const eq = el("div", "eq");
  eq.innerHTML = `<span class="n-a">${a}</span><span>${op}</span><span class="n-b">${b}</span><span>=</span><span class="res">${res}</span>`;
  answerBox.append(eq, el("p", null, line));
  answerBox.hidden = false;
  say(() => `You did it! 🎉 Try a new problem.`);
}

/* ---------- start ---------- */

buildControls();
syncControls();
showPreview();
