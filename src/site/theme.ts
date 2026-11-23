// Buttons follow the 9th-pass block at the end of THEME_CSS.
// The site's look (7th pass, Nov 2026; recolored to maroon and orange): clean and polished. White background, soft rounded surfaces, real buttons
// with icons, each term tinted by season (fall amber, spring green, summer blue), a product-style home page.
// Appended after CSS in render.ts, so it wins the cascade. Light is the default; <html data-theme="dark"> switches.
// 8th pass (reference: archetypeid.com, but light): cream page, a dot grid that fades out from the top,
// a floating rounded nav bar, medium-weight headlines with one accent phrase, numbered section labels.
// Fonts are self-hosted from assets/fonts: Urbanist (headings), Schibsted Grotesk (text),
// Martian Mono (only inside the small course-code chips).

/** Runs in <head> before the page paints, so a saved theme never flashes the other one first. */
export const THEME_JS = `(()=>{try{const t=localStorage.getItem('gobblerplan:theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}})();`;

// Button icons, as CSS masks so they take the button's text color. 24x24 stroke icons drawn for this site.
const icon = (path: string) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E${path}%3C/svg%3E")`;
const ICONS: Record<string, string> = {
  undo: "%3Cpath d='M4 9h10a6 6 0 0 1 0 12h-4'/%3E%3Cpath d='M8 5 4 9l4 4'/%3E",
  balance: "%3Cpath d='M5 20V10M12 20V4M19 20v-7'/%3E",
  share: "%3Cpath d='M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1'/%3E%3Cpath d='M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1'/%3E",
  print: "%3Cpath d='M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2'/%3E%3Cpath d='M7 14h10v6H7z'/%3E",
  copy: "%3Crect x='9' y='9' width='11' height='11' rx='2'/%3E%3Cpath d='M5 15V6a2 2 0 0 1 2-2h9'/%3E",
  reset: "%3Cpath d='M4 12a8 8 0 1 0 3-6.2'/%3E%3Cpath d='M4 4v5h5'/%3E",
};

export const THEME_CSS = `
@font-face{font-family:"Urbanist";src:url(fonts/urbanist.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Schibsted Grotesk";src:url(fonts/schibsted-grotesk.woff2) format("woff2");font-weight:400 900;font-display:swap}
@font-face{font-family:"Martian Mono";src:url(fonts/martian-mono.woff2) format("woff2");font-weight:100 800;font-display:swap}
:root{--display:"Urbanist","Trebuchet MS",sans-serif;--font:"Schibsted Grotesk","Trebuchet MS",sans-serif;--mono:"Martian Mono",ui-monospace,Menlo,monospace;
--paper:#f6f0e4;--bg2:#f1ead9;--sheet:#fffdf7;--soft:#ece3d1;--lift:#fffdf7;--ink:#1f1814;--mut:#74685d;--rule:#e2d7c2;--dot:rgba(74,52,36,.36);--acc:#861f41;--acc-d:#6a1733;--acc-soft:#f3e1df;--acc2:#e5751f;--onacc:#fff;
--ok:#5f7a2a;--bad:#b3261e;--amber:#a8530f;--warn:#fbecd9;--band:#f6dbe3;
--fall:#fbecd9;--fall-b:#efcfa6;--fall-t:#a8530f;--spring:#f6e3e3;--spring-b:#e6bfc4;--spring-t:#861f41;--summer:#efe7d4;--summer-b:#dccfb2;--summer-t:#6b5a3c;
--ga:#5a1029;--gb:#861f41;--gc:#d391a6;--gd:#f1d5dd;--gf:#e3b08f;--gw:#d2c7b4;
--sh1:0 1px 2px rgba(19,26,46,.06),0 1px 3px rgba(19,26,46,.05);--sh2:0 6px 16px rgba(19,26,46,.08),0 2px 4px rgba(19,26,46,.05);--shadow:0 18px 50px rgba(19,26,46,.18);color-scheme:light}
/* dark keeps the same structure on a warm near-black */
:root[data-theme=dark]{--dot:rgba(255,236,214,.16);--paper:#17120f;--bg2:#1d1713;--sheet:#231c17;--soft:#2e251e;--lift:#281f19;--ink:#f3ebe0;--mut:#b0a394;--rule:#3a2f26;--acc:#f08a3c;--acc-d:#ffa25c;--acc-soft:#3a2416;--acc2:#d9668a;--onacc:#0f131c;
--ok:#a9c36a;--bad:#ff8a78;--amber:#f0a35c;--warn:#2e2114;--band:#4a2c18;
--fall:#2e2114;--fall-b:#5e4122;--fall-t:#f0a35c;--spring:#2e191d;--spring-b:#5c2c38;--spring-t:#e58aa3;--summer:#27221a;--summer-b:#4a4130;--summer-t:#cdbb97;
--ga:#ffd2b0;--gb:#f08a3c;--gc:#a85a26;--gd:#5c3318;--gf:#a8674a;--gw:#4b5468;
--sh1:0 1px 2px rgba(0,0,0,.4);--sh2:0 6px 16px rgba(0,0,0,.4);--shadow:0 18px 50px rgba(0,0,0,.6);color-scheme:dark}
html{background:var(--paper)}body{font-family:var(--font);background:var(--paper);background-image:none;color:var(--ink);font-size:15.5px;line-height:1.55;letter-spacing:0}
h1,h2,h3,.lede,.term h3,.cols h3,.paths b,.brand,.hero h1{font-family:var(--display);letter-spacing:-.015em}
h1{font-size:2rem;font-weight:750;line-height:1.1;margin:0 0 .3em}h2{font-family:var(--display);font-size:1.25rem;font-weight:700;text-transform:none;letter-spacing:-.01em;color:var(--ink);border-top:0;margin:2.2em 0 .6em;padding:0}h2:before{content:none}
a{color:var(--acc);text-decoration:none}a:hover{color:var(--acc-d);text-decoration:underline}.sub{color:var(--mut);margin:0 0 1em}
kbd{font-family:var(--font);font-size:.72rem;font-weight:600;border:1px solid var(--rule);border-radius:6px;padding:1px 6px;color:var(--mut);background:var(--sheet)}
::selection{background:var(--acc);color:#fff}:focus-visible{outline:2px solid var(--acc);outline-offset:2px;border-radius:8px}

/* top bar */
.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:6px;height:64px;padding:0 24px;background:color-mix(in srgb,var(--paper) 92%,transparent);backdrop-filter:saturate(1.4) blur(10px);-webkit-backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid var(--rule)}
.top .brand{display:flex;align-items:center;gap:10px;font-family:var(--display);font-weight:750;font-size:1.2rem;color:var(--ink);text-decoration:none;margin-right:26px;white-space:nowrap}
.logo{display:block;width:32px;height:32px;border-radius:0;background:none;box-shadow:none}
.top .nav{display:flex;flex-direction:row;gap:4px;height:auto}.top .nav a{display:flex;align-items:center;padding:8px 14px;border:0;border-radius:999px;font-family:var(--font);font-size:.92rem;font-weight:550;text-transform:none;letter-spacing:0;color:var(--mut);text-decoration:none}
.top .nav a:hover{color:var(--ink);background:var(--soft)}.top .nav a[aria-current]{color:var(--acc);background:var(--acc-soft);font-weight:650}.top .nav a[aria-current]:after{content:none}
.grow{flex:1}.top .find{width:240px;display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-radius:999px;border:1px solid var(--rule);background:var(--bg2);color:var(--mut);font-family:var(--font);font-size:.9rem;text-transform:none;letter-spacing:0;cursor:pointer;transition:border-color .15s,box-shadow .15s}.top .find:hover{border-color:var(--acc);box-shadow:0 0 0 4px var(--acc-soft);color:var(--ink)}
.icon{font:inherit;width:40px;height:40px;border-radius:999px;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);cursor:pointer;margin-left:8px;transition:background .15s,border-color .15s}.icon:hover{background:var(--soft);border-color:var(--rule);color:var(--ink)}
main{max-width:1160px;margin:0 auto;padding:40px 24px 90px}main.wide{max-width:none;padding:0}
footer{font-family:var(--font);color:var(--mut);font-size:.82rem;line-height:1.6;border-top:1px solid var(--rule);margin-top:64px;padding-top:20px;max-width:none}main.wide footer{margin:30px 28px 0;padding-bottom:30px}footer a{color:var(--mut);text-decoration:underline}
.crumb{display:none}
#pal{background:var(--sheet);color:var(--ink);border:1px solid var(--rule);border-radius:18px;box-shadow:var(--shadow)}#pal::backdrop{background:rgba(15,19,28,.45);backdrop-filter:blur(3px)}#pal input{font-family:var(--font);color:var(--ink)}#pal a{color:var(--ink);text-decoration:none;border-radius:10px}#pal .grp,#pal .hint{font-family:var(--font);font-size:.74rem;font-weight:650;text-transform:none;letter-spacing:0;color:var(--mut)}

/* buttons and inputs */
.btn,.sel{font-family:var(--font);font-size:.9rem;font-weight:600;text-transform:none;letter-spacing:0;background:var(--sheet);border:1px solid var(--rule);border-radius:12px;color:var(--ink);padding:9px 14px;cursor:pointer;box-shadow:var(--sh1);transition:transform .12s,box-shadow .15s,border-color .15s,background .15s}
.sel{font-weight:500;box-shadow:none}.sel:focus{border-color:var(--acc);box-shadow:0 0 0 4px var(--acc-soft);outline:0}.sel option{color:var(--ink);background:var(--sheet)}
.btn:hover{background:var(--sheet);color:var(--ink);border-color:var(--acc);box-shadow:var(--sh2);transform:translateY(-1px)}.btn:active{transform:translateY(0);box-shadow:var(--sh1)}.btn:disabled{opacity:.45;cursor:default;box-shadow:none}.btn:disabled:hover{transform:none;border-color:var(--rule)}
.btn.pri{background:linear-gradient(180deg,var(--acc),var(--acc-d));border-color:var(--acc-d);color:#fff;box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 4px 12px color-mix(in srgb,var(--acc) 35%,transparent)}.btn.pri:hover{background:linear-gradient(180deg,var(--acc),var(--acc-d));color:#fff;filter:brightness(1.06);border-color:var(--acc-d)}
a.btn{display:inline-flex;align-items:center;gap:8px;text-decoration:none}a.btn.big,.btn.big{padding:13px 22px;font-size:1rem;border-radius:14px}
.seg{display:inline-flex;background:var(--soft);border:0;border-radius:12px;padding:4px;gap:2px}.seg button{font-family:var(--font);font-size:.86rem;font-weight:600;letter-spacing:0;border:0;border-radius:9px;padding:7px 11px;color:var(--mut);background:none;cursor:pointer;transition:background .15s,color .15s}.seg button:last-child{border-right:0}.seg button:hover{background:none;color:var(--ink)}.seg button[aria-pressed=true]{background:var(--sheet);color:var(--acc);box-shadow:var(--sh1);font-weight:700}
.note{background:var(--bg2);border:1px solid var(--rule);border-radius:14px;padding:13px 16px;font-size:.92rem}.note.warn{background:var(--warn);border:1px solid color-mix(in srgb,var(--amber) 30%,transparent)}
.tag{display:inline-block;border:0;border-radius:999px;font-family:var(--font);font-size:.68rem;font-weight:700;text-transform:none;letter-spacing:0;padding:2px 8px;background:var(--soft);color:var(--mut);margin:0}.tag.hot{color:var(--amber);background:var(--warn)}
.flag{color:var(--bad);font-weight:600}.mut{color:var(--mut)}.lnk{font:inherit;color:var(--acc);background:none;border:0;padding:0;cursor:pointer;text-decoration:none}.lnk:hover{color:var(--acc-d);text-decoration:underline}
.chips{gap:8px}.chips a,.chips button{font-family:var(--font);font-size:.88rem;font-weight:500;background:var(--sheet);border:1px solid var(--rule);border-radius:999px;padding:7px 14px;color:var(--ink);cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,color .15s}.chips a:hover,.chips button:hover{background:var(--acc-soft);border-color:var(--acc);color:var(--acc)}
.lede,.ans{border-left:0;background:var(--acc-soft);color:var(--ink);padding:20px 22px;font-family:var(--display);font-size:1.25rem;font-weight:700;line-height:1.3;border-radius:18px;box-shadow:none}.lede small{display:block;font-family:var(--font);font-weight:400;font-size:.92rem;color:var(--mut);margin-top:6px}.ans p{margin:.5em 0;font-family:var(--font);font-size:.98rem;font-weight:400}.ans p:first-child{font-family:var(--display);font-size:1.2rem;font-weight:700}

/* home */
.hero{padding:28px 0 20px}.hero.split{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:48px;align-items:center}.hero h1{font-size:clamp(2.6rem,5.4vw,4.2rem);font-weight:800;line-height:1.02;max-width:none;letter-spacing:-.03em}.hero h1 em{font-style:normal;color:var(--acc);background:none;padding:0}.hero p{font-size:1.12rem;color:var(--mut);max-width:48ch;margin:1em 0 0}
.hero .facts{display:flex;border:0;grid-template-columns:none}.hero .facts>div{border:0;padding:0;margin:0}.side .hint{border:0;padding:0;text-align:left}.cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}.facts{display:flex;gap:26px;flex-wrap:wrap;margin-top:30px;color:var(--mut);font-size:.88rem}.facts b{display:block;font-family:var(--display);font-size:1.6rem;font-weight:800;color:var(--ink);line-height:1.1}
.mock{position:relative;background:var(--sheet);border:1px solid var(--rule);border-radius:22px;box-shadow:var(--shadow);padding:16px;transform:rotate(1.2deg)}.mock:before{content:"";position:absolute;inset:-28px -18px -22px 30px;border-radius:32px;background:linear-gradient(135deg,var(--acc-soft),#fdebd9);z-index:-1;transform:rotate(-3deg)}
.mock .mt{display:flex;gap:6px;margin-bottom:12px}.mock .mt i{width:10px;height:10px;border-radius:50%;background:var(--rule)}.mock .mg{display:grid;grid-template-columns:1fr 1fr;gap:12px}.mock .mc{border-radius:14px;padding:10px;border:1px solid}.mock .mc b{display:block;font-size:.8rem;font-weight:700;margin-bottom:8px}
.mock .mi{display:flex;align-items:center;gap:8px;background:var(--sheet);border-radius:9px;padding:8px 9px;margin-top:6px;font-size:.76rem;color:var(--mut);box-shadow:var(--sh1);border-left:4px solid var(--c)}.mock .mi u{text-decoration:none;font-family:var(--mono);font-size:.62rem;font-weight:700;color:var(--ink)}.mock .mp{display:flex;align-items:center;gap:10px;margin-top:14px;font-size:.76rem;color:var(--mut)}.mock .mp i{flex:1;height:8px;border-radius:99px;background:var(--soft);overflow:hidden;display:block}.mock .mp i:after{content:"";display:block;width:38%;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--acc),var(--acc2))}
.paths{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;border-top:0;margin-top:44px}.paths a,.paths a+a{display:block;border:1px solid var(--rule);border-radius:18px;background:var(--sheet);padding:20px 22px;color:var(--ink);text-decoration:none;box-shadow:var(--sh1);transition:transform .15s,box-shadow .15s,border-color .15s}.paths a:hover{transform:translateY(-3px);box-shadow:var(--sh2);border-color:var(--acc);color:var(--ink)}.paths b{display:block;font-size:1.15rem;font-weight:700;margin-bottom:4px}.paths span{color:var(--mut);font-size:.9rem}
.filter{display:block;width:100%;max-width:560px;padding:14px 18px;font-size:1.02rem;margin:10px 0;border-radius:14px;border-color:var(--rule);background:var(--bg2)}
.col{font-family:var(--display);font-size:1.2rem;font-weight:750;color:var(--ink);text-transform:none;letter-spacing:-.01em;margin:2.2em 0 .7em;padding:0;border:0;display:flex;gap:10px;align-items:center;justify-content:flex-start}.col .mut{font-family:var(--font);font-weight:700;font-size:.74rem;letter-spacing:0;background:var(--acc-soft);color:var(--acc);border-radius:999px;padding:2px 9px}
.majors{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;border-top:0}.majors a,.majors button{display:flex;gap:10px;align-items:center;justify-content:space-between;border:1px solid var(--rule);border-radius:14px;background:var(--sheet);padding:13px 15px;color:var(--ink);font:inherit;text-align:left;cursor:pointer;text-decoration:none;transition:transform .12s,box-shadow .15s,border-color .15s}
.majors b{display:block;flex:1;min-width:0;font-weight:600;font-size:.92rem}.majors b:after{content:none}.majors span{font-family:var(--font);color:var(--mut);font-size:.78rem;letter-spacing:0;white-space:nowrap}
.majors a:hover,.majors button:hover{color:var(--ink);background:var(--sheet);border-color:var(--acc);box-shadow:var(--sh2);transform:translateY(-2px)}.majors a:hover span,.majors button:hover span{color:var(--acc)}.majors [aria-current]{border-color:var(--acc);background:var(--acc-soft)}.majors .tag{color:var(--amber);background:var(--warn);margin-right:6px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:22px}.cols section{border:1px solid var(--rule);border-radius:18px;background:var(--sheet);color:var(--ink);padding:16px 18px;margin:0;box-shadow:var(--sh1)}.cols h3{font-size:1.05rem;font-weight:700;margin:0}.cols .mut{color:var(--mut)}.cols ul{list-style:none;margin:8px 0 0;padding:0;font-size:.9rem}.cols li{border-top:1px solid var(--rule);padding:7px 0}
.ctl{gap:12px;margin:12px 0}.ctl label{font-family:var(--font);font-size:.8rem;font-weight:600;text-transform:none;letter-spacing:0;color:var(--mut)}
.askf{display:flex;gap:10px;max-width:720px;margin:22px 0 14px}.askf .sel{flex:1;padding:14px 18px;font-size:1.02rem;cursor:text;border-color:var(--rule);border-right:1px solid var(--rule);border-radius:14px;background:var(--bg2)}.askf .btn{background:linear-gradient(180deg,var(--acc),var(--acc-d));border-color:var(--acc-d);color:#fff;font-weight:700;padding:0 26px;border-radius:14px}
.meter{background:var(--soft);border:0;border-radius:99px;height:10px;overflow:hidden}.meter i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2));border-radius:99px;transition:width .6s cubic-bezier(.2,.7,.2,1)}
.help{margin:26px 0 0;font-size:.9rem;color:var(--mut);border:0;padding:0;background:none}.help summary{cursor:pointer;font-family:var(--font);font-size:.9rem;font-weight:600;text-transform:none;letter-spacing:0;color:var(--acc)}.help ul{margin:.6em 0 0;padding-left:1.2em}

/* planner: sidebar + stage */
.app{display:grid;grid-template-columns:320px minmax(0,1fr);min-height:calc(100vh - 64px);background:var(--bg2)}
.side{background:var(--sheet);border-right:1px solid var(--rule);padding:24px 20px;position:sticky;top:64px;align-self:start;height:calc(100vh - 64px);overflow:auto}
.side h1{font-size:1.5rem;margin:0 0 4px}.side .sub{font-family:var(--font);font-size:.84rem;line-height:1.5;letter-spacing:0;margin:0 0 18px}
.side h4{font-family:var(--font);font-size:.74rem;text-transform:none;letter-spacing:0;color:var(--mut);margin:22px 0 8px;font-weight:650}
.side .seg{display:flex}.side .seg button{flex:1;padding:8px 0}
.acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;border:0}.acts .btn{display:flex;align-items:center;justify-content:center;gap:7px;text-align:center;padding:10px 6px;border:1px solid var(--rule);font-size:.84rem}.acts .btn:nth-child(2n),.acts .btn:nth-last-child(-n+2){border:1px solid var(--rule)}.acts .btn:hover{border-color:var(--acc)}
.acts .btn:before{content:"";width:16px;height:16px;flex:none;background:currentColor;-webkit-mask:var(--ic) center/contain no-repeat;mask:var(--ic) center/contain no-repeat;opacity:.75}
#undo{--ic:${icon(ICONS.undo!)}}#balance{--ic:${icon(ICONS.balance!)}}#share{--ic:${icon(ICONS.share!)}}#print{--ic:${icon(ICONS.print!)}}#copy{--ic:${icon(ICONS.copy!)}}#reset{--ic:${icon(ICONS.reset!)}}
#share{background:linear-gradient(180deg,var(--acc),var(--acc-d));border-color:var(--acc-d);color:#fff}#share:before{opacity:1}
.prog{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--font);font-size:.84rem;letter-spacing:0;color:var(--mut);margin-bottom:8px}.prog b{font-family:var(--display);font-size:1.6rem;font-weight:800;color:var(--acc)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);border:0;border-radius:0;margin-top:14px;gap:8px}.stat{padding:10px 8px;text-align:left;border:0;border-radius:12px;background:var(--bg2);min-width:0}.stat:last-child{border-right:0}.stat b{display:block;font-family:var(--display);font-size:1.25rem;font-weight:800;line-height:1.1}.stat span{font-family:var(--font);font-size:.68rem;text-transform:none;letter-spacing:0;color:var(--mut)}.stat.bad{background:color-mix(in srgb,var(--bad) 12%,var(--sheet))}.stat.bad b{color:var(--bad)}.stat.good b{color:var(--ok)}
.side #conf{display:block;font-size:.9rem;margin:0}.side .hint{font-size:.86rem;color:var(--mut);margin:12px 0 0;line-height:1.7}.over{display:none}
.stage{padding:26px 28px 40px;min-width:0}.stage .note{margin:0 0 16px;background:var(--sheet)}.stage .note.warn{background:var(--warn)}

/* board: a year per row, terms as tinted columns */
.board{position:relative;display:block;overflow:visible;padding:0;gap:0}
.board>svg{position:absolute;left:0;top:0;pointer-events:none;z-index:3}.board path{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:1400;stroke-dashoffset:1400;animation:ink .5s ease forwards}.board .lp{stroke:var(--acc)}.board .ln{stroke:var(--acc2);stroke-width:2.5}
@keyframes ink{to{stroke-dashoffset:0}}
.year{position:relative;background:none;border:0;border-radius:0;margin-bottom:26px;padding:0}.year:before,.year:after{content:none}
.year>h2{font-family:var(--display);font-size:1.15rem;font-weight:750;text-transform:none;letter-spacing:-.01em;color:var(--ink);margin:0 0 12px;text-align:left}
.yrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
.term{flex:none;border:1px solid var(--tb,var(--rule));border-radius:18px;background:var(--tbg,var(--sheet));padding:14px 12px 12px;scroll-margin-top:84px;min-width:0;transition:box-shadow .15s}
.term.fall{--tbg:var(--fall);--tb:var(--fall-b);--tt:var(--fall-t)}.term.spring{--tbg:var(--spring);--tb:var(--spring-b);--tt:var(--spring-t)}.term.summer{--tbg:var(--summer);--tb:var(--summer-b);--tt:var(--summer-t)}
.term h3{display:inline;font-family:var(--display);font-size:1.02rem;font-weight:750;margin:0 0 0 4px;color:var(--tt,var(--ink))}.term>.mut{display:inline;float:right;font-family:var(--font);font-size:.76rem;font-weight:650;letter-spacing:0;text-transform:none;margin:2px 4px 0 0;color:var(--tt,var(--mut));opacity:.85}.term .load{display:none}
.term>.flag{clear:both;font-family:var(--font);font-size:.74rem;text-transform:none;letter-spacing:0;color:var(--amber);margin:6px 4px 0;font-weight:650}
.term.drop{box-shadow:0 0 0 3px var(--acc);outline:0;background:var(--tbg,var(--sheet))}
.it{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:start;clear:both;border:0;border-left:0;border-radius:12px;background:var(--sheet);color:var(--ink);padding:10px 10px 10px 14px;margin-top:8px;cursor:pointer;box-shadow:var(--sh1);transition:transform .12s ease,box-shadow .15s ease,opacity .15s}
.it:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:0 4px 4px 0;background:var(--c,#aab3c8)}
.it:hover{transform:translateY(-2px);box-shadow:var(--sh2);background:var(--sheet)}
.it .nm{font-size:.86rem;line-height:1.35;color:var(--mut)}.it .nm a{display:inline-block;font-family:var(--mono);font-weight:700;font-size:.66rem;letter-spacing:0;color:var(--c,var(--ink));background:color-mix(in srgb,var(--c,#aab3c8) 13%,transparent);border-radius:6px;padding:2px 6px;margin-right:4px;text-decoration:none}.it .nm a:hover{text-decoration:none;background:color-mix(in srgb,var(--c,#aab3c8) 24%,transparent)}
.it .mut{font-family:var(--font);font-size:.72rem;letter-spacing:0;text-transform:none;color:var(--mut);margin-top:3px}.it .flag{font-size:.74rem;margin-top:4px;color:var(--bad)}.it .lnk{font-size:.72rem;color:var(--acc);text-decoration:none}
.it input{appearance:none;-webkit-appearance:none;width:18px;height:18px;margin:1px 0 0;border:2px solid var(--rule);border-radius:6px;background:var(--sheet);cursor:pointer;display:grid;place-items:center;transition:background .15s,border-color .15s}.it input:hover{border-color:var(--ok)}.it input:checked{background:var(--ok);border-color:var(--ok)}.it input:checked:after{content:"";width:9px;height:5px;border:2px solid #fff;border-top:0;border-right:0;transform:rotate(-45deg) translateY(-1px)}
.it.done{opacity:.62;background:var(--sheet)}.it.done .nm{text-decoration:line-through;color:var(--mut)}
.mv{display:flex;opacity:0;gap:3px;transition:opacity .12s}.it:hover .mv,.it:focus-within .mv,.it.sel .mv{opacity:1}.mv button{font:inherit;width:24px;height:24px;border-radius:8px;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);font-size:.7rem;cursor:pointer;padding:0}.mv button:hover{background:var(--acc);border-color:var(--acc);color:#fff}.mv button:disabled{opacity:.25}
.it.sel{outline:0;box-shadow:0 0 0 2px var(--acc),var(--sh2);transform:translateY(-2px)}.it.pre{outline:0;box-shadow:0 0 0 2px var(--acc)}.it.post{outline:0;box-shadow:0 0 0 2px var(--acc2)}.it.dim{opacity:.35}
.it.conflict{background:color-mix(in srgb,var(--bad) 8%,var(--sheet));box-shadow:0 0 0 1.5px var(--bad)}
.addc{display:block;width:100%;text-align:center;border:1.5px dashed var(--tb,var(--rule));border-radius:12px;padding:8px;margin-top:8px;color:var(--tt,var(--mut));font-family:var(--font);font-size:.8rem;font-weight:600;text-transform:none;letter-spacing:0;background:none;text-decoration:none;opacity:.8;transition:opacity .15s,background .15s}.addc:hover{opacity:1;background:var(--sheet);color:var(--tt,var(--acc));border-color:var(--tb,var(--acc));text-decoration:none}
.pulse{box-shadow:0 0 0 3px var(--bad)!important}

/* entrance */
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.hero.split>div:first-child>*,.hero:not(.split)>*,.filter,.askf{animation:rise .55s cubic-bezier(.2,.7,.2,1) both}.hero p{animation-delay:.07s}.cta{animation-delay:.14s}.facts{animation-delay:.2s}.mock{animation:rise .7s cubic-bezier(.2,.7,.2,1) .15s both}
body.boot .side>*{animation:rise .45s cubic-bezier(.2,.7,.2,1) both}body.boot .side>:nth-child(n+3){animation-delay:.05s}body.boot .side>:nth-child(n+5){animation-delay:.1s}body.boot .side>:nth-child(n+7){animation-delay:.15s}
body.boot .year{animation:rise .5s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i,0)*80ms)}body.boot .it{animation:rise .4s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(120ms + var(--i,0)*45ms)}

/* course detail drawer */
.panel{position:fixed;right:16px;top:80px;bottom:16px;width:350px;z-index:30;background:var(--sheet);color:var(--ink);border:1px solid var(--rule);border-radius:22px;box-shadow:var(--shadow);padding:22px 20px;overflow:auto;animation:slidein .22s cubic-bezier(.2,.7,.2,1)}
@keyframes slidein{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
.panel h3{margin:0 40px 10px 0;font-size:1.45rem;font-weight:750;line-height:1.1}.panel .code{display:inline-block;font-family:var(--mono);font-size:.68rem;font-weight:700;letter-spacing:0;color:var(--c,var(--acc));background:color-mix(in srgb,var(--c,#aab3c8) 14%,transparent);border:0;border-radius:8px;padding:4px 9px;margin-bottom:10px}
.panel .x{position:absolute;right:14px;top:14px;margin:0;width:34px;height:34px;border-color:var(--rule);color:var(--mut)}.panel .x:hover{background:var(--soft);color:var(--ink);border-color:var(--rule)}
.panel h4{margin:20px 0 6px;font-family:var(--font);font-size:.76rem;text-transform:none;letter-spacing:0;color:var(--mut);font-weight:650;border-top:0;padding-top:0}
.panel p{margin:0;font-size:.92rem}.panel .flag{color:var(--bad)}.panel ul{list-style:none;margin:0;padding:0;font-size:.88rem}.panel li{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border-top:0;background:var(--bg2);border-radius:10px;margin-top:4px}.panel li:first-child{border-top:0}.panel li span{font-family:var(--font);font-size:.74rem;font-weight:600;letter-spacing:0;color:var(--mut);white-space:nowrap;padding-top:1px}.panel li.late{background:color-mix(in srgb,var(--bad) 10%,var(--sheet))}.panel li.late span{color:var(--bad)}
.panel .lnk{text-align:left;color:var(--ink);text-decoration:none}.panel .lnk:hover{color:var(--acc);text-decoration:none}
.panel .row{display:flex;gap:8px;margin-top:4px}.panel .row .sel{flex:1;min-width:0;color:var(--ink);background:var(--bg2);border-color:var(--rule);border-right:1px solid var(--rule)}.panel .btn{color:var(--ink);border-color:var(--rule)}.panel .btn:hover{background:var(--sheet);color:var(--ink)}.panel .btn.pri{background:linear-gradient(180deg,var(--acc),var(--acc-d));color:#fff;border-color:var(--acc-d)}
.pills{display:flex;gap:6px;flex-wrap:wrap;font-family:var(--font);font-size:.74rem;font-weight:600;text-transform:none;letter-spacing:0;color:var(--mut)}.pills span{border:0;background:var(--soft);border-radius:999px;padding:3px 10px}.pills span+span:before{content:none}
.links{display:grid;gap:8px;margin-top:0}.links a{display:flex;justify-content:space-between;align-items:center;border:1px solid var(--rule);border-radius:12px;padding:10px 12px;font-size:.9rem;font-weight:600;background:var(--sheet);color:var(--ink);text-decoration:none;transition:border-color .15s,box-shadow .15s}.links a:first-child{border-top:1px solid var(--rule)}.links a:hover{border-color:var(--acc);box-shadow:var(--sh1);background:var(--sheet)}.links a:hover span{transform:translate(2px,-2px);color:var(--acc)}.links a span{transition:transform .12s}.links small{font-family:var(--font);font-weight:400;color:var(--mut);font-size:.74rem;letter-spacing:0}
body.haspanel .stage{padding-right:390px}

.tabs{background:color-mix(in srgb,var(--paper) 94%,transparent);backdrop-filter:blur(10px);border-top:1px solid var(--rule)}.tabs a,.tabs button{font-family:var(--font);font-size:.78rem;font-weight:600;text-transform:none;letter-spacing:0;color:var(--mut);text-decoration:none}.tabs [aria-current]{color:var(--acc);font-weight:700}
@media(min-width:861px){.tabs{display:none}}
@media(max-width:980px){.hero.split{grid-template-columns:1fr;gap:30px}.mock{max-width:460px}}
@media(max-width:860px){.top{padding:0 14px;height:58px}.top .nav{display:none}.top .find{width:auto;min-width:0}.top .find kbd{display:none}main{padding:24px 16px 100px}main.wide{padding:0 0 90px}
.app{display:block}.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--rule);padding:18px 16px}.stage{padding:18px 14px}.yrow{grid-template-columns:1fr}.majors{grid-template-columns:1fr}
.panel{left:0;right:0;top:auto;bottom:0;width:auto;max-height:66vh;border-radius:22px 22px 0 0;padding-bottom:calc(70px + env(safe-area-inset-bottom));animation:slideup .22s cubic-bezier(.2,.7,.2,1)}body.haspanel .stage{padding-right:14px}.mv{opacity:1}}
@keyframes slideup{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}.board path{stroke-dashoffset:0}}
@media print{.top,.side .acts,.side .seg,.side h4,.side .hint,.panel,.board>svg,.addc,.mv,.help,.tabs{display:none!important}body{background:#fff}.app{display:block;background:#fff}.side{position:static;height:auto;border:0;padding:0 0 8px}.stage{padding:0}.year{break-inside:avoid}.term{break-inside:avoid}.it{break-inside:avoid;opacity:1!important;box-shadow:none;border:1px solid #bbb}body.haspanel .stage{padding-right:0}}

/* ---- 8th pass: cream, fading dot grid, floating nav, lighter headlines ---- */
body{position:relative;isolation:isolate}
body:before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:radial-gradient(circle,var(--dot) 1.1px,transparent 1.5px);background-size:18px 18px;
-webkit-mask-image:radial-gradient(ellipse 85% 70% at 50% 0%,#000 25%,transparent 78%);mask-image:radial-gradient(ellipse 85% 70% at 50% 0%,#000 25%,transparent 78%)}
h1{font-weight:600;letter-spacing:-.02em}h2{font-weight:600}h3,.term h3,.cols h3,.paths b{font-weight:650}
.top{top:12px;margin:12px auto 0;width:min(1200px,calc(100% - 28px));height:58px;padding:0 10px 0 18px;border:1px solid var(--rule);border-radius:16px;background:color-mix(in srgb,var(--sheet) 82%,transparent);box-shadow:var(--sh1)}
.top .brand{font-weight:700;font-size:1.12rem}.top .nav a{font-size:.74rem;font-weight:650;text-transform:uppercase;letter-spacing:.07em;border-radius:10px;padding:8px 12px}.top .nav a[aria-current]{background:none;color:var(--acc)}
.top .find{border-radius:10px;background:var(--sheet);width:200px;padding:8px 12px}.icon{border-radius:10px;width:38px;height:38px}
.btn,.sel{border-radius:10px}.btn.big,a.btn.big{border-radius:10px;padding:11px 18px;font-size:.95rem}.btn.big:after{content:"\\2197";font-size:1.05em;line-height:1;margin-left:2px;transition:transform .15s}.btn.big:hover:after{transform:translate(2px,-2px)}
.btn.pri{background:var(--acc);box-shadow:0 1px 0 rgba(255,255,255,.2) inset,0 6px 16px color-mix(in srgb,var(--acc) 30%,transparent)}.btn.pri:hover{background:var(--acc)}#share{background:var(--acc)}.askf .btn,.panel .btn.pri{background:var(--acc)}
.seg{border-radius:10px}.seg button{border-radius:7px}
/* home: centered, like a product page */
.hero.split{display:block;text-align:center;padding:56px 0 10px}.hero.split>div:first-child{max-width:860px;margin:0 auto}
.hero h1{font-size:clamp(2.5rem,6vw,4.6rem);font-weight:550;line-height:1.06;letter-spacing:-.025em}.hero h1 em{color:var(--acc2)}.hero p{margin:1.1em auto 0;max-width:54ch;font-size:1.08rem}
.cta{justify-content:center;margin-top:28px}.hero .facts{justify-content:center;gap:44px;margin-top:38px}.hero .facts b{font-weight:600;font-size:1.9rem}
.mock{max-width:760px;margin:56px auto 0;transform:none;border-radius:24px;text-align:left;padding:20px}.mock:before{inset:-22px -22px -22px -22px;border-radius:36px;transform:none;background:linear-gradient(135deg,color-mix(in srgb,var(--acc2) 22%,transparent),color-mix(in srgb,var(--acc) 16%,transparent));filter:blur(28px);opacity:.8}
.mock .mi{padding:10px 11px;font-size:.84rem}.mock .mi u{font-size:.68rem}.mock .mc b{font-size:.9rem}
h2{text-align:left}.col{font-weight:600;font-size:1.3rem}.majors a,.majors button,.paths a,.paths a+a,.cols section,.note{border-radius:16px}.filter{border-radius:12px;background:var(--sheet)}
.lede,.ans{border-radius:20px;background:var(--sheet);border:1px solid var(--rule);font-weight:600}
/* numbered section labels: "01  FIRST YEAR" */
.year>h2{display:flex;align-items:center;gap:10px;font-family:var(--font);font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--acc2);margin:0 0 12px}
.year>h2 span{display:grid;place-items:center;min-width:30px;height:24px;padding:0 7px;border:1px solid var(--rule);border-radius:999px;background:var(--sheet);color:var(--mut);font-family:var(--mono);font-size:.62rem;letter-spacing:0}
/* planner: floating sidebar card on the cream page */
.app{background:none;grid-template-columns:336px minmax(0,1fr);min-height:calc(100vh - 82px)}
.side{margin:16px 0 16px 14px;border:1px solid var(--rule);border-radius:22px;top:86px;height:calc(100vh - 104px);box-shadow:var(--sh1);background:color-mix(in srgb,var(--sheet) 92%,transparent)}
.side h1{font-weight:600}.prog b{font-weight:650}.stat{background:var(--bg2)}.stat b{font-weight:650}
.side #conf{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--rule);border-radius:999px;padding:6px 13px;font-size:.84rem;background:var(--sheet);color:var(--ink);font-weight:500}.side #conf:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--ok);flex:none}.side #conf.flag{border-color:color-mix(in srgb,var(--bad) 45%,transparent)}.side #conf.flag:before{background:var(--bad)}.side #conf .lnk{margin-left:4px}
.stage{padding:20px 24px 40px}.term{border-radius:20px}.it{border-radius:12px}
.panel{top:86px;border-radius:22px}
@media(max-width:860px){.top{top:8px;margin-top:8px;height:54px}.side{margin:12px;height:auto;position:static}.hero.split{padding:30px 0 0}.hero .facts{gap:22px}.mock{margin-top:36px}}
@media print{body:before{display:none}.side{margin:0;border:0;box-shadow:none}}
.aibox{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;max-width:720px;margin:14px 0 4px;padding:12px 14px;border:1px dashed var(--rule);border-radius:14px;background:color-mix(in srgb,var(--sheet) 70%,transparent)}.aibox .mut{flex:1 1 280px;font-size:.84rem;line-height:1.45}.aibox .meter{flex-basis:100%}.aibox .btn[aria-pressed=true]{background:var(--acc);border-color:var(--acc);color:#fff}
.aians{border-left:4px solid var(--acc2);margin-top:12px}.aians .mut{font-family:var(--font);font-size:.74rem;font-weight:600;margin:0 0 6px}.aians p:last-child{font-family:var(--font);font-size:1rem;font-weight:400;white-space:pre-wrap}
/* ---- 9th pass: buttons after the reference site. Compact, 8px corners, a hairline border that catches
   an orange glint on its top-left edge, no lift on hover (the glint spreads instead), and an arrow that slides out and back in. ---- */
.btn{font-size:.84rem;font-weight:500;letter-spacing:.005em;border-radius:8px;padding:9px 16px;border:1px solid transparent;box-shadow:none;background:linear-gradient(var(--sheet),var(--sheet)) padding-box,radial-gradient(70% 130% at 22% 0%,var(--acc2),var(--rule) 62%) border-box;transition:box-shadow .2s,color .15s,filter .15s}
.btn:hover{transform:none;border-color:transparent;box-shadow:0 0 0 3px var(--acc-soft);background:linear-gradient(var(--sheet),var(--sheet)) padding-box,radial-gradient(130% 170% at 22% 0%,var(--acc2),var(--rule) 80%) border-box}
.btn:active{transform:translateY(1px);box-shadow:none}
.btn:disabled,.btn:disabled:hover{background:var(--sheet);border-color:var(--rule);box-shadow:none;transform:none}
.acts .btn,.acts .btn:nth-child(2n),.panel .btn,.panel .btn:hover{border:1px solid transparent}
.btn.pri,.btn.pri:hover,#share,#share:hover,.askf .btn,.askf .btn:hover,.panel .btn.pri,.aibox .btn[aria-pressed=true]{color:#fff;background:linear-gradient(var(--acc),var(--acc)) padding-box,radial-gradient(80% 140% at 22% 0%,var(--acc2),var(--acc-d) 65%) border-box;box-shadow:0 8px 20px -8px color-mix(in srgb,var(--acc) 60%,transparent);filter:none}
.btn.pri:hover,#share:hover,.askf .btn:hover{box-shadow:0 10px 26px -8px color-mix(in srgb,var(--acc) 75%,transparent),0 0 0 3px var(--acc-soft);filter:brightness(1.07)}
.btn.big,a.btn.big{border-radius:8px;padding:11px 18px;font-size:.9rem}.btn.big:after{display:inline-block;margin-left:4px;transition:none}.btn.big:hover:after{transform:none;animation:gp-arrow .38s ease}
@keyframes gp-arrow{0%{transform:translate(0,0);opacity:1}45%{transform:translate(9px,-9px);opacity:0}55%{transform:translate(-9px,9px);opacity:0}100%{transform:translate(0,0);opacity:1}}
.seg{border-radius:8px}.seg button{border-radius:6px}.sel{border-radius:8px}.icon{border-radius:8px}
@media(prefers-reduced-motion:reduce){.btn.big:hover:after{animation:none}}
/* Experimental AI answers: one closed line until the visitor opens it. */
.exp{max-width:720px;margin:14px 0 4px}.exp>summary{cursor:pointer;font-size:.84rem;font-weight:500;color:var(--mut);list-style:none;display:inline-flex;align-items:center;gap:8px;padding:6px 2px}.exp>summary::-webkit-details-marker{display:none}.exp>summary:before{content:"+";display:grid;place-items:center;width:18px;height:18px;border:1px solid var(--rule);border-radius:6px;font-family:var(--mono);font-size:.8rem;color:var(--mut)}.exp[open]>summary:before{content:"\\2212"}.exp>summary:hover{color:var(--ink)}.exp .aibox{margin-top:6px}
/* "Beta" marker for Ask: in the nav and beside the page intro. */
.beta{display:inline-block;font-family:var(--mono);font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--acc2);border:1px solid color-mix(in srgb,var(--acc2) 45%,transparent);border-radius:999px;padding:1px 6px;vertical-align:middle;line-height:1.4}sup.beta{margin-left:5px;vertical-align:super;font-size:.52rem;padding:0 5px}.hero .beta{margin-right:6px;font-size:.66rem}
`;
