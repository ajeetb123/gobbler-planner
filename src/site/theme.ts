// The site's look (5th pass, Nov 2026): a plain, flat "student tool" layout in the family of the planners students
// at other schools built (sidebar plus a board of years, terms side by side). Deliberately NO gradient text,
// glass blur, glow, pill chips or oversized hero: the owner called those out as looking machine-made.
// Appended after CSS in render.ts, so it wins the cascade by redefining the color tokens older rules use.
// Light is the default; <html data-theme="dark"> switches (set by theme.js before first paint).

/** Runs in <head> before the page paints, so a saved dark theme never flashes light first. */
export const THEME_JS = `(()=>{try{const t=localStorage.getItem('gobblerplan:theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}})();`;

export const THEME_CSS = `
:root{--font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--mono:ui-monospace,Menlo,Consolas,monospace;
--brand:#16233f;--paper:#f2f3f6;--sheet:#fff;--soft:#eceef3;--lift:#fff;--ink:#141a26;--mut:#667085;--rule:#d6dae3;--acc:#2a55e5;--acc2:#2a55e5;--ok:#177a43;--bad:#c5302c;--amber:#a95f06;--warn:#fff7df;--band:#d5dcf3;
--ga:#1e3a8a;--gb:#3b62d9;--gc:#93a8ea;--gd:#cfd8f6;--gf:#e0a48c;--gw:#c5c9d3;--shadow:0 8px 28px rgba(16,24,40,.16);color-scheme:light}
:root[data-theme=dark]{--brand:#0c111c;--paper:#10131a;--sheet:#181c25;--soft:#20252f;--lift:#1c212b;--ink:#e6e8ee;--mut:#99a1b1;--rule:#2c323f;--acc:#7c9aff;--acc2:#7c9aff;--ok:#4ac98a;--bad:#ff8580;--amber:#f0b24a;--warn:#2a2412;--band:#2b3550;
--ga:#b3c2ff;--gb:#7c9aff;--gc:#4a5cae;--gd:#2f3a70;--gf:#a8674a;--gw:#454b5c;--shadow:0 8px 28px rgba(0,0,0,.5);color-scheme:dark}
html{background:var(--paper)}body{font-family:var(--font);background:var(--paper);color:var(--ink);font-size:15px;line-height:1.45;letter-spacing:0}
h1,h2,h3,.lede,.term h3,.cols h3,.col,.paths b,.brand,.hero h1{font-family:var(--font);letter-spacing:0}
h1{font-size:1.6rem;font-weight:700;line-height:1.2;margin:0 0 .3em}h2{font-size:1rem;font-weight:700;border-top:0;margin:1.8em 0 .5em;padding:0}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline;color:var(--acc)}.sub{color:var(--mut);margin:0 0 1em}
kbd{font-family:var(--mono);font-size:.7rem;border:1px solid var(--rule);border-radius:4px;padding:0 4px;color:var(--mut);background:var(--sheet)}

/* top bar: solid brand color */
.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:4px;height:50px;padding:0 16px;background:var(--brand);color:#fff}
.top .brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:1rem;color:#fff;margin-right:18px;white-space:nowrap}.top .brand:hover{text-decoration:none}
.logo{display:grid;place-items:center;width:24px;height:24px;border-radius:5px;background:#fff;color:var(--brand);font-weight:800;font-size:.85rem}
.top .nav{display:flex;flex-direction:row;gap:0;height:100%}.top .nav a{display:flex;align-items:center;padding:0 12px;border:0;border-bottom:3px solid transparent;border-top:3px solid transparent;border-radius:0;font-size:.9rem;color:#c9d2e6}.top .nav a:hover{background:rgba(255,255,255,.08);color:#fff;text-decoration:none}.top .nav a[aria-current]{background:none;color:#fff;font-weight:600;border-bottom-color:#fff}
.grow{flex:1}.top .find{width:220px;display:flex;justify-content:space-between;padding:6px 10px;border-radius:6px;border:0;background:rgba(255,255,255,.12);color:#dfe5f3;font-size:.86rem}.top .find:hover{background:rgba(255,255,255,.2);color:#fff}.top .find kbd{background:none;border-color:rgba(255,255,255,.35);color:#dfe5f3}
.icon{font:inherit;width:32px;height:32px;border-radius:6px;border:0;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;margin-left:6px}.icon:hover{background:rgba(255,255,255,.22)}
main{max-width:1100px;margin:0 auto;padding:22px 20px 80px}main.wide{max-width:none;padding:0}
footer{color:var(--mut);font-size:.78rem;border-top:1px solid var(--rule);margin-top:40px;padding-top:14px;max-width:none}main.wide footer{margin:30px 20px 0;padding-bottom:30px}
.crumb{display:none}
#pal{background:var(--sheet);color:var(--ink);border:1px solid var(--rule);border-radius:8px;box-shadow:var(--shadow)}#pal::backdrop{background:rgba(10,14,22,.45)}

/* shared pieces */
.btn,.sel{font:inherit;font-size:.86rem;background:var(--sheet);border:1px solid var(--rule);border-radius:6px;color:var(--ink);padding:6px 11px;cursor:pointer}.btn:hover{background:var(--soft);border-color:var(--rule)}.btn:disabled{opacity:.45;cursor:default}
.btn.pri{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}.btn.pri:hover{background:var(--acc);filter:brightness(.93)}
.seg{display:inline-flex;background:var(--sheet);border:1px solid var(--rule);border-radius:6px;padding:0;gap:0;overflow:hidden}.seg button{font:inherit;font-size:.84rem;border:0;border-right:1px solid var(--rule);border-radius:0;padding:6px 10px;color:var(--ink);background:none;cursor:pointer}.seg button:last-child{border-right:0}.seg button:hover{background:var(--soft)}.seg button[aria-pressed=true]{background:var(--acc);color:#fff;font-weight:600}
.note{background:var(--sheet);border:1px solid var(--rule);border-radius:6px;padding:10px 12px;font-size:.88rem}.note.warn{background:var(--warn);border-color:#e6cf8a}:root[data-theme=dark] .note.warn{border-color:#5a4a1c}
.tag{display:inline-block;border:0;border-radius:3px;font-size:.68rem;font-weight:600;padding:1px 5px;background:var(--soft);color:var(--mut);margin:0}.tag.hot{background:var(--warn);color:var(--amber)}
.flag{color:var(--bad);font-weight:600}.mut{color:var(--mut)}.lnk{font:inherit;color:var(--acc);background:none;border:0;padding:0;cursor:pointer;text-decoration:none}.lnk:hover{text-decoration:underline}
.chips{gap:6px}.chips a,.chips button{font:inherit;font-size:.84rem;background:var(--sheet);border:1px solid var(--rule);border-radius:6px;padding:4px 9px;color:var(--ink);cursor:pointer}.chips a:hover,.chips button:hover{background:var(--soft);border-color:var(--rule);color:var(--ink);text-decoration:none}
.lede,.ans{border-left:4px solid var(--acc);background:var(--sheet);padding:12px 14px;font-size:1rem;font-weight:600;border-radius:0 6px 6px 0}.lede small{display:block;font-weight:400;color:var(--mut);margin-top:4px;font-size:.88rem}.ans p{margin:.4em 0;font-weight:400}.ans p:first-child{font-weight:600}
.hero{padding:10px 0 4px}.hero h1{font-size:1.9rem;font-weight:700;line-height:1.2;max-width:none}.hero h1 em{font-style:normal;color:inherit;background:none}.hero p{font-size:1rem;color:var(--mut);max-width:70ch;margin:.3em 0 0}
.paths{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;border-top:0;margin-top:26px}.paths a,.paths a+a{display:block;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);padding:12px 14px;color:var(--ink)}.paths a:hover{background:var(--soft);text-decoration:none}.paths b{display:block;font-size:.95rem;margin-bottom:2px}.paths span{color:var(--mut);font-size:.86rem}
.filter{display:block;width:100%;max-width:520px;padding:9px 12px;font-size:.95rem;border-radius:6px;margin:8px 0}
.col{font-size:.95rem;font-weight:700;color:var(--ink);text-transform:none;letter-spacing:0;margin:1.6em 0 .3em;padding-bottom:5px;border-bottom:2px solid var(--ink)}.col .mut{font-weight:400;font-size:.82rem}
.majors{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:0 28px;border-top:0}.majors a,.majors button{display:flex;justify-content:space-between;gap:10px;align-items:baseline;border:0;border-bottom:1px solid var(--rule);border-radius:0;background:none;padding:7px 2px;color:var(--ink);font:inherit;text-align:left;cursor:pointer;transform:none}.majors a:hover,.majors button:hover{background:var(--soft);color:var(--ink);text-decoration:none;transform:none}.majors b{font-weight:500;font-size:.9rem}.majors span{color:var(--mut);font-size:.78rem;white-space:nowrap}.majors [aria-current]{background:var(--soft);font-weight:700}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:14px}.cols section{border:1px solid var(--rule);border-radius:6px;background:var(--sheet);padding:10px 12px;margin:0}.cols h3{font-size:.92rem;margin:0}.cols ul{list-style:none;margin:6px 0 0;padding:0;font-size:.86rem}.cols li{border-top:1px solid var(--rule);padding:5px 0}
.ctl{gap:10px;margin:10px 0}.ctl label{font-size:.8rem;color:var(--mut)}.askf{display:flex;gap:8px;max-width:680px;margin:14px 0 8px}.askf .sel{flex:1;padding:9px 12px;font-size:.95rem;border-radius:6px;cursor:text}.askf .btn{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600;padding:0 18px}
.meter{background:var(--soft);border-radius:3px;height:8px;overflow:hidden}.meter i{display:block;height:100%;background:var(--acc);border-radius:0}
.help{margin:18px 0 0;font-size:.86rem;color:var(--mut);border:0;padding:0;background:none}.help summary{cursor:pointer;color:var(--acc);font-weight:500}.help ul{margin:.5em 0 0;padding-left:1.2em}

/* planner: sidebar + stage */
.app{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:calc(100vh - 50px)}
.side{background:var(--sheet);border-right:1px solid var(--rule);padding:16px 16px 22px;position:sticky;top:50px;align-self:start;height:calc(100vh - 50px);overflow:auto}
.side h1{font-size:1.15rem;margin:0 0 2px}.side .sub{font-size:.8rem;margin:0 0 12px}.side h4{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:16px 0 6px;font-weight:700}
.side .seg{display:flex}.side .seg button{flex:1;padding:6px 0}.acts{display:grid;grid-template-columns:1fr 1fr;gap:6px}.acts .btn{text-align:center;padding:6px 4px}
.prog{display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:4px}.prog b{font-weight:700}
.stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--rule);border-radius:6px;margin-top:10px;gap:0}.stat{padding:7px 4px;text-align:center;border:0;border-right:1px solid var(--rule);border-radius:0;background:none;min-width:0}.stat:last-child{border-right:0}.stat b{display:block;font-size:1rem;font-weight:700}.stat span{font-size:.66rem;color:var(--mut)}.stat.bad b{color:var(--bad)}.stat.good b{color:var(--ok)}
.side #conf{display:block;font-size:.84rem;margin:0}.side .hint{font-size:.78rem;color:var(--mut);margin:14px 0 0}.over{display:none}
.stage{padding:16px 20px 30px;min-width:0}.stage .note{margin:0 0 12px}

/* board: one panel per year, its terms side by side */
.board{position:relative;display:block;overflow:visible;padding:0;gap:0}
.board>svg{position:absolute;left:0;top:0;pointer-events:none;z-index:3}.board path{fill:none;stroke-width:2}.board .lp{stroke:var(--acc)}.board .ln{stroke:var(--ok);stroke-dasharray:5 4}
.year{background:var(--sheet);border:1px solid var(--rule);border-radius:8px;margin-bottom:14px;padding:10px 12px 12px}.year>h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);margin:0 0 8px;text-align:center}
.yrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.term{flex:none;border:1px solid var(--rule);border-top:1px solid var(--rule);border-radius:6px;background:var(--paper);padding:8px;scroll-margin-top:64px;min-width:0}
.term h3{display:inline;font-size:.86rem;font-weight:700;margin:0}.term>.mut{display:inline;float:right;font-size:.76rem;margin:1px 0 0}.term .load{display:none}.term>.flag{clear:both;font-size:.72rem;color:var(--amber);margin:4px 0 0;font-weight:600}
.term.drop{background:var(--band);outline:2px dashed var(--acc);outline-offset:-2px}
.it{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:start;clear:both;border:1px solid var(--rule);border-left:4px solid var(--c,#9aa3b2);border-radius:4px;background:var(--sheet);padding:5px 6px 5px 7px;margin-top:6px;cursor:pointer;transition:none;box-shadow:none}
.it:hover{background:var(--soft);transform:none;box-shadow:none;border-color:var(--rule);border-left-color:var(--c,#9aa3b2)}
.it .nm{font-size:.82rem;line-height:1.3;color:var(--mut)}.it .nm a{font-family:var(--font);font-weight:700;font-size:.82rem;color:var(--ink)}.it .mut{font-size:.7rem;margin-top:1px}.it .flag{font-size:.7rem;margin-top:2px}.it .lnk{font-size:.7rem}
.it input{appearance:auto;-webkit-appearance:auto;width:14px;height:14px;margin:2px 0 0;border-radius:0;accent-color:var(--ok);cursor:pointer}.it input:checked:after{content:none}
.it.done{opacity:1;background:var(--soft)}.it.done .nm,.it.done .nm a{text-decoration:line-through;color:var(--mut)}
.mv{display:flex;opacity:0;gap:2px}.it:hover .mv,.it:focus-within .mv,.it.sel .mv{opacity:1}.mv button{font:inherit;width:20px;height:20px;border-radius:3px;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);font-size:.66rem;cursor:pointer;padding:0}
.it.sel{outline:2px solid var(--acc);outline-offset:0;box-shadow:none;border-color:var(--rule)}.it.pre{outline:2px solid var(--acc);outline-offset:0}.it.post{outline:2px dashed var(--ok);outline-offset:0}.it.dim{opacity:.4}
.it.conflict{background:color-mix(in srgb,var(--bad) 9%,var(--sheet))}
.addc{display:block;width:100%;text-align:center;border:1px dashed var(--rule);border-radius:4px;padding:4px;margin-top:6px;color:var(--mut);font-size:.76rem;background:none}.addc:hover{background:var(--sheet);color:var(--acc);text-decoration:none}
.pulse{outline:3px solid var(--bad);outline-offset:1px}

/* course detail drawer */
.panel{position:fixed;right:0;top:50px;bottom:0;width:330px;z-index:30;background:var(--sheet);border:0;border-left:1px solid var(--rule);border-radius:0;box-shadow:var(--shadow);padding:16px;overflow:auto;animation:none}
.panel h3{margin:0 30px 6px 0;font-size:1.05rem;font-weight:700}.panel .code{font-family:var(--font);font-size:.8rem;font-weight:700;color:var(--mut);border-left:4px solid var(--c,#9aa3b2);padding-left:6px;margin-bottom:4px}
.panel .x{position:absolute;right:10px;top:10px;background:var(--soft);color:var(--ink);margin:0}.panel h4{margin:14px 0 4px;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);font-weight:700}
.panel p{margin:0;font-size:.86rem}.panel ul{list-style:none;margin:0;padding:0;font-size:.84rem}.panel li{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid var(--rule)}.panel li span{color:var(--mut);white-space:nowrap}.panel li.late span{color:var(--bad)}.panel .lnk{text-align:left}
.panel .row{display:flex;gap:6px;margin-top:4px}.panel .row .sel{flex:1;min-width:0}.pills{display:flex;gap:10px;flex-wrap:wrap;font-size:.78rem;color:var(--mut)}.pills span{border:0;padding:0}.pills span+span:before{content:"\\00b7";margin-right:10px}
.links{display:block;margin-top:2px}.links a{display:flex;justify-content:space-between;align-items:center;border:0;border-top:1px solid var(--rule);border-radius:0;padding:7px 0;font-size:.86rem;background:none;color:var(--acc)}.links a:hover{background:none}.links small{color:var(--mut);font-size:.72rem}
body.haspanel .stage{padding-right:350px}

.tabs{background:var(--sheet);border-top:1px solid var(--rule)}.tabs a,.tabs button{color:var(--mut)}.tabs [aria-current]{color:var(--acc);font-weight:700}
@media(min-width:861px){.tabs{display:none}}
@media(max-width:860px){.top{padding:0 12px}.top .nav{display:none}.top .find{width:auto;min-width:0}.top .find kbd{display:none}main{padding:16px 14px 100px}main.wide{padding:0 0 90px}
.app{display:block}.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--rule);padding:14px}.stage{padding:12px}.yrow{grid-template-columns:1fr}
.panel{left:0;right:0;top:auto;bottom:0;width:auto;max-height:62vh;border-left:0;border-top:1px solid var(--rule);padding-bottom:calc(64px + env(safe-area-inset-bottom))}body.haspanel .stage{padding-right:12px}.mv{opacity:1}}
@media print{.top,.side .acts,.side .seg,.side h4,.side .hint,.panel,.board>svg,.addc,.mv,.help,.tabs{display:none!important}.app{display:block}.side{position:static;height:auto;border:0;padding:0 0 8px}.stage{padding:0}body{background:#fff}.year{break-inside:avoid;border-color:#999}.term{background:#fff}.it{break-inside:avoid;opacity:1!important}body.haspanel .stage{padding-right:0}}
`;
