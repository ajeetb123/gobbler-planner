// The "dark app" look (Nov 2026 redesign). Appended after CSS in render.ts, so it wins the cascade:
// it redefines the color tokens the older rules already use, swaps the type to a sans stack, and restyles the
// shell (top bar), the planner (timeline of course cards, detail panel, prerequisite lines) and shared parts.
// Dark is the default; <html data-theme="light"> switches to light (set by theme.js before first paint).

/** Runs in <head> before the page paints, so a saved light theme never flashes dark first. */
export const THEME_JS = `(()=>{try{const t=localStorage.getItem('gobblerplan:theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}})();`;

export const THEME_CSS = `
:root{--font:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
--paper:#0b0d12;--sheet:#131720;--soft:#1a1f2b;--lift:#1f2533;--ink:#e9ebf2;--mut:#8891a7;--rule:#252b3a;--acc:#8c9bff;--acc2:#5eead4;--ok:#3ddc97;--bad:#ff7b7b;--amber:#f6bd4f;--warn:#241f10;--band:#2b3550;
--ga:#a5b4ff;--gb:#6f7ff5;--gc:#4a57b8;--gd:#333c78;--gf:#a8674a;--gw:#454b5c;--shadow:0 10px 40px rgba(0,0,0,.45);color-scheme:dark}
:root[data-theme=light]{--paper:#f4f5f9;--sheet:#ffffff;--soft:#eceef5;--lift:#ffffff;--ink:#12151d;--mut:#5b6478;--rule:#dde1ea;--acc:#4250e0;--acc2:#0e9f8e;--ok:#0f9565;--bad:#d43d3d;--amber:#a86d00;--warn:#fff5d1;--band:#d5dbf5;
--ga:#2f3bb5;--gb:#5f6ff0;--gc:#97a2f5;--gd:#cdd3fb;--gf:#dfae93;--gw:#c9ccd6;--shadow:0 10px 40px rgba(20,24,40,.14);color-scheme:light}
html{background:var(--paper)}body{font-family:var(--font);background:var(--paper);color:var(--ink);font-size:15.5px;letter-spacing:-.005em}
h1,h2,h3,.lede,.term h3,.cols h3,.col,.paths b,.brand,.hero h1{font-family:var(--font);letter-spacing:-.025em}
h1{font-size:clamp(1.7rem,3.2vw,2.4rem);font-weight:750}h2{font-size:1.02rem;font-weight:650;border-top:1px solid var(--rule);margin-top:2.6em;text-transform:none}
a{text-decoration-color:color-mix(in srgb,var(--acc) 60%,transparent)}a:hover{color:var(--acc)}::selection{background:color-mix(in srgb,var(--acc) 35%,transparent)}
kbd{font-family:var(--mono);font-size:.72rem;border:1px solid var(--rule);border-radius:5px;padding:1px 5px;color:var(--mut);background:var(--soft)}

/* shell: sticky top bar */
.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:6px;padding:10px 20px;background:color-mix(in srgb,var(--paper) 82%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--rule)}
.top .brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:1rem;text-decoration:none;margin-right:14px;white-space:nowrap}
.logo{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#0b0d12;font-weight:800;font-size:.9rem}
.top .nav{display:flex;flex-direction:row;gap:2px}.top .nav a{padding:6px 11px;border-radius:8px;border:0;font-size:.92rem;color:var(--mut);text-decoration:none}.top .nav a:hover{background:var(--soft);color:var(--ink)}.top .nav a[aria-current]{background:var(--soft);color:var(--ink);font-weight:600}
.grow{flex:1}.top .find{width:auto;min-width:190px;padding:6px 10px;border-radius:9px;background:var(--sheet);font-size:.88rem}.icon{font:inherit;width:34px;height:34px;border-radius:9px;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);cursor:pointer}.icon:hover,.top .find:hover{border-color:var(--acc)}
main{max-width:1240px;margin:0 auto;padding:26px 24px 90px}main.wide{max-width:none}
footer{color:var(--mut);font-size:.8rem;border-top:1px solid var(--rule);margin-top:56px;padding-top:16px;max-width:900px}
.crumb{font-size:.74rem;letter-spacing:.08em}
#pal{background:var(--lift);color:var(--ink);border:1px solid var(--rule);border-radius:14px;box-shadow:var(--shadow)}#pal::backdrop{background:rgba(5,7,12,.6);backdrop-filter:blur(3px)}

/* shared pieces */
.btn,.sel{background:var(--sheet);border:1px solid var(--rule);border-radius:9px;color:var(--ink);font-size:.88rem;transition:border-color .12s,background .12s}.btn:hover{border-color:var(--acc);background:var(--soft)}
.btn.pri{background:var(--acc);border-color:var(--acc);color:#0b0d12;font-weight:650}.btn.pri:hover{filter:brightness(1.08);background:var(--acc)}
.seg{background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:3px;gap:2px}.seg button{border:0;border-radius:7px;padding:5px 11px;font-size:.86rem;color:var(--mut);background:none}.seg button[aria-pressed=true]{background:var(--acc);color:#0b0d12;font-weight:650}
.note{background:var(--sheet);border:1px solid var(--rule);border-radius:12px}.note.warn{background:var(--warn);border-color:color-mix(in srgb,var(--amber) 35%,transparent)}
.tag{border-radius:999px;font-size:.7rem;padding:1px 8px;border-color:var(--rule);color:var(--mut);margin:0}.tag.hot{border-color:color-mix(in srgb,var(--amber) 60%,transparent);color:var(--amber)}
.flag{color:var(--bad);font-weight:600}.mut{color:var(--mut)}.lnk{text-decoration-color:var(--acc)}
.chips a,.chips button{background:var(--sheet);border-color:var(--rule);border-radius:999px}.chips a:hover,.chips button:hover{border-color:var(--acc);color:var(--acc)}
.lede,.ans{border-left:3px solid var(--acc);font-size:1.12rem;font-weight:550}.lede small{font-weight:400}
.hero h1{font-size:clamp(2.2rem,6vw,4rem);font-weight:800;line-height:1.02;max-width:16ch}.hero h1 em{font-style:normal;background:linear-gradient(90deg,var(--acc),var(--acc2));-webkit-background-clip:text;background-clip:text;color:transparent}.hero p{font-size:1.08rem;max-width:58ch}
.paths{border-top:0;gap:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}.paths a,.paths a+a{border:1px solid var(--rule);border-radius:14px;background:var(--sheet);padding:18px 20px}.paths a:hover{border-color:var(--acc)}
.filter{background:var(--sheet);border-radius:12px;font-size:1rem}.col{font-size:.8rem;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);font-weight:650;margin-top:2.2em}
.majors{border-top:0;gap:10px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}.majors a,.majors button{border:1px solid var(--rule);border-radius:12px;background:var(--sheet);padding:12px 14px;align-items:center;transition:transform .12s,border-color .12s}.majors a:hover,.majors button:hover{border-color:var(--acc);transform:translateY(-1px);color:var(--ink)}.majors b{font-weight:600;font-size:.94rem}.majors [aria-current]{border-color:var(--acc)}
.cols section{border:1px solid var(--rule);border-radius:14px;background:var(--sheet);padding:14px 16px;margin-bottom:14px}.cols{gap:14px}.cols li{border-color:var(--rule)}
.askf .sel{border-radius:12px;background:var(--sheet)}.askf .btn{background:var(--acc);border-color:var(--acc);color:#0b0d12;font-weight:650;padding:0 20px;border-radius:12px}
.meter{background:var(--soft);border-radius:99px}.meter i{background:linear-gradient(90deg,var(--acc),var(--acc2));border-radius:99px}

/* planner header */
.phead{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px 20px;align-items:center;margin-bottom:6px}.phead .grow{display:none}@media(max-width:1100px){.phead .stats{grid-column:1/-1}}.phead h1{margin:0}.phead .sub{margin:4px 0 0}
.ring{position:relative;width:84px;height:84px;flex:none}.ring svg{transform:rotate(-90deg)}.ring circle{fill:none;stroke-width:8}.ring .bg{stroke:var(--soft)}.ring .fg{stroke:url(#rg);stroke-linecap:round;transition:stroke-dashoffset .5s ease}
.ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:1.05rem;font-weight:750}
.stats{display:flex;gap:10px;flex-wrap:wrap}.stat{background:var(--sheet);border:1px solid var(--rule);border-radius:12px;padding:8px 14px;min-width:96px}.stat b{display:block;font-size:1.15rem;font-weight:750;letter-spacing:-.02em}.stat span{font-size:.74rem;color:var(--mut)}.stat.bad b{color:var(--bad)}.stat.good b{color:var(--ok)}
.bar2{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:16px 0 8px;padding:8px;background:var(--sheet);border:1px solid var(--rule);border-radius:13px;position:sticky;top:58px;z-index:10}
.bar2 .seg{background:var(--soft);border:0}.bar2 .btn{border-color:transparent;background:none}.bar2 .btn:hover{background:var(--soft)}
.help{margin-top:26px;border:1px solid var(--rule);border-radius:12px;padding:10px 14px;background:var(--sheet)}.over{height:46px;border-bottom:0;gap:4px;margin:10px 0 2px}.over i{background:var(--gc);border-radius:4px}.over .hv i{background:var(--amber)}.over .sm i{background:var(--gd)}.over a{font-size:.66rem}

/* planner board: one column per term, scrolls sideways */
.board{position:relative;display:flex;gap:14px;overflow-x:auto;padding:8px 2px 26px;align-items:flex-start;scroll-snap-type:x proximity;grid-template-columns:none}
.board>svg{position:absolute;left:0;top:0;pointer-events:none;z-index:3}.board path{fill:none;stroke-width:2;stroke-linecap:round}.board .lp{stroke:var(--acc)}.board .ln{stroke:var(--acc2)}
.term{flex:0 0 264px;scroll-snap-align:start;border:1px solid var(--rule);border-top:1px solid var(--rule);border-radius:16px;background:var(--sheet);padding:12px 10px 10px;transition:border-color .12s,background .12s}
.term h3{font-size:.9rem;font-weight:650;margin:0 4px}.term>.mut{margin:1px 4px 0;font-size:.76rem}.term .load{margin:8px 4px 8px;height:4px}.term>.flag{margin:0 4px 6px;font-size:.74rem;color:var(--amber)}
.term.drop{background:var(--soft);outline:2px dashed var(--acc);outline-offset:0}
.it{position:relative;display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:start;border:1px solid var(--rule);border-left:3px solid var(--c,var(--rule));border-radius:10px;background:var(--lift);padding:8px 8px 8px 9px;margin-top:7px;cursor:pointer;transition:transform .1s,border-color .12s,opacity .15s,box-shadow .12s}
.it:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.25);border-color:color-mix(in srgb,var(--c,var(--acc)) 60%,var(--rule))}
.it .nm{font-size:.86rem;line-height:1.3}.it .nm a{font-family:var(--mono);font-weight:650;font-size:.8rem;text-decoration:none;color:var(--c,var(--ink))}.it .nm a:hover{text-decoration:underline}.it .mut{font-size:.72rem;margin-top:2px}.it .flag{font-size:.72rem;margin-top:3px}
.it input{appearance:none;-webkit-appearance:none;width:17px;height:17px;border-radius:50%;border:1.5px solid var(--mut);margin:2px 0 0;cursor:pointer;display:grid;place-items:center}.it input:checked{background:var(--ok);border-color:var(--ok)}.it input:checked:after{content:"";width:8px;height:4px;border:2px solid #0b0d12;border-top:0;border-right:0;transform:rotate(-45deg) translateY(-1px)}
.it.done{opacity:.55}.it.done .nm{text-decoration:line-through;text-decoration-color:var(--mut)}
.mv{opacity:0;transition:opacity .12s;gap:2px}.it:hover .mv,.it:focus-within .mv,.it.sel .mv{opacity:1}.mv button{width:22px;height:22px;border-radius:6px;border:1px solid var(--rule);background:var(--sheet);font-size:.7rem}
.it.sel{border-color:var(--acc);box-shadow:0 0 0 2px color-mix(in srgb,var(--acc) 45%,transparent)}.it.pre{border-color:var(--acc)}.it.post{border-color:var(--acc2)}.it.dim{opacity:.32}
.it.conflict{border-color:color-mix(in srgb,var(--bad) 70%,transparent)}
.addc{display:block;width:100%;text-align:center;border:1px dashed var(--rule);border-radius:10px;padding:7px;margin-top:8px;text-decoration:none;color:var(--mut)}.addc:hover{border-color:var(--acc);color:var(--acc)}
.pulse{outline:2px solid var(--bad);outline-offset:3px}

/* course detail panel */
.panel{position:fixed;right:16px;top:74px;bottom:16px;width:340px;z-index:30;background:var(--lift);border:1px solid var(--rule);border-radius:18px;box-shadow:var(--shadow);padding:18px 18px 16px;overflow:auto;animation:slide .16s ease}
@keyframes slide{from{transform:translateX(14px);opacity:0}to{transform:none;opacity:1}}
.panel h3{margin:0 28px 2px 0;font-size:1.15rem;font-weight:750;letter-spacing:-.02em}.panel .code{font-family:var(--mono);font-size:.8rem;font-weight:650;color:var(--c,var(--acc))}
.panel .x{position:absolute;right:12px;top:12px}.panel h4{margin:16px 0 5px;font-size:.7rem;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);font-weight:650}
.panel p{margin:0;font-size:.88rem;line-height:1.5}.panel ul{list-style:none;margin:0;padding:0;font-size:.86rem}.panel li{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--rule)}.panel li span{color:var(--mut);white-space:nowrap}.panel li.late span{color:var(--bad)}
.panel .lnk{text-align:left}.panel li .lnk{text-decoration:none}.panel li .lnk:hover{color:var(--acc)}.panel .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.panel .row .sel{flex:1;min-width:0}.pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pills span{font-size:.72rem;border:1px solid var(--rule);border-radius:999px;padding:1px 9px;color:var(--mut)}
.links{display:grid;gap:6px;margin-top:6px}.links a{display:flex;justify-content:space-between;align-items:center;border:1px solid var(--rule);border-radius:10px;padding:8px 11px;text-decoration:none;font-size:.86rem;background:var(--sheet)}.links a:hover{border-color:var(--acc)}.links small{color:var(--mut);font-size:.72rem}
body.haspanel main{padding-right:372px}

@media(max-width:860px){.top{padding:9px 14px}.top .nav{display:none}.top .find{min-width:0}.top .find kbd{display:none}main{padding:18px 14px 110px}.bar2{top:54px;overflow-x:auto;flex-wrap:nowrap}.bar2 .btn{white-space:nowrap}
.term{flex-basis:82vw}.panel{left:0;right:0;top:auto;bottom:0;width:auto;max-height:62vh;border-radius:18px 18px 0 0;padding-bottom:calc(70px + env(safe-area-inset-bottom));animation:up .18s ease}body.haspanel main{padding-right:14px}.ring{width:64px;height:64px}
.tabs{background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(14px);border-top:1px solid var(--rule)}.tabs [aria-current]{color:var(--acc)}}
@keyframes up{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}
@media(min-width:861px){.tabs{display:none}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media print{.top,.bar2,.panel,.ring,.stats,.board>svg{display:none!important}:root{--paper:#fff;--sheet:#fff;--lift:#fff;--ink:#000;--mut:#444;--rule:#bbb}.board{display:block;overflow:visible}.term{break-inside:avoid;margin-bottom:10px;border-radius:8px}.it{break-inside:avoid;opacity:1!important}body.haspanel main{padding-right:0}}
`;
