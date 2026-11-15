// ================= أيقونات اللعبة: تحويل الإيموجي إلى أيقونات SVG أصلية =================
// يشتغل أول ما تفتح الصفحة: يحوّل كل إيموجي موجود بنصوص الواجهة (أزرار، لوحات، رسائل، إشعارات) لأيقونة SVG،
// وكل نص جديد يظهر لاحقاً يتحوّل تلقائياً (MutationObserver). الإيموجي الأصلي يبقى داخل <desc> فنصّ العنصر ما يتغيّر
// (كود اللعبة اللي يقارن textContent يظل يشتغل). لإضافة أيقونة: ضعها في ICONS ثم اربطها بالإيموجي في MAP.
// الإيموجي اللي ما له أيقونة (وجوه/حيوانات/أعلام) يبقى كما هو. ما يلمس نصوص الحقول (input/textarea) ولا عناصر data-noicon.
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  // class="f" = تعبئة خفيفة بلون الأيقونة (شكل مزدوج الطبقة)
  var ICONS = {
    check: '<circle class="f" cx="12" cy="12" r="9.5"/><path d="m8 12.5 3 3 5-6"/>',
    tick: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    checksq: '<rect class="f" x="4" y="4" width="16" height="16" rx="3.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    cross: '<circle class="f" cx="12" cy="12" r="9.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    sq: '<rect x="5" y="5" width="14" height="14" rx="3.5"/>',
    dot: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
    ring: '<circle cx="12" cy="12" r="8"/>',
    home: '<path class="f" d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    coin: '<circle class="f" cx="12" cy="12" r="9.5"/><path d="M12 7v10M14.8 9.6c-.5-1-1.5-1.6-2.8-1.6-1.6 0-2.8.8-2.8 2s1 1.7 2.8 2 2.8.8 2.8 2-1.2 2-2.8 2c-1.3 0-2.4-.6-2.9-1.6"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowU: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowD: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    chevU: '<path d="m6 15 6-6 6 6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    chevL: '<path d="m15 6-6 6 6 6"/>',
    play: '<path class="f" d="M7 4.5v15l12-7.5z"/>',
    playL: '<path class="f" d="M17 4.5v15L5 12z"/>',
    ffwd: '<path class="f" d="M3 5.5v13l8-6.5zM12 5.5v13l8-6.5z"/>',
    undo: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
    ban: '<circle class="f" cx="12" cy="12" r="9.5"/><path d="M5.3 5.3l13.4 13.4"/>',
    castle: '<path class="f" d="M4 20V8l2 1V6h2v3h2V6h2v3h2V6h2v3l2-1v12z"/><path d="M10 20v-5a2 2 0 0 1 4 0v5M3 20h18"/>',
    party: '<path class="f" d="M4 20 8.5 8l7.5 7.5z"/><path d="M14 4v2.5M19 9h2.5M17.5 5.5 19 4M13 11c2-1 4-1 6 1"/>',
    flag: '<path class="f" d="M5 4h11l-2 4 2 4H5z"/><path d="M5 21V4"/>',
    lock: '<rect class="f" x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2.5"/>',
    unlock: '<rect class="f" x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.6-1.8M12 15v2.5"/>',
    star: '<path class="f" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    sparkle: '<path class="f" d="M12 3c.9 5 4 8.1 9 9-5 .9-8.1 4-9 9-.9-5-4-8.1-9-9 5-.9 8.1-4 9-9z"/>',
    crown: '<path class="f" d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><path d="M5 19h14"/>',
    hourglass: '<path d="M6 3h12M6 21h12"/><path class="f" d="M7 3c0 5 5 6 5 9s-5 4-5 9h10c0-5-5-6-5-9s5-4 5-9z"/>',
    clock: '<circle class="f" cx="12" cy="12" r="9.5"/><path d="M12 7v5.2l3.2 2"/>',
    alarm: '<circle class="f" cx="12" cy="13" r="7.5"/><path d="M12 9v4.2l2.5 1.5M4 5l3-2M20 5l-3-2"/>',
    megaphone: '<path class="f" d="M4 10v4h3l8 4.5v-13L7 10z"/><path d="M18.5 9.5a4 4 0 0 1 0 5M7 14l1 5h2.5l-.8-4.5"/>',
    car: '<path class="f" d="M4 16v-3.5l2-5h12l2 5V16z"/><path d="M4 12.5h16M4 16v2h3v-2M17 16v2h3v-2"/><circle cx="8" cy="14.5" r=".6"/><circle cx="16" cy="14.5" r=".6"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle class="f" cx="17" cy="9" r="2.5"/><path d="M16.5 14.2c2.7.2 4.5 2.3 4.5 5.3"/>',
    person: '<circle class="f" cx="12" cy="7.5" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>',
    door: '<path class="f" d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><circle cx="15" cy="12.5" r=".6"/>',
    chat: '<path class="f" d="M4 5h16v11H11l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
    key: '<circle class="f" cx="8" cy="15" r="4"/><path d="M11 12 20 3M16 7l3 3M14 9l2 2"/>',
    gamepad: '<rect class="f" x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4"/><circle cx="15.5" cy="12" r=".7"/><circle cx="18" cy="14.5" r=".7"/>',
    gift: '<rect class="f" x="4" y="10" width="16" height="10" rx="1.5"/><path d="M3 10h18v3H3zM12 10v10M12 10c-3.5-5.5-7-2-4 0M12 10c3.5-5.5 7-2 4 0"/>',
    robot: '<rect class="f" x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M3 13v2M21 13v2M9.5 16.5h5"/><circle cx="9.5" cy="12.5" r="1"/><circle cx="14.5" cy="12.5" r="1"/>',
    siren: '<path class="f" d="M7 18v-5a5 5 0 0 1 10 0v5z"/><path d="M5 21h14M12 3v2M4 7l1.6 1.4M20 7l-1.6 1.4"/>',
    shield: '<path class="f" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    bell: '<path class="f" d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21.5h4"/>',
    bellOff: '<path d="M6.5 6.8A6 6 0 0 0 6 11v6l-1.5 2H17M18 14.5V11a6 6 0 0 0-8.5-5.4"/><path d="M10 21.5h4M3 3l18 18"/>',
    briefcase: '<rect class="f" x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18"/>',
    gear: '<circle class="f" cx="12" cy="12" r="6.3"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5"/>',
    wrench: '<path class="f" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    hammer: '<path class="f" d="M12.5 6.5 17.5 11.5 11 18 6 13z"/><path d="m14.5 4.5 5 5M7 17l-4 4"/>',
    pick: '<path d="M3 9c3.5-5 12-6 18-2-3.5-.5-5 .5-5 4M11 8.5 6 21"/>',
    cart: '<path class="f" d="m7 7 1.6 8h9l1.9-8z"/><path d="M3 4h2.4l1 3M8.6 15l-.7 2.5H18"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="16.5" cy="20" r="1.3"/>',
    bandage: '<rect class="f" x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M10 12h.01M14 12h.01M12 10.2v.01M12 13.8v.01"/>',
    hospital: '<rect class="f" x="4" y="5" width="16" height="16" rx="2"/><path d="M12 9v8M8 13h8M9 5V3h6v2"/>',
    trophy: '<path class="f" d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8.5 21h7M9 18h6"/>',
    medal: '<circle class="f" cx="12" cy="15" r="5.5"/><path d="M8 3l4 6.5L16 3M12 12.5v5"/>',
    handshake: '<path class="f" d="M2.5 12 7 7.5h4.5L14 10l2.5-2.5H21l1 4.5-4 .5-5 5.5-3.5-2.5L7 17z"/><path d="M13 14l-1.5 1.5"/>',
    shirt: '<path class="f" d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
    mail: '<rect class="f" x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    send: '<path d="M12 15V3M8 7l4-4 4 4M4 13v6.5h16V13"/>',
    inbox: '<path d="M12 3v12M8 11l4 4 4-4M4 14v5.5h16V14"/>',
    stadium: '<ellipse class="f" cx="12" cy="9" rx="8.5" ry="3.2"/><path d="M3.5 9v7c0 1.8 3.8 3.2 8.5 3.2s8.5-1.4 8.5-3.2V9M8 12.2v6.5M16 12.2v6.5M12 12.5v6.8"/>',
    store: '<path class="f" d="M4.5 10v10h15V10"/><path d="M3 4h18l1 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM10 20v-5h4v5"/>',
    pin: '<path class="f" d="M12 21.5s-6.5-5.7-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.8-6.5 11.5-6.5 11.5z"/><circle cx="12" cy="10" r="2.3"/>',
    backpack: '<path class="f" d="M7 21V10a5 5 0 0 1 10 0v11z"/><path d="M9.5 6V4h5v2M7 15h10M10 15v-2h4v2"/>',
    mask: '<path class="f" d="M3 8c3.5 2 14.5 2 18 0 0 7-3 11.5-9 11.5S3 15 3 8z"/><path d="m7 12 2.5.8M17 12l-2.5.8"/>',
    refresh: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4"/>',
    hand: '<path class="f" d="M7 13V6.5a1.5 1.5 0 0 1 3 0V11V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v7l1.2-1.4a1.5 1.5 0 0 1 2.3 1.9L17 18.5C16 20.3 14 21.5 12 21.5c-3.5 0-5-2.5-5-5.5z"/>',
    warning: '<path class="f" d="M12 3 2.5 20h19z"/><path d="M12 9.5v4.5M12 17.2v.1"/>',
    signal: '<circle class="f" cx="12" cy="10" r="2"/><path d="M12 12v9M8.5 21h7M7.6 5.6a6.4 6.4 0 0 0 0 8.8M16.4 5.6a6.4 6.4 0 0 1 0 8.8M4.8 3a10 10 0 0 0 0 14M19.2 3a10 10 0 0 1 0 14"/>',
    palm: '<path d="M12.5 21c0-5 .5-9 1.5-12"/><path class="f" d="M14 9c-1-3-5-4.5-9.5-2.5 3.2-.2 5.2.7 6.5 3zM14 9c1-3.2 5-4.4 8-2-3-.2-5 .8-6.2 2.8zM14 9c-2-1.5-2.5-4.5-.3-6.5.7 2.3.7 4.3.3 6.5z"/>',
    tree: '<path class="f" d="M12 3 5.5 13H9l-3 5h12l-3-5h3.5z"/><path d="M12 18v3"/>',
    target: '<circle cx="12" cy="12" r="9.5"/><circle class="f" cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.2"/>',
    bolt: '<path class="f" d="M13 2.5 4.5 14H11l-1 7.5L19.5 10H13z"/>',
    pen: '<path class="f" d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="m14 7 3 3"/>',
    phone: '<rect class="f" x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    heart: '<path class="f" d="M12 20.5s-8.5-5-8.5-11A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.5c0 6-8.5 11-8.5 11z"/>',
    flower: '<circle class="f" cx="12" cy="9" r="4.3"/><path d="M12 13.3V21M12 17.5c-3 0-4.2-1.8-4.2-3.2M12 18.5c3 0 4.2-1.8 4.2-3.2"/>',
    fire: '<path class="f" d="M12 3c1 4.2 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.3 2-4.2 0 1.6 1 2.6 2 2.6 0-4.2-1-6.2 1-9.4z"/>',
    ferris: '<circle cx="12" cy="10.5" r="7"/><circle class="f" cx="12" cy="10.5" r="1.6"/><path d="M12 3.5v14M5 10.5h14M7 5.5l10 10M17 5.5l-10 10M8 21l4-10.5L16 21"/>',
    blocks: '<rect class="f" x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M9 14.3V19"/>',
    bulb: '<path class="f" d="M9 17v-2a6 6 0 1 1 6 0v2z"/><path d="M10 20h4M10.5 22.2h3"/>',
    clipboard: '<rect class="f" x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    swim: '<path d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><circle class="f" cx="16" cy="6" r="2.2"/>',
    trash: '<path class="f" d="M5 7h14l-1.2 14H6.2z"/><path d="M3 7h18M9 7V4h6v3M10 11v6M14 11v6"/>',
    speaker: '<path class="f" d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mute: '<path class="f" d="M4 9v6h4l5 4V5L8 9z"/><path d="m16.5 9.5 4.5 5M21 9.5l-4.5 5"/>',
    eye: '<path class="f" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle class="f" cx="6.5" cy="18" r="2.5"/><circle class="f" cx="17.5" cy="16" r="2.5"/>',
    chart: '<path d="M4 20V4M4 20h16"/><rect class="f" x="7" y="12" width="3" height="8"/><rect class="f" x="12" y="7" width="3" height="13"/><rect class="f" x="17" y="14" width="3" height="6"/>',
    tag: '<path class="f" d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    moon: '<path class="f" d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    sun: '<circle class="f" cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    tower: '<path class="f" d="M10 21 11.4 7h1.2L14 21z"/><path d="M12 2v3M8 21h8M9.5 12.5h5M10.4 8.5h3.2"/>',
    bed: '<path d="M3 19V6M3 15.5h18V19M21 15.5v-3a3 3 0 0 0-3-3h-7v6"/><circle class="f" cx="7" cy="11.5" r="2"/>',
    swords: '<path d="M4 4l9 9M20 4l-9 9M5 20l4-4M19 20l-4-4M3 17l4 4M21 17l-4 4"/>',
    dice: '<rect class="f" x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r=".7"/><circle cx="15" cy="15" r=".7"/><circle cx="12" cy="12" r=".7"/>',
    dance: '<circle class="f" cx="12" cy="5" r="2.2"/><path d="m5 5 4 5h6l4-5M12 10v6l-3 5M12 16l3 5"/>',
    city: '<path class="f" d="M4 21V9h6v12M14 21V4h6v17"/><path d="M2 21h20M7 12h.01M7 15.5h.01M17 8h.01M17 12h.01M17 16h.01"/>',
    diamond: '<path class="f" d="M6 4h12l3 5-9 12L3 9z"/><path d="M3 9h18M9 4 8 9l4 12 4-12-1-5"/>',
    info: '<circle class="f" cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.6v.1"/>',
    help: '<circle class="f" cx="12" cy="12" r="9.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 17v.1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    calendar: '<rect class="f" x="4" y="5" width="16" height="16" rx="2.5"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    box: '<path class="f" d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    compass: '<circle cx="12" cy="12" r="9.5"/><path class="f" d="m15.5 8.5-2 5-5 2 2-5z"/>',
    skull: '<path class="f" d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6v4h9v-4c2-1 3.5-3 3.5-6a8 8 0 0 0-8-8z"/><circle cx="9" cy="11.5" r="1.4"/><circle cx="15" cy="11.5" r="1.4"/><path d="M10.5 21v-2.5M13.5 21v-2.5"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
    tent: '<path class="f" d="M3 20 12 4l9 16z"/><path d="M12 4v16M9 20l3-5 3 5"/>',
    ticket: '<path class="f" d="M3 8a2 2 0 0 0 0 8v2h18v-2a2 2 0 0 1 0-8V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2"/>'
  };
  // إيموجي → [اسم الأيقونة، لون اختياري]
  var MAP = {};
  function m(names, icon, tint) { names.split(' ').filter(Boolean).forEach(function (e) { MAP[e] = [icon, tint || '']; }); }
  m('✅', 'check', 'green'); m('✔ ✓', 'tick', 'green'); m('☑', 'checksq', 'green'); m('❌', 'cross', 'red'); m('✖ ✕', 'x'); m('➕', 'plus'); m('➖', 'minus');
  m('⬜ ▫', 'sq'); m('● ⚫', 'dot'); m('🟢', 'dot', 'green'); m('🔴', 'dot', 'red'); m('🟡', 'dot', 'amber'); m('⚪', 'dot', 'gray'); m('⭕', 'ring', 'blue');
  m('🏠 🏡', 'home'); m('🪙 💰', 'coin', 'gold');
  m('←  ⬅ ◀', 'arrowL'); m('→ ➡ ➜', 'arrowR'); m('⬆ ↑', 'arrowU'); m('⬇ ↓', 'arrowD'); m('▴', 'chevU'); m('▾', 'chevD'); m('▶', 'play'); m('⏩', 'ffwd'); m('↩', 'undo');
  m('🚫 ⛔ 🛑', 'ban', 'red'); m('🏰', 'castle'); m('🎉 🎊', 'party', 'pink'); m('🏁 🚩 🏳', 'flag'); m('🔒 🔐', 'lock'); m('🔓', 'unlock');
  m('⭐ 🌟 ★', 'star', 'gold'); m('✦ ✨', 'sparkle', 'gold'); m('👑', 'crown', 'gold'); m('⏳ ⌛', 'hourglass'); m('⏱ 🕒 🕐', 'clock'); m('⏰', 'alarm');
  m('📢', 'megaphone'); m('🚗 🏎', 'car'); m('👥', 'users'); m('🚶 🧍 👤', 'person'); m('🚪', 'door'); m('💬', 'chat'); m('🔑 🗝', 'key', 'gold');
  m('🎮', 'gamepad'); m('🎁', 'gift', 'pink'); m('🤖', 'robot'); m('🚔 🚨', 'siren', 'red'); m('👮 🛡', 'shield', 'blue'); m('🔔', 'bell'); m('🔕', 'bellOff');
  m('💼', 'briefcase'); m('⚙', 'gear'); m('🔧 🛠', 'wrench'); m('🔨', 'hammer'); m('⛏', 'pick'); m('🛒 🛍', 'cart'); m('🤕', 'bandage'); m('🏥 🩺', 'hospital');
  m('🏆', 'trophy', 'gold'); m('🏅', 'medal', 'gold'); m('🥇', 'medal', 'gold'); m('🥈', 'medal', 'silver'); m('🥉', 'medal', 'bronze'); m('🤝', 'handshake');
  m('👕 👔', 'shirt'); m('📨', 'mail'); m('📤', 'send'); m('📥', 'inbox'); m('🏟', 'stadium'); m('🏬 🏪', 'store'); m('📍', 'pin', 'red'); m('🎒', 'backpack');
  m('🦹', 'mask'); m('🔄 🔁', 'refresh'); m('👋 ✋ ✊', 'hand'); m('⚠', 'warning', 'amber'); m('📡', 'signal'); m('🌴', 'palm', 'green'); m('🌲', 'tree', 'green');
  m('🎯', 'target', 'red'); m('⚡', 'bolt', 'gold'); m('✍ ✏ 📝', 'pen'); m('📲', 'phone'); m('❤ 🤍 💛', 'heart', 'red'); m('🌹 🌷', 'flower', 'pink'); m('🔥', 'fire', 'orange');
  m('🎡 🎠 🎢 🎪', 'ferris'); m('🧱', 'blocks'); m('💡', 'bulb', 'gold'); m('📋 📜 🧾', 'clipboard'); m('🏊', 'swim'); m('🗑', 'trash'); m('🔊', 'speaker'); m('🔇', 'mute');
  m('👀', 'eye'); m('🎵', 'music'); m('📊 📈', 'chart'); m('🏷', 'tag'); m('🌙', 'moon'); m('☀', 'sun', 'gold'); m('🗼', 'tower'); m('🛏', 'bed'); m('⚔', 'swords'); m('🎲', 'dice');
  m('🕺 💃', 'dance'); m('🏙', 'city'); m('💎', 'diamond', 'cyan'); m('ℹ', 'info'); m('❓', 'help'); m('☰', 'menu'); m('🔗', 'link'); m('📅', 'calendar'); m('📦', 'box');
  m('🧭', 'compass'); m('💀 ☠', 'skull'); m('🔢', 'hash'); m('🎟', 'ticket'); m('⛺', 'tent');

  var css = '.ic{width:1.18em;height:1.18em;vertical-align:-.24em;display:inline-block;flex:none;margin:0 .06em;overflow:visible}' +
    '.ic[data-t=gold]{color:#f2a900}.ic[data-t=red]{color:#e5484d}.ic[data-t=green]{color:#1fa35c}.ic[data-t=blue]{color:#2f80ed}.ic[data-t=amber]{color:#f59e0b}' +
    '.ic[data-t=pink]{color:#e84a8b}.ic[data-t=orange]{color:#ff7414}.ic[data-t=cyan]{color:#12b5d6}.ic[data-t=gray]{color:#aab4bf}.ic[data-t=silver]{color:#8f9aa6}.ic[data-t=bronze]{color:#b9772f}' +
    '[style*="#ff7414"] .ic,[style*="background:#"] .ic[data-t],button:disabled .ic{color:inherit}';

  var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; }).map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\uFE0F?'; });
  var RX = new RegExp(keys.join('|'), 'g'), RXT = new RegExp(keys.join('|'));
  var SKIP = 'textarea,input,option,select,script,style,svg,[data-noicon]';

  function sprite() {
    if (document.getElementById('icsprite')) return;
    var s = '<svg id="icsprite" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>';
    for (var k in ICONS) s += '<symbol id="ic-' + k + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[k].replace(/class="f"/g, 'fill="currentColor" fill-opacity=".18"') + '</symbol>';
    var d = document.createElement('div'); d.innerHTML = s + '</defs></svg>';
    document.body.insertBefore(d.firstChild, document.body.firstChild);
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }
  function make(em) {
    var info = MAP[em.replace(/\uFE0F/g, '')];
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ic'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('data-i', info[0]); if (info[1]) svg.setAttribute('data-t', info[1]);
    var ds = document.createElementNS(NS, 'desc'); ds.textContent = em; svg.appendChild(ds);   // الإيموجي الأصلي يبقى بنص العنصر
    var u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#ic-' + info[0]); svg.appendChild(u);
    return svg;
  }
  function textNode(n) {
    var s = n.nodeValue, p = n.parentNode;
    if (!s || !p || !RXT.test(s) || (p.closest && p.closest(SKIP))) return;
    var f = document.createDocumentFragment(), last = 0, mt;
    RX.lastIndex = 0;
    while ((mt = RX.exec(s))) { if (mt.index > last) f.appendChild(document.createTextNode(s.slice(last, mt.index))); f.appendChild(make(mt[0])); last = mt.index + mt[0].length; }
    if (last < s.length) f.appendChild(document.createTextNode(s.slice(last)));
    p.replaceChild(f, n);
  }
  function walk(root) {
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1 || (root.closest && root.closest(SKIP))) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(textNode);
  }
  function start() {
    sprite(); walk(document.body);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var r = ms[i];
        if (r.type === 'characterData') textNode(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  window.ICONS = { names: Object.keys(ICONS), map: MAP, walk: walk };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
