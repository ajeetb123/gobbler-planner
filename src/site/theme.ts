// The site's look (6th pass, Nov 2026): "Blueprint". A degree plan drawn like an engineering drawing:
// a drafting grid behind everything, white line-work on deep cobalt, courses as off-white index cards, a title
// block in the sidebar, mono capitals for labels, and one sharp accent (signal yellow).
// Layout is unchanged from the 5th pass (sidebar, years stacked, terms side by side); only the character is new.
// Appended after CSS in render.ts, so it wins the cascade. Blueprint (dark blue) is the default;
// <html data-theme="light"> is "vellum": the same drawing on pale paper with blue ink.
// Fonts are self-hosted from assets/fonts (open licenses): Bricolage Grotesque (headings), Schibsted Grotesk
// (text), Martian Mono (codes and labels). Never swap in Inter, Roboto, Arial or a system stack as the first choice.

/** Runs in <head> before the page paints, so a saved theme never flashes the other one first. */
export const THEME_JS = `(()=>{try{const t=localStorage.getItem('gobblerplan:theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}})();`;

export const THEME_CSS = `
@font-face{font-family:"Bricolage Grotesque";src:url(fonts/bricolage-grotesque.woff2) format("woff2");font-weight:200 800;font-display:swap}
@font-face{font-family:"Schibsted Grotesk";src:url(fonts/schibsted-grotesk.woff2) format("woff2");font-weight:400 900;font-display:swap}
@font-face{font-family:"Martian Mono";src:url(fonts/martian-mono.woff2) format("woff2");font-weight:100 800;font-display:swap}
:root{--display:"Bricolage Grotesque","Trebuchet MS",sans-serif;--font:"Schibsted Grotesk","Trebuchet MS",sans-serif;--mono:"Martian Mono",ui-monospace,Menlo,monospace;
--field:#0c2f7a;--field2:#092566;--grid:rgba(255,255,255,.07);--grid2:rgba(255,255,255,.16);
--paper:var(--field);--sheet:rgba(255,255,255,.06);--soft:rgba(255,255,255,.12);--lift:#fbf8ee;--ink:#eef3ff;--mut:#a9bdea;--rule:rgba(255,255,255,.34);
--card:#fbf8ee;--cardink:#0e2152;--cardmut:#57689a;--cardrule:#d9d3bf;
--acc:#ffd338;--acc2:#ffd338;--onacc:#0e2152;--ok:#6ff0b0;--okd:#0f7a4b;--bad:#ff7a5c;--badd:#c23a1e;--amber:#ffd338;--warn:rgba(255,211,56,.12);--band:rgba(255,211,56,.18);
--ga:#eef3ff;--gb:#9fb8ff;--gc:#5f80d8;--gd:#3555ac;--gf:#ff9c84;--gw:#7f93c9;--shadow:0 14px 40px rgba(3,12,40,.55);color-scheme:dark}
:root[data-theme=light]{--field:#eef1f6;--field2:#e3e8f1;--grid:rgba(20,62,170,.07);--grid2:rgba(20,62,170,.16);
--sheet:rgba(255,255,255,.75);--soft:rgba(16,40,110,.08);--lift:#fff;--ink:#0e2152;--mut:#566796;--rule:rgba(14,33,82,.34);
--card:#fff;--cardink:#0e2152;--cardmut:#57689a;--cardrule:#cfd6e6;
--acc:#1746d1;--acc2:#1746d1;--onacc:#fff;--ok:#0f7a4b;--okd:#0f7a4b;--bad:#c23a1e;--badd:#c23a1e;--amber:#9a6200;--warn:#fff3c4;--band:rgba(23,70,209,.12);
--ga:#0e2152;--gb:#1746d1;--gc:#8ea6ea;--gd:#cdd8f6;--gf:#e0a48c;--gw:#c5c9d3;--shadow:0 14px 40px rgba(14,33,82,.2);color-scheme:light}
html{background:var(--field)}
body{font-family:var(--font);color:var(--ink);font-size:15px;line-height:1.5;letter-spacing:0;background-color:var(--field);
background-image:linear-gradient(var(--grid2) 1px,transparent 1px),linear-gradient(90deg,var(--grid2) 1px,transparent 1px),linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
background-size:120px 120px,120px 120px,24px 24px,24px 24px;background-attachment:fixed}
h1,h2,h3,.lede,.term h3,.cols h3,.paths b,.brand,.hero h1{font-family:var(--display);letter-spacing:-.01em}
h1{font-size:1.9rem;font-weight:800;line-height:1.05;margin:0 0 .3em}h2{font-family:var(--mono);font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.14em;color:var(--mut);border-top:0;margin:2.4em 0 .7em;padding:0}
h2:before{content:"";display:inline-block;width:26px;height:1px;background:var(--rule);vertical-align:middle;margin-right:10px}
a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--acc);text-decoration-thickness:2px;text-underline-offset:3px}a:hover{color:var(--acc)}.sub{color:var(--mut);margin:0 0 1em}
kbd{font-family:var(--mono);font-size:.62rem;border:1px solid var(--rule);border-radius:2px;padding:1px 5px;color:var(--mut);background:none}
::selection{background:var(--acc);color:var(--onacc)}:focus-visible{outline:2px solid var(--acc);outline-offset:2px;border-radius:2px}

/* top bar */
.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:4px;height:54px;padding:0 18px;background:var(--field2);border-bottom:1px solid var(--rule)}
.top .brand{display:flex;align-items:center;gap:10px;font-family:var(--display);font-weight:800;font-size:1.12rem;color:var(--ink);text-decoration:none;margin-right:22px;white-space:nowrap}
.logo{display:grid;place-items:center;width:26px;height:26px;border-radius:0;background:var(--acc);color:var(--onacc);font-family:var(--display);font-weight:800;font-size:.95rem;box-shadow:3px 3px 0 var(--rule)}
.top .nav{display:flex;flex-direction:row;gap:0;height:100%}.top .nav a{display:flex;align-items:center;padding:0 13px;border:0;border-radius:0;font-family:var(--mono);font-size:.66rem;text-transform:uppercase;letter-spacing:.1em;color:var(--mut);text-decoration:none;position:relative}
.top .nav a:hover{color:var(--ink);background:none}.top .nav a[aria-current]{color:var(--ink);background:none;font-weight:600}.top .nav a[aria-current]:after{content:"";position:absolute;left:13px;right:13px;bottom:0;height:3px;background:var(--acc)}
.grow{flex:1}.top .find{width:210px;display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:0;border:1px solid var(--rule);background:none;color:var(--mut);font-family:var(--mono);font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;cursor:pointer}.top .find:hover{border-color:var(--acc);color:var(--ink)}
.icon{font:inherit;width:32px;height:32px;border-radius:0;border:1px solid var(--rule);background:none;color:var(--ink);cursor:pointer;margin-left:8px}.icon:hover{border-color:var(--acc);color:var(--acc)}
main{max-width:1120px;margin:0 auto;padding:34px 22px 80px}main.wide{max-width:none;padding:0}
footer{font-family:var(--mono);color:var(--mut);font-size:.62rem;line-height:1.8;letter-spacing:.02em;border-top:1px solid var(--rule);margin-top:54px;padding-top:14px;max-width:none}main.wide footer{margin:30px 22px 0;padding-bottom:30px}footer a{color:var(--mut)}
.crumb{display:none}
#pal{background:var(--card);color:var(--cardink);border:2px solid var(--cardink);border-radius:0;box-shadow:8px 8px 0 rgba(3,12,40,.45)}#pal::backdrop{background:rgba(5,16,50,.6)}#pal input{font-family:var(--font);color:var(--cardink)}#pal a{color:var(--cardink);text-decoration:none}#pal .grp,#pal .hint{font-family:var(--mono);font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:var(--cardmut)}

/* shared pieces: line-work, square corners */
.btn,.sel{font-family:var(--mono);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;background:none;border:1px solid var(--rule);border-radius:0;color:var(--ink);padding:8px 11px;cursor:pointer;transition:background .12s,color .12s,border-color .12s}
.sel{font-family:var(--font);font-size:.9rem;text-transform:none;letter-spacing:0;background:var(--sheet)}.sel option{color:#0e2152;background:#fff}
.btn:hover{background:var(--ink);color:var(--field);border-color:var(--ink)}.btn:disabled{opacity:.35;cursor:default}.btn:disabled:hover{background:none;color:var(--ink);border-color:var(--rule)}
.btn.pri{background:var(--acc);border-color:var(--acc);color:var(--onacc);font-weight:700}.btn.pri:hover{background:var(--acc);color:var(--onacc);filter:brightness(1.08)}
.seg{display:inline-flex;background:none;border:1px solid var(--rule);border-radius:0;padding:0;gap:0}.seg button{font-family:var(--mono);font-size:.66rem;letter-spacing:.04em;border:0;border-right:1px solid var(--rule);border-radius:0;padding:8px 10px;color:var(--ink);background:none;cursor:pointer}.seg button:last-child{border-right:0}.seg button:hover{background:var(--soft)}.seg button[aria-pressed=true]{background:var(--acc);color:var(--onacc);font-weight:700}
.note{background:var(--sheet);border:1px solid var(--rule);border-radius:0;padding:11px 14px;font-size:.9rem}.note.warn{background:var(--warn);border:1px dashed var(--acc)}
.tag{display:inline-block;border:1px solid currentColor;border-radius:0;font-family:var(--mono);font-size:.56rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;padding:1px 5px;background:none;color:var(--cardmut);margin:0}.tag.hot{color:var(--badd);background:none}
.flag{color:var(--bad);font-weight:600}.mut{color:var(--mut)}.lnk{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-decoration-color:var(--acc);text-underline-offset:2px}.lnk:hover{color:var(--acc)}
.chips{gap:8px}.chips a,.chips button{font-family:var(--font);font-size:.86rem;background:none;border:1px solid var(--rule);border-radius:0;padding:5px 10px;color:var(--ink);cursor:pointer;text-decoration:none}.chips a:hover,.chips button:hover{background:var(--acc);border-color:var(--acc);color:var(--onacc)}
.lede,.ans{border-left:0;background:var(--card);color:var(--cardink);padding:16px 18px;font-family:var(--display);font-size:1.2rem;font-weight:700;line-height:1.3;border-radius:0;box-shadow:6px 6px 0 var(--acc)}.lede small{display:block;font-family:var(--font);font-weight:400;font-size:.9rem;color:var(--cardmut);margin-top:6px}.ans p{margin:.5em 0;font-family:var(--font);font-size:.95rem;font-weight:400}.ans p:first-child{font-family:var(--display);font-size:1.15rem;font-weight:700}
.hero{padding:26px 0 6px}.hero h1{font-size:clamp(2.6rem,7vw,5rem);font-weight:800;line-height:.95;max-width:14ch;letter-spacing:-.03em}.hero h1 em{font-style:normal;color:var(--onacc);background:var(--acc);padding:0 .12em;box-decoration-break:clone;-webkit-box-decoration-break:clone}.hero p{font-size:1.05rem;color:var(--mut);max-width:56ch;margin:1em 0 0}
.paths{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;border-top:0;margin-top:34px}.paths a,.paths a+a{display:block;border:1px solid var(--rule);border-radius:0;background:var(--sheet);padding:16px 18px;color:var(--ink);text-decoration:none;transition:transform .12s,box-shadow .12s}.paths a:hover{transform:translate(-3px,-3px);box-shadow:6px 6px 0 var(--acc);color:var(--ink)}.paths b{display:block;font-size:1.15rem;font-weight:700;margin-bottom:4px}.paths span{color:var(--mut);font-size:.88rem}
.filter{display:block;width:100%;max-width:560px;padding:12px 14px;font-size:1rem;margin:10px 0;border-color:var(--ink)}
.col{font-family:var(--display);font-size:1.35rem;font-weight:800;color:var(--ink);text-transform:none;letter-spacing:-.01em;margin:2em 0 .4em;padding-bottom:6px;border-bottom:2px solid var(--ink);display:flex;justify-content:space-between;align-items:baseline}.col .mut{font-family:var(--mono);font-weight:400;font-size:.66rem;letter-spacing:.08em}
.majors{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:0 34px;border-top:0}.majors a,.majors button{display:flex;gap:0;align-items:baseline;border:0;border-radius:0;background:none;padding:7px 0;color:var(--ink);font:inherit;text-align:left;cursor:pointer;text-decoration:none;transform:none}
.majors b{display:flex;flex:1;min-width:0;align-items:baseline;font-weight:500;font-size:.92rem}.majors b:after{content:"";flex:1;min-width:18px;border-bottom:1px dotted var(--rule);margin:0 8px;transform:translateY(-3px)}.majors span{font-family:var(--mono);color:var(--mut);font-size:.62rem;letter-spacing:.04em;white-space:nowrap}
.majors a:hover,.majors button:hover{color:var(--acc);background:none;transform:none}.majors a:hover span,.majors button:hover span{color:var(--acc)}.majors [aria-current] b{font-weight:800}.majors .tag{color:var(--acc);margin-right:6px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:22px}.cols section{border:0;border-radius:0;background:var(--card);color:var(--cardink);padding:14px 16px;margin:0}.cols h3{font-size:1.05rem;font-weight:800;margin:0}.cols .mut{color:var(--cardmut)}.cols ul{list-style:none;margin:8px 0 0;padding:0;font-size:.88rem}.cols li{border-top:1px solid var(--cardrule);padding:6px 0}
.ctl{gap:12px;margin:12px 0}.ctl label{font-family:var(--mono);font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:var(--mut)}
.askf{display:flex;gap:0;max-width:720px;margin:20px 0 12px}.askf .sel{flex:1;padding:13px 14px;font-size:1.02rem;cursor:text;border-color:var(--ink);border-right:0}.askf .btn{background:var(--acc);border-color:var(--acc);color:var(--onacc);font-weight:700;padding:0 22px}
.meter{background:none;border:1px solid var(--rule);border-radius:0;height:10px;overflow:hidden}.meter i{display:block;height:100%;background:repeating-linear-gradient(-45deg,var(--acc) 0 6px,transparent 6px 9px);border-radius:0;transition:width .5s ease}
.help{margin:22px 0 0;font-size:.88rem;color:var(--mut);border:0;padding:0;background:none}.help summary{cursor:pointer;font-family:var(--mono);font-size:.66rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink)}.help ul{margin:.6em 0 0;padding-left:1.2em}

/* planner: sidebar (the drawing's title block) + stage */
.app{display:grid;grid-template-columns:310px minmax(0,1fr);min-height:calc(100vh - 54px)}
.side{background:var(--field2);border-right:1px solid var(--rule);padding:20px 18px 24px;position:sticky;top:54px;align-self:start;height:calc(100vh - 54px);overflow:auto}
.side h1{font-size:1.55rem;margin:0 0 6px}.side .sub{font-family:var(--mono);font-size:.62rem;line-height:1.7;letter-spacing:.03em;margin:0 0 16px}
.side h4{font-family:var(--mono);font-size:.6rem;text-transform:uppercase;letter-spacing:.14em;color:var(--mut);margin:20px 0 7px;font-weight:600}
.side .seg{display:flex}.side .seg button{flex:1;padding:8px 0}.acts{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--rule)}.acts .btn{text-align:center;padding:9px 4px;border:0;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}.acts .btn:nth-child(2n){border-right:0}.acts .btn:nth-last-child(-n+2){border-bottom:0}
.prog{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--mono);font-size:.62rem;letter-spacing:.04em;color:var(--mut);margin-bottom:6px}.prog b{font-family:var(--display);font-size:1.5rem;font-weight:800;color:var(--acc)}
.stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--rule);border-radius:0;margin-top:12px;gap:0}.stat{padding:9px 6px 8px;text-align:left;border:0;border-right:1px solid var(--rule);border-radius:0;background:none;min-width:0}.stat:last-child{border-right:0}.stat b{display:block;font-family:var(--display);font-size:1.25rem;font-weight:800;line-height:1.1}.stat span{font-family:var(--mono);font-size:.5rem;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}.stat.bad b{color:var(--bad)}.stat.good b{color:var(--ok)}
.side #conf{display:block;font-size:.88rem;margin:0}.side .hint{font-size:.82rem;color:var(--mut);margin:12px 0 0;line-height:1.7}.over{display:none}
.stage{padding:22px 24px 34px;min-width:0}.stage .note{margin:0 0 14px}

/* board: each year is a sheet */
.board{position:relative;display:block;overflow:visible;padding:0;gap:0}
.board>svg{position:absolute;left:0;top:0;pointer-events:none;z-index:3}.board path{fill:none;stroke-width:2.5;stroke-dasharray:1400;stroke-dashoffset:1400;animation:ink .55s ease forwards}.board .lp{stroke:var(--acc)}.board .ln{stroke:var(--ok);stroke-width:2}
@keyframes ink{to{stroke-dashoffset:0}}
.year{position:relative;background:none;border:1px solid var(--rule);border-radius:0;margin-bottom:22px;padding:14px 14px 16px}
.year:before,.year:after{content:"";position:absolute;width:9px;height:9px;border:1px solid var(--ink);background:var(--field)}.year:before{left:-5px;top:-5px}.year:after{right:-5px;bottom:-5px}
.year>h2{font-family:var(--mono);font-size:.62rem;font-weight:600;text-transform:uppercase;letter-spacing:.2em;color:var(--mut);margin:0 0 12px;text-align:left}.year>h2:before{content:none}
.yrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.term{flex:none;border:0;border-top:2px solid var(--ink);border-radius:0;background:none;padding:8px 0 0;scroll-margin-top:70px;min-width:0}
.term h3{display:inline;font-family:var(--display);font-size:1.15rem;font-weight:800;margin:0}.term>.mut{display:inline;float:right;font-family:var(--mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;margin:6px 0 0}.term .load{display:none}.term>.flag{clear:both;font-family:var(--mono);font-size:.58rem;text-transform:uppercase;letter-spacing:.06em;color:var(--acc);margin:5px 0 0;font-weight:600}
.term.drop{background:var(--band);outline:2px dashed var(--acc);outline-offset:4px}
.it{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:start;clear:both;border:0;border-left:5px solid var(--c,#8b96b5);border-radius:0;background:var(--card);color:var(--cardink);padding:7px 8px 7px 9px;margin-top:7px;cursor:pointer;box-shadow:none;transition:transform .1s ease,box-shadow .1s ease,opacity .15s}
.it:hover{transform:translate(-2px,-2px);box-shadow:4px 4px 0 rgba(3,12,40,.5);background:var(--card);border-left-color:var(--c,#8b96b5)}
.it .nm{font-size:.84rem;line-height:1.3;color:var(--cardmut)}.it .nm a{font-family:var(--mono);font-weight:700;font-size:.72rem;letter-spacing:.02em;color:var(--cardink);text-decoration:none;margin-right:2px}.it .nm a:hover{text-decoration:underline;text-decoration-color:var(--cardink)}
.it .mut{font-family:var(--mono);font-size:.56rem;letter-spacing:.04em;text-transform:uppercase;color:var(--cardmut);margin-top:3px}.it .flag{font-size:.72rem;margin-top:3px;color:var(--badd)}.it .lnk{font-size:.7rem;color:var(--cardmut);text-decoration-color:var(--cardrule)}.it .lnk:hover{color:var(--cardink)}
.it input{appearance:none;-webkit-appearance:none;width:15px;height:15px;margin:2px 0 0;border:1.5px solid var(--cardink);border-radius:0;background:none;cursor:pointer;display:grid;place-items:center}.it input:checked{background:var(--cardink)}.it input:checked:after{content:"";width:8px;height:4px;border:2px solid var(--card);border-top:0;border-right:0;transform:rotate(-45deg) translateY(-1px)}
.it.done{opacity:.6;background:var(--card)}.it.done .nm,.it.done .nm a{text-decoration:line-through;color:var(--cardmut)}
.mv{display:flex;opacity:0;gap:2px}.it:hover .mv,.it:focus-within .mv,.it.sel .mv{opacity:1}.mv button{font:inherit;width:20px;height:20px;border-radius:0;border:1px solid var(--cardink);background:none;color:var(--cardink);font-size:.62rem;cursor:pointer;padding:0}.mv button:hover{background:var(--cardink);color:var(--card)}.mv button:disabled{opacity:.25}
.it.sel{outline:0;box-shadow:5px 5px 0 var(--acc);transform:translate(-2px,-2px)}.it.pre{outline:3px solid var(--acc);outline-offset:0}.it.post{outline:3px solid var(--ok);outline-offset:0}.it.dim{opacity:.28}
.it.conflict{background:#ffe9e2;box-shadow:inset 0 0 0 2px var(--badd)}
.addc{display:block;width:100%;text-align:center;border:1px dashed var(--rule);border-radius:0;padding:6px;margin-top:8px;color:var(--mut);font-family:var(--mono);font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;background:none;text-decoration:none}.addc:hover{border-color:var(--acc);color:var(--acc)}
.pulse{outline:3px solid var(--bad);outline-offset:2px}

/* first paint: sheets, then cards, slide into place. "boot" is on <body> for the first second only. */
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.hero h1,.hero p,.filter,.col,.paths,.askf{animation:rise .5s cubic-bezier(.2,.7,.2,1) both}.hero p{animation-delay:.08s}.filter,.askf{animation-delay:.16s}
body.boot .side>*{animation:rise .45s cubic-bezier(.2,.7,.2,1) both}body.boot .side>:nth-child(n+3){animation-delay:.06s}body.boot .side>:nth-child(n+5){animation-delay:.12s}body.boot .side>:nth-child(n+7){animation-delay:.18s}
body.boot .year{animation:rise .5s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i,0)*90ms)}body.boot .it{animation:rise .4s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(140ms + var(--i,0)*55ms)}

/* course detail drawer: a spec sheet on card stock */
.panel{position:fixed;right:0;top:54px;bottom:0;width:340px;z-index:30;background:var(--card);color:var(--cardink);border:0;border-left:2px solid var(--cardink);border-radius:0;box-shadow:var(--shadow);padding:20px 18px;overflow:auto;animation:slidein .22s cubic-bezier(.2,.7,.2,1)}
@keyframes slidein{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
.panel h3{margin:0 34px 8px 0;font-size:1.5rem;font-weight:800;line-height:1.05}.panel .code{display:inline-block;font-family:var(--mono);font-size:.66rem;font-weight:700;letter-spacing:.06em;color:#fff;background:var(--c,#57689a);border:0;padding:3px 7px;margin-bottom:8px}
.panel .x{position:absolute;right:12px;top:12px;margin:0;border-color:var(--cardink);color:var(--cardink)}.panel .x:hover{background:var(--cardink);color:var(--card);border-color:var(--cardink)}
.panel h4{margin:18px 0 5px;font-family:var(--mono);font-size:.56rem;text-transform:uppercase;letter-spacing:.14em;color:var(--cardmut);font-weight:600;border-top:1px solid var(--cardrule);padding-top:10px}
.panel p{margin:0;font-size:.9rem}.panel .flag{color:var(--badd)}.panel ul{list-style:none;margin:0;padding:0;font-size:.86rem}.panel li{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px dotted var(--cardrule)}.panel li:first-child{border-top:0}.panel li span{font-family:var(--mono);font-size:.58rem;letter-spacing:.04em;color:var(--cardmut);white-space:nowrap;padding-top:3px}.panel li.late span{color:var(--badd)}
.panel .lnk{text-align:left;color:var(--cardink);text-decoration-color:var(--cardrule)}.panel .lnk:hover{color:var(--cardink);text-decoration-color:var(--cardink)}
.panel .row{display:flex;gap:0;margin-top:4px}.panel .row .sel{flex:1;min-width:0;color:var(--cardink);background:#fff;border-color:var(--cardink);border-right:0}.panel .btn{color:var(--cardink);border-color:var(--cardink)}.panel .btn:hover{background:var(--cardink);color:var(--card)}.panel .btn.pri{background:var(--cardink);color:var(--card);border-color:var(--cardink)}
.pills{display:flex;gap:6px;flex-wrap:wrap;font-family:var(--mono);font-size:.56rem;text-transform:uppercase;letter-spacing:.08em;color:var(--cardmut)}.pills span{border:1px solid var(--cardrule);padding:2px 6px}
.links{display:block;margin-top:0}.links a{display:flex;justify-content:space-between;align-items:center;border:0;border-top:1px dotted var(--cardrule);border-radius:0;padding:8px 0;font-size:.9rem;font-weight:600;background:none;color:var(--cardink);text-decoration:none}.links a:first-child{border-top:0}.links a:hover span{transform:translate(2px,-2px)}.links a span{transition:transform .12s}.links small{font-family:var(--mono);font-weight:400;color:var(--cardmut);font-size:.56rem;letter-spacing:.03em}
body.haspanel .stage{padding-right:364px}

.tabs{background:var(--field2);border-top:1px solid var(--rule)}.tabs a,.tabs button{font-family:var(--mono);font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);text-decoration:none}.tabs [aria-current]{color:var(--acc);font-weight:700}
@media(min-width:861px){.tabs{display:none}}
@media(max-width:860px){.top{padding:0 12px}.top .nav{display:none}.top .find{width:auto;min-width:0}.top .find kbd{display:none}main{padding:22px 16px 100px}main.wide{padding:0 0 90px}
.app{display:block}.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--rule);padding:16px}.stage{padding:16px 14px}.yrow{grid-template-columns:1fr}.majors{grid-template-columns:1fr}
.panel{left:0;right:0;top:auto;bottom:0;width:auto;max-height:64vh;border-left:0;border-top:2px solid var(--cardink);padding-bottom:calc(66px + env(safe-area-inset-bottom));animation:slideup .22s cubic-bezier(.2,.7,.2,1)}body.haspanel .stage{padding-right:14px}.mv{opacity:1}}
@keyframes slideup{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}.board path{stroke-dashoffset:0}}
@media print{.top,.side .acts,.side .seg,.side h4,.side .hint,.panel,.board>svg,.addc,.mv,.help,.tabs{display:none!important}:root{--field:#fff;--field2:#fff;--ink:#000;--mut:#444;--rule:#999;--grid:transparent;--grid2:transparent}body{background:#fff}.app{display:block}.side{position:static;height:auto;border:0;padding:0 0 8px}.stage{padding:0}.year{break-inside:avoid}.year:before,.year:after{display:none}.it{break-inside:avoid;opacity:1!important;border:1px solid #999;border-left-width:5px}body.haspanel .stage{padding-right:0}}
`;
