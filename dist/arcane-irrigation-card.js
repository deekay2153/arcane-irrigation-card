/* Arcane Irrigation Card for Home Assistant
   https://github.com/deekay2153/arcane-irrigation-card  ·  MIT licence

   "Glass at night": frosted panels under a living sky. One custom element, no dependencies.
   The sky follows the weather, the sprinklers spray while a yard waters, and each yard can take a
   ready-made picture (lawn, garden beds, fences, shed, letterbox).

   Everything comes from the card config. With only `zones:` it is a plain "tap a yard, water it"
   card that turns the switch or valve on and off. Add helpers and scripts and it grows a schedule,
   a season picker, rain rules, a queue and a Start now button. Tap a yard's name for its last
   7 days (running / idle / offline), read from the recorder history of its switch or valve. */
const VERSION = '1.1.0';
// Ready-made yard pictures (zones[i].scene). A zone's own `layout` list still wins for the plants.
//   plants: what grows (lawn = sprayed grass, else drip beds: hedge, rosebed, grasstree, lime/lemon/orange tree)
//   props:  what stands around it; path: what is laid across the lawn
const SCENES = {
  front_grass: { label: 'Front grass', plants: ['lawn'], props: ['picket', 'letterbox'], path: 'path' },
  back_grass: { label: 'Back grass', plants: ['lawn'], props: ['paling', 'shed'] },
  side_grass: { label: 'Side grass', plants: ['lawn'], props: ['paling'], path: 'stones' },
  front_garden: { label: 'Front garden', plants: ['hedge', 'rosebed', 'hedge'], props: ['picket', 'letterbox'] },
  back_garden: { label: 'Back garden', plants: ['lemon', 'hedge', 'lime'], props: ['paling'] },
  side_garden: { label: 'Side garden', plants: ['hedge', 'grasstree'], props: ['paling'] },
};
const PLANTS = ['lawn', 'hedge', 'rosebed', 'grasstree', 'lime', 'lemon', 'orange'];
const PROPS = {
  picket: '<div class="prop fence picket"></div>',
  paling: '<div class="prop fence paling"></div>',
  shed: '<div class="prop shed"><i></i></div>',
  letterbox: '<div class="prop lbox"><i></i></div>',
};
const MAX_ZONES = 4;
// History sheet. A drop shorter than BLIP_MS that hits every yard within TOGETHER_MS of each other
// is Home Assistant's side (integration reload, network), not the yard, so it is shown apart.
const HIST_DAYS = 7, BLIP_MS = 120e3, TOGETHER_MS = 10e3;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HICO = '<svg class="hico" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 8H12v5l4.28 2.54.72-1.21-3.5-2.08V8M13 3a9 9 0 0 0-9 9H1l3.96 4.03L9 12H6a7 7 0 1 1 2.06 4.94l-1.42 1.42A8.96 8.96 0 0 0 13 21a9 9 0 0 0 0-18"/></svg>';
const CSS = `
:host{display:block;--ink:#f4f7fb;--text:#dce3ec;--muted:#93a2b5;--accent:#62c8f5;--ok:#7fd9a8;--warn:#f2cb66;--danger:#ff8f85;
--surface:rgba(255,255,255,.06);--line:rgba(255,255,255,.11);--ease:cubic-bezier(.22,1,.36,1);
font:15px/1.45 -apple-system,"SF Pro Text","Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;color:var(--text)}
*{box-sizing:border-box}button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.root{position:relative;background:#070b11;overflow:hidden;display:flex;flex-direction:column}
.root.full{min-height:calc(100vh - 56px)}
.glow{position:absolute;inset:-20%;pointer-events:none;filter:blur(70px);opacity:.55}
.glow i{position:absolute;border-radius:50%;animation:drift 26s ease-in-out infinite alternate}
.glow i:nth-child(1){left:8%;top:38%;width:38%;height:44%;background:#0f5f8f}
.glow i:nth-child(2){right:4%;top:48%;width:34%;height:40%;background:#14705a;animation-duration:34s;animation-delay:-9s}
@keyframes drift{to{transform:translate(6%,-8%) scale(1.15)}}
/* ---------- scene */
.scene{position:relative;height:clamp(336px,44vh,440px);flex:none;overflow:hidden;transition:background 2.4s var(--ease)}
.sky{position:absolute;inset:0;transition:opacity 2.4s var(--ease)}
.sky.day{background:linear-gradient(180deg,#2b78c5 0%,#63aee6 52%,#bfe0ef 100%)}
.sky.dusk{background:linear-gradient(180deg,#1b2a55 0%,#7a4e8a 55%,#f0a070 100%)}
.sky.night{background:linear-gradient(180deg,#04070f 0%,#0b1630 60%,#16294a 100%)}
.sky.wet{background:linear-gradient(180deg,#141c28 0%,#2a3a4d 55%,#4a6076 100%)}
.sky{opacity:0}.sky.on{opacity:1}
.orb{position:absolute;right:11%;top:13%;width:92px;height:92px;border-radius:50%;transition:all 2.4s var(--ease);
background:radial-gradient(circle at 40% 38%,#fff8d8,#ffd772 60%,#ffb347);box-shadow:0 0 90px 30px rgba(255,205,110,.5)}
.orb.moon{background:radial-gradient(circle at 36% 34%,#fbfdff,#cfd9ea 62%,#9fb0c9);box-shadow:0 0 70px 16px rgba(170,195,235,.3)}
.orb.hid{opacity:0;transform:translateY(60px) scale(.7)}
.cloud{position:absolute;height:74px;border-radius:60px;background:rgba(255,255,255,.2);filter:blur(13px);animation:float linear infinite;opacity:0;transition:opacity 2.4s}
.cloud.on{opacity:1}.wetsky .cloud{background:rgba(190,205,225,.26)}
.cloud:nth-of-type(1){top:9%;width:36%;animation-duration:95s}
.cloud:nth-of-type(2){top:24%;width:27%;animation-duration:130s;animation-delay:-50s}
.cloud:nth-of-type(3){top:3%;width:44%;animation-duration:160s;animation-delay:-100s}
@keyframes float{from{transform:translateX(-60vw)}to{transform:translateX(120vw)}}
.haze{position:absolute;left:0;right:0;bottom:0;height:62%;background:linear-gradient(180deg,transparent,rgba(7,11,17,.5) 55%,#070b11)}
canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
.head{position:absolute;left:clamp(20px,3.4vw,44px);top:clamp(18px,3vh,34px);right:42%;z-index:2}
.eyebrow{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.78);font-weight:600}
h1{margin:.3em 0 .16em;font:600 clamp(32px,4.6vw,58px)/1.04 -apple-system,"SF Pro Display","Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;
letter-spacing:-.022em;color:#fff;text-shadow:0 2px 26px rgba(0,0,0,.4);text-wrap:balance}
.sub{font-size:clamp(15px,1.5vw,18px);color:rgba(255,255,255,.88);max-width:36ch;text-shadow:0 1px 14px rgba(0,0,0,.45)}
.swap{animation:swap .9s var(--ease)}@keyframes swap{from{opacity:0;transform:translateY(14px);filter:blur(6px)}}
.wx{position:absolute;right:clamp(20px,3.4vw,44px);top:clamp(18px,3vh,34px);z-index:2;display:flex;gap:10px;align-items:center}
.chip{padding:8px 14px;border-radius:99px;background:rgba(8,14,22,.38);backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3);
border:1px solid rgba(255,255,255,.16);font-size:13.5px;color:#fff;white-space:nowrap;font-variant-numeric:tabular-nums}
.chip b{font-weight:600}
.autosw{display:flex;align-items:center;gap:10px;padding:6px 8px 6px 14px}
.tog{width:44px;height:26px;border-radius:99px;background:rgba(255,255,255,.2);position:relative;transition:background .5s var(--ease)}
.tog::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .5s var(--ease);box-shadow:0 2px 6px rgba(0,0,0,.4)}
.on>.tog{background:var(--accent)}.on>.tog::after{transform:translateX(18px)}
/* lawns */
.yards{position:absolute;left:clamp(20px,3.4vw,44px);right:clamp(20px,3.4vw,44px);bottom:16px;display:grid;grid-template-columns:repeat(var(--n,2),minmax(0,1fr));gap:clamp(16px,3vw,44px);z-index:1}
.yard{position:relative;height:158px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.yard::before{content:"";position:absolute;inset:-12px -10px -10px;border-radius:24px;border:1px solid rgba(255,224,150,.6);background:radial-gradient(ellipse at 50% 62%,rgba(255,214,120,.3),rgba(255,214,120,.07) 70%);box-shadow:0 0 44px rgba(255,210,120,.3),inset 0 0 26px rgba(255,214,120,.12);opacity:0;transform:scale(.97);transition:opacity .5s var(--ease),transform .5s var(--ease);pointer-events:none}
.yard.sel::before{opacity:1;transform:none}
.yard.sel .pl,.yard.sel .plot{filter:saturate(1.3) brightness(1.2)}
.yard.sel .ylab b{color:#ffe7ad}
.yards.nudge .yard{animation:nudge .6s var(--ease)}@keyframes nudge{40%{transform:scale(1.035)}}
.plot{position:absolute;left:0;right:0;bottom:30px;height:150px;border-radius:30px;transform:perspective(620px) rotateX(58deg);transform-origin:50% 100%;
background:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 2px,transparent 2px 9px),linear-gradient(180deg,#1f7a46,#2f9c58 60%,#3fb56a);
box-shadow:0 30px 40px -18px rgba(0,0,0,.75),inset 0 0 0 1px rgba(255,255,255,.14);transition:filter 1.6s var(--ease),box-shadow 1.6s var(--ease);filter:saturate(.72) brightness(.82)}
.yard.run .plot{filter:saturate(1.25) brightness(1.08);box-shadow:0 30px 40px -18px rgba(0,0,0,.75),0 0 70px 4px rgba(98,200,245,.45),inset 0 0 0 1px rgba(255,255,255,.3)}
.nozzle{position:absolute;left:50%;bottom:74px;width:14px;height:20px;margin-left:-7px;border-radius:4px 4px 2px 2px;background:linear-gradient(90deg,#111921,#55657a 50%,#111921);box-shadow:0 0 0 1px rgba(255,255,255,.18)}
.nozzle::before{content:"";position:absolute;left:-5px;right:-5px;top:-5px;height:7px;border-radius:4px;background:#8fa1b6}
.ylab{position:absolute;left:4px;right:4px;bottom:0;display:flex;justify-content:space-between;align-items:baseline;font-size:13.5px;color:var(--muted)}
.ylab b{color:var(--ink);font-weight:600;font-size:15.5px;margin-right:9px}
.ylab .cd{color:var(--accent);font-weight:600;font-variant-numeric:tabular-nums}
.yname{display:inline-flex;align-items:baseline;padding:4px 11px 4px 4px;margin:-4px 0 -4px -4px;border-radius:99px;transition:background .3s,transform .3s var(--ease)}
.yname:hover{background:rgba(255,255,255,.08)}.yname:active{transform:scale(.95);background:rgba(255,255,255,.12)}
.hico{flex:none;width:15px;height:15px;margin-left:8px;align-self:center;fill:currentColor;opacity:.75}
.bat{font-variant-numeric:tabular-nums;white-space:nowrap}.bat.low{color:var(--danger)}.yard.late .bat{display:none}.ylab>span:first-child{white-space:nowrap}
.zb{margin-left:10px;padding:5px 13px;border-radius:99px;background:rgba(8,14,22,.5);border:1px solid rgba(255,255,255,.24);color:#fff;font-size:13px;font-weight:600;transition:transform .3s var(--ease),background .4s}
.zb:active{transform:scale(.92)}.zb.arm{background:var(--warn);color:#1b1404;border-color:transparent}.zb.halt{background:rgba(255,120,110,.3);border-color:rgba(255,143,133,.7)}
.bedrow{position:absolute;left:0;right:0;bottom:30px;display:flex;align-items:flex-end}
.it{display:flex;flex-direction:column;justify-content:flex-end;min-width:0}.it.hedge{flex:1}.it.tree{flex:none;width:88px}
.pl{position:relative;height:98px;display:flex;align-items:flex-end;justify-content:center;transition:filter 1.6s var(--ease);filter:saturate(.8) brightness(.86)}
.yard.run .pl{filter:saturate(1.2) brightness(1.06)}
.bush{width:100%;height:66px;background:radial-gradient(circle at 21px 24px,#3aa35c 5px,transparent 6px) 0 0/42px 100% repeat-x,radial-gradient(circle at 21px 24px,#2c8a4b 21px,transparent 22px) 0 0/42px 100% repeat-x,linear-gradient(180deg,#2c8a4b,#1c6537) 0 24px/100% 100% no-repeat}
.canopy{position:absolute;bottom:26px;left:50%;width:74px;height:74px;margin-left:-37px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--fruit) 4px,transparent 5px),radial-gradient(circle at 64% 44%,var(--fruit) 4px,transparent 5px),radial-gradient(circle at 42% 68%,var(--fruit) 4px,transparent 5px),radial-gradient(circle at 74% 72%,var(--fruit) 3.5px,transparent 4.5px),radial-gradient(circle at 38% 34%,#3fae63,#1f6f3c 70%)}
.trunk{width:9px;height:30px;border-radius:3px;background:linear-gradient(90deg,#4a3323,#7a573b,#4a3323)}
.mist{position:absolute;bottom:0;left:calc(50% + 14px);width:3px;height:13px;background:#9fb0c4;border-radius:2px}
.soil{position:relative;height:42px;background:linear-gradient(180deg,#4d3826,#2a1d13);border-top:4px solid #3d9a56;overflow:hidden}
.it:first-child .soil{border-radius:0 0 0 14px}.it:last-child .soil{border-radius:0 0 14px 0}.it:only-child .soil{border-radius:0 0 14px 14px}
.soil::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,rgba(98,200,245,.5),transparent 72%);opacity:0;transition:opacity 9s linear}
.yard.run .soil::after{opacity:1}
.it:first-child .drip{left:6px}.it:last-child .drip{right:6px}
.drip{position:absolute;left:0;right:0;height:4px;background:repeating-linear-gradient(90deg,#9a8468 0 3px,#17110c 3px 28px)}
.drip:nth-child(1){top:9px}.drip:nth-child(2){top:23px}
.yard.run .drip{background:repeating-linear-gradient(90deg,#e8f8ff 0 3px,#2a9fe0 3px 28px);box-shadow:0 0 10px rgba(98,200,245,.8);animation:flow 1.6s linear infinite}
@keyframes flow{to{background-position:28px 0}}
.it.rbed{flex:none;width:158px}
.lowbed{width:100%;height:30px;background:radial-gradient(circle at 15px 13px,#c03c58 9px,transparent 10px) 0 0/46px 100% repeat-x,radial-gradient(circle at 15px 17px,#2f8a4d 15px,transparent 16px) 0 0/30px 100% repeat-x,linear-gradient(180deg,#2f8a4d,#1f6a3a) 0 17px/100% 100% no-repeat}
.std{position:absolute;bottom:22px;left:27%;width:3px;height:42px;background:#8d7c68;border-radius:2px}.std.b{left:73%}
.std::after{content:"";position:absolute;left:-18px;bottom:36px;width:39px;height:39px;border-radius:50%;background:radial-gradient(circle at 50% 50%,#fff 3.5px,transparent 4.5px),radial-gradient(circle at 50% 21%,#fff 3.5px,transparent 4.5px),radial-gradient(circle at 75% 36%,#fff 3.5px,transparent 4.5px),radial-gradient(circle at 75% 65%,#fff 3.5px,transparent 4.5px),radial-gradient(circle at 50% 79%,#fff 3.5px,transparent 4.5px),radial-gradient(circle at 25% 65%,#fff 3.5px,transparent 4.5px),radial-gradient(circle at 25% 36%,#fff 3.5px,transparent 4.5px),radial-gradient(circle at 40% 34%,#3c9a58,#1d6537 72%)}
.it.gtree{flex:none;width:128px}
.fan{position:absolute;bottom:-22px;left:50%;width:136px;height:136px;margin-left:-68px;border-radius:50%;background:repeating-conic-gradient(#c3e6d2 0 1.3deg,transparent 1.3deg 4deg);-webkit-mask:radial-gradient(circle,#000 0 46%,rgba(0,0,0,.6) 62%,transparent 71%);mask:radial-gradient(circle,#000 0 46%,rgba(0,0,0,.6) 62%,transparent 71%);clip-path:polygon(0 0,100% 0,100% 70%,50% 52%,0 70%)}
.gtrunk{width:20px;height:46px;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,#a8926a 0 36%,#15120f 36%)}
.shrub{position:absolute;bottom:0;width:30px;height:21px;border-radius:50% 50% 38% 38%}
.shrub.s1{left:calc(50% - 46px);background:radial-gradient(circle at 50% 20%,#c8405a,#3a8f52 75%)}.shrub.s2{left:calc(50% + 16px);background:radial-gradient(circle at 50% 20%,#c9ec62,#3a8f52 80%)}
/* scene props (fences, shed, letterbox, paths) */
.prop{position:absolute;pointer-events:none;transition:filter 1.6s var(--ease);filter:saturate(.8) brightness(.82)}
.yard.run .prop{filter:none}
.fence{left:2%;right:2%}
.lawny .fence{bottom:100px}.bedy .fence{bottom:70px}
.picket{height:30px;background:linear-gradient(180deg,transparent 9px,#cfd6de 9px 12px,transparent 12px 21px,#cfd6de 21px 24px,transparent 24px),repeating-linear-gradient(90deg,#eef2f6 0 7px,transparent 7px 17px);border-radius:3px 3px 0 0;opacity:.9}
.picket::before{content:"";position:absolute;left:0;right:0;top:-5px;height:6px;background:radial-gradient(circle at 3.5px 6px,#eef2f6 3.5px,transparent 4px) 0 0/17px 100% repeat-x}
.paling{height:58px;background:linear-gradient(180deg,#8a6a4c 0 4px,transparent 4px),repeating-linear-gradient(90deg,#6e5038 0 13px,#4e3826 13px 15px);border-radius:2px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.bedy .paling{height:76px}
.shed{right:7%;bottom:104px;width:64px;height:44px;background:repeating-linear-gradient(90deg,#9aa7b4 0 5px,#7d8a98 5px 7px);border-radius:2px}
.shed::before{content:"";position:absolute;left:-6px;right:-6px;top:-14px;height:16px;background:#5d6874;clip-path:polygon(8% 0,92% 0,100% 100%,0 100%)}
.shed i{position:absolute;left:22px;bottom:0;width:18px;height:28px;background:#59646f;border-radius:2px 2px 0 0}
.lbox{right:6px;bottom:30px;width:4px;height:34px;background:#5a4632;z-index:1}
.bedy .lbox{bottom:72px;right:12px}
.lbox i{position:absolute;left:-9px;top:-11px;width:22px;height:14px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#d4473f,#a5302a)}
.sc-side .plot{left:12%;right:12%}
.plot.path::after,.plot.stones::after{content:"";position:absolute;top:0;bottom:0;left:20%;width:13%;border-radius:4px}
.plot.path::after{background:repeating-linear-gradient(180deg,#c9c1b2 0 22px,rgba(0,0,0,.25) 22px 25px);opacity:.85}
.plot.stones::after{left:44%;background:radial-gradient(ellipse 48% 38% at 50% 50%,#bdb5a6 96%,transparent) 0 0/100% 34px repeat-y;opacity:.9}
.plot.stones~.nozzle{left:28%}
/* ---------- panels */
.grid{position:relative;z-index:1;flex:1;display:grid;grid-template-columns:1.12fr 1fr 1.12fr;gap:16px;padding:8px clamp(20px,3.4vw,44px) 12px}
.grid.p2{grid-template-columns:1fr 1fr}.grid.p1{grid-template-columns:minmax(0,560px);justify-content:center;align-items:start}
.acts .btn.wide{grid-column:1/-1}
.pane{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:18px 20px 16px;backdrop-filter:blur(22px) saturate(1.35);-webkit-backdrop-filter:blur(22px) saturate(1.35);
box-shadow:0 22px 44px -30px #000;animation:rise 1s var(--ease) backwards}
.yard.nent .zb{display:none}
.pane:nth-child(2){animation-delay:.09s}.pane:nth-child(3){animation-delay:.18s}
@keyframes rise{from{opacity:0;transform:translateY(26px)}}
h2{margin:0 0 10px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);font-weight:600}
.row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid rgba(255,255,255,.07);min-height:54px}
.row:first-of-type{border-top:0}
.dot{flex:none;width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.2);transition:all .8s var(--ease)}
.dot.ok{background:var(--ok);box-shadow:0 0 14px var(--ok)}.dot.skip{background:var(--accent);box-shadow:0 0 14px var(--accent)}
.dot.bad{background:var(--danger);box-shadow:0 0 14px var(--danger)}.dot.next{background:#fff;box-shadow:0 0 0 5px rgba(255,255,255,.14);animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{50%{box-shadow:0 0 0 10px rgba(255,255,255,0)}}
.row .t{flex:none;width:86px;font:600 19px/1 -apple-system,"SF Pro Display","Segoe UI Variable Display",system-ui,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums;text-align:left;padding:8px 0}
.row .d{flex:1;min-width:0}.row .d b{display:block;color:var(--ink);font-weight:600}.row .d span{display:block;color:var(--muted);font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row.off .t,.row.off .d b{color:var(--muted)}
.seg{position:relative;display:grid;grid-template-columns:repeat(var(--k,3),minmax(0,1fr));background:rgba(0,0,0,.28);border-radius:14px;padding:4px;margin-bottom:14px}
.seg i{position:absolute;top:4px;bottom:4px;left:4px;width:calc((100% - 8px)/var(--k,3));border-radius:11px;background:rgba(98,200,245,.22);box-shadow:inset 0 0 0 1px rgba(98,200,245,.55);transition:transform .7s var(--ease)}
.seg button{position:relative;padding:11px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--muted);transition:color .4s}.seg button.on{color:#fff}
.step{display:flex;align-items:center;justify-content:space-between;padding:6px 0 14px}
.step .lab{color:var(--muted)}.step .v{font:600 30px/1 -apple-system,"SF Pro Display",system-ui,sans-serif;color:var(--ink);min-width:86px;text-align:center;font-variant-numeric:tabular-nums}
.step .v small{font-size:14px;color:var(--muted);font-weight:500}
.pm{display:flex;align-items:center;gap:4px}
.rb{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid var(--line);font-size:21px;line-height:1;color:var(--ink);transition:transform .25s var(--ease),background .25s}
.rb:active{transform:scale(.86);background:rgba(255,255,255,.2)}
.acts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{padding:15px 10px;border-radius:15px;font-weight:600;background:rgba(255,255,255,.08);border:1px solid var(--line);color:var(--ink);transition:transform .3s var(--ease),background .4s,box-shadow .4s}
.btn:active{transform:scale(.95)}
.btn.go{grid-column:1/-1;font-size:17px;padding:18px;background:linear-gradient(135deg,#2a9fe0,#62c8f5);color:#04121d;border:0;box-shadow:0 14px 34px -14px rgba(98,200,245,.9)}
.btn.go small{display:block;margin-top:3px;font-size:13px;font-weight:500;opacity:.78}
.btn.go.none{background:rgba(255,255,255,.08);border:1px solid var(--line);color:var(--muted);box-shadow:none}
.btn.stop{grid-column:1/-1;font-size:17px;padding:18px;background:rgba(255,120,110,.2);border-color:rgba(255,143,133,.6);color:#ffd9d5}
.rule{padding:9px 0 12px;border-top:1px solid rgba(255,255,255,.07)}.rule:first-of-type{border-top:0;padding-top:2px}
.rule .top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.rule .top b{color:var(--ink);font-weight:600}.rule .now{font:600 21px/1 -apple-system,"SF Pro Display",system-ui,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums}
.bar{position:relative;height:10px;border-radius:99px;background:rgba(255,255,255,.09);margin:10px 0 8px}
.bar u{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#3d8fc4,#62c8f5);transition:width 1.4s var(--ease),background .8s;min-width:10px}
.bar.hit u{background:linear-gradient(90deg,#62c8f5,#b9ecff);box-shadow:0 0 18px rgba(98,200,245,.8)}
.bar s{position:absolute;top:-5px;bottom:-5px;width:3px;margin-left:-1px;border-radius:2px;background:#fff;transition:left .7s var(--ease)}
.rule .bot{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:13.5px}
.rule .rb{width:32px;height:32px;font-size:18px}
.foot{position:relative;z-index:1;display:flex;justify-content:space-between;gap:18px;padding:0 clamp(24px,3.6vw,48px) 16px;color:var(--muted);font-size:13.5px}
.foot span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hold{color:var(--warn)}
/* ---------- history sheet */
.hs{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:72px 24px 24px}
.hs[hidden]{display:none}
.hs-bg{position:absolute;inset:0;background:rgba(3,6,10,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:fade .4s var(--ease);touch-action:none}
@keyframes fade{from{opacity:0}}
.hs-card{position:relative;width:min(640px,100%);max-height:100%;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent;
background:linear-gradient(180deg,rgba(22,32,46,.94),rgba(10,15,22,.96));border:1px solid rgba(255,255,255,.13);border-radius:26px;padding:22px 24px 20px;
box-shadow:0 50px 100px -40px #000,inset 0 1px 0 rgba(255,255,255,.08);animation:rise .6s var(--ease)}
.hs-top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
.hs-x{flex:none;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid var(--line);font-size:24px;line-height:1;color:var(--ink);transition:transform .25s var(--ease)}
.hs-x:active{transform:scale(.88)}
h3{margin:.35em 0 .12em;font:600 26px/1.15 -apple-system,"SF Pro Display","Segoe UI Variable Display","Segoe UI",system-ui,sans-serif;letter-spacing:-.015em;color:#fff}
.hs-since{color:var(--muted);font-size:14px}
.seg.two{margin:16px 0 0}
.hsum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0 18px}
.tile{min-width:0;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:16px;padding:12px 14px 11px}
.tile .k{display:flex;align-items:center;gap:7px;font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);font-weight:600;white-space:nowrap}
.tile .v{margin-top:7px;font:600 21px/1.15 -apple-system,"SF Pro Display","Segoe UI Variable Display",system-ui,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.tile .s{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kd{flex:none;display:inline-block;width:9px;height:9px;border-radius:50%}
.kd.run{background:var(--accent);box-shadow:0 0 10px var(--accent)}.kd.idle{background:#8796a8}
.kd.off{background:var(--danger);box-shadow:0 0 10px var(--danger)}.kd.blip{background:rgba(255,143,133,.4)}
.hdays{display:grid;gap:2px}
.hd,.hax{display:grid;grid-template-columns:84px 1fr 58px;align-items:center;gap:12px}
.hd{width:100%;padding:8px 10px;border-radius:12px;text-align:left;transition:background .3s}
.hd:hover{background:rgba(255,255,255,.04)}
.hd.on{background:rgba(98,200,245,.1);box-shadow:inset 0 0 0 1px rgba(98,200,245,.35)}
.hd .dl{font-size:13.5px;font-weight:600;color:var(--muted);white-space:nowrap}.hd.on .dl{color:var(--ink)}
.hd .dm{font-size:13px;color:var(--accent);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.hd .dm.z{color:rgba(255,255,255,.25)}
.strip{position:relative;height:14px;border-radius:7px;overflow:hidden;background:repeating-linear-gradient(90deg,transparent 0 calc(25% - 1px),rgba(255,255,255,.09) calc(25% - 1px) 25%),rgba(255,255,255,.035)}
.strip i{position:absolute;top:0;bottom:0}
.strip i.idle{background:rgba(150,170,195,.24)}
.strip i.run{background:linear-gradient(180deg,#a6e3ff,var(--accent));box-shadow:0 0 12px rgba(98,200,245,.9);min-width:3px;border-radius:2px;z-index:1}
.strip i.off{background:var(--danger);min-width:3px;border-radius:2px;z-index:1}
.strip i.blip{background:rgba(255,143,133,.5);min-width:1px}
.strip b{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 8px #fff;z-index:2}
.hax{padding:0 10px;height:16px;margin-bottom:2px}.hax span{position:relative;grid-column:2;height:100%}
.hax em{position:absolute;top:0;font-style:normal;font-size:11.5px;line-height:16px;color:var(--muted);transform:translateX(-50%);white-space:nowrap}
.hax em:first-child{transform:none}.hax em:last-child{transform:translateX(-100%)}
h4{margin:20px 0 2px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);font-weight:600}
.ev{list-style:none;margin:0;padding:0}
.ev li{display:grid;grid-template-columns:10px 84px 1fr;gap:12px;align-items:baseline;padding:11px 2px;border-top:1px solid rgba(255,255,255,.07)}
.ev li:first-child{border-top:0}
.ev .kd{align-self:center}
.ev .tm{font:600 17px/1.2 -apple-system,"SF Pro Display","Segoe UI Variable Display",system-ui,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.ev .tm small{display:block;font-size:12px;font-weight:500;line-height:1.3;color:var(--muted)}
.ev .tx{min-width:0}.ev .tx b{display:block;color:var(--ink);font-weight:600}.ev .tx span{display:block;color:var(--muted);font-size:13.5px}
.ev li.blip .tm,.ev li.blip .tx b{color:var(--muted);font-weight:500}
.ev li.none{display:block;color:var(--muted);padding:12px 2px}
.hbat{margin:-4px 0 18px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:16px;padding:12px 14px 8px}
.hbat:empty{display:none}
.hbat .bt{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.hbat .bt .k{font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);font-weight:600;white-space:nowrap}
.hbat .bt b{font:600 17px/1.2 -apple-system,"SF Pro Display","Segoe UI Variable Display",system-ui,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums}
.hbat .bt span{font-size:13px;color:var(--muted)}.hbat .bt .low{color:var(--danger)}
.hbat svg{display:block;width:100%;height:64px;margin-top:8px;overflow:visible}
.hbat .ax{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-top:4px}
.hs-note{margin:12px 2px 0;color:var(--muted);font-size:13px;line-height:1.5}
@keyframes sheet{from{transform:translateY(40%);opacity:0}}
@media (max-width:900px){.grid,.grid.p1,.grid.p2{grid-template-columns:1fr}.head{right:8%}.wx{top:auto;bottom:160px;left:20px;right:auto}.yards{gap:14px}
.many .scene{height:auto;display:flex;flex-direction:column;gap:16px;padding:24px 20px 22px}.many .head{position:relative;left:auto;top:auto;right:auto;margin-right:110px}
.many .wx{position:relative;left:auto;right:auto;top:auto;bottom:auto;flex-wrap:wrap}.many .yards{position:relative;left:auto;right:auto;bottom:auto;grid-template-columns:1fr 1fr;row-gap:34px;margin-top:22px}}
@media (max-width:600px){
.scene{height:auto;display:flex;flex-direction:column;gap:16px;padding:24px 18px 22px}
.head{position:relative;left:auto;top:auto;right:auto;margin-right:72px}
.orb{width:60px;height:60px;top:22px;right:18px}
h1{font-size:34px}.sub{font-size:16px}
.wx{position:relative;left:auto;right:auto;top:auto;bottom:auto;flex-wrap:wrap}
.chip{font-size:14.5px;padding:10px 16px}.autosw{padding:7px 9px 7px 16px}
.yards,.many .yards{position:relative;left:auto;right:auto;bottom:auto;grid-template-columns:1fr;gap:34px;margin:22px 4px 0}
.many .head{margin-right:72px}
.yard{height:178px}.plot,.bedrow{bottom:46px}.nozzle{bottom:90px}
.ylab{align-items:center;font-size:15px;left:2px;right:2px}.ylab b{font-size:18px}
.zb{padding:9px 18px;font-size:15px;margin-left:12px}
.grid{gap:14px;padding:14px 14px 14px}
.pane{padding:22px 20px 20px}.pane.ctl{order:-1}
h2{font-size:13px;margin-bottom:14px}
.row{min-height:66px;padding:14px 0}.row .t{font-size:21px;width:96px}.row .d b{font-size:16.5px}.row .d span{font-size:14.5px;white-space:normal}
.seg button{padding:14px 0}.step{padding:10px 0 18px}
.rb{width:48px;height:48px;font-size:24px}.rule .rb{width:42px;height:42px;font-size:21px}
.acts{gap:12px}.btn{padding:18px 10px;font-size:16px}.btn.go,.btn.stop{padding:20px;font-size:18px}
.rule{padding:14px 0 16px}.rule .bot{font-size:14.5px}
.foot{flex-direction:column;gap:6px;padding:4px 22px 22px;font-size:14px}.foot span:first-child{white-space:normal}
.hico{width:18px;height:18px;margin-left:6px}.yname{padding-right:8px}.ylab>span:first-child{display:flex;align-items:center;min-width:0}
.zb{padding:9px 15px;margin-left:6px}
.ylab{gap:8px}.ylab>span:first-child{flex:1 1 auto}.yname{display:flex;flex:0 1 auto;min-width:0}.yname b{flex:none}
.yname>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.zb{flex:none}.yard.run .bat{display:none}
.hs{align-items:flex-end;padding:0}
.hs-card{width:100%;max-height:90vh;max-height:90dvh;border-radius:26px 26px 0 0;padding:20px 16px calc(22px + env(safe-area-inset-bottom));animation:sheet .55s var(--ease)}
h3{font-size:24px}
.hsum{gap:8px}.tile{padding:11px 11px 10px}.tile .v{font-size:18px}.tile .k{font-size:10.5px;letter-spacing:.1em;gap:6px}.tile .s{font-size:12.5px;white-space:normal;line-height:1.3;margin-top:2px}
.hax em:first-child,.hax em:last-child{display:none}
.hd,.hax{grid-template-columns:70px 1fr 48px;gap:10px}.hd{padding:9px 8px}.hax{padding:0 8px}
.strip{height:16px;border-radius:8px}.hd .dm{font-size:12.5px}
.ev li{grid-template-columns:10px 76px 1fr;gap:10px}.ev .tx span{font-size:14px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
const FRUIT = { lime: '#b9e04a', lemon: '#ffe45c', orange: '#ffa63d' };
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const PLANT_HTML = k => k === 'hedge' ? '<div class="it hedge"><div class="pl"><div class="bush"></div></div><div class="soil"><i class="drip"></i><i class="drip"></i></div></div>'
  : k === 'rosebed' ? '<div class="it rbed"><div class="pl"><i class="std"></i><i class="std b"></i><div class="lowbed"></div></div><div class="soil"><i class="drip"></i><i class="drip"></i></div></div>'
  : k === 'grasstree' ? '<div class="it gtree"><div class="pl"><i class="fan"></i><i class="gtrunk"></i><i class="shrub s1"></i><i class="shrub s2"></i></div><div class="soil"><i class="drip"></i><i class="drip"></i></div></div>'
  : `<div class="it tree"><div class="pl" style="--fruit:${FRUIT[k] || 'transparent'}"><i class="canopy"></i><i class="trunk"></i><i class="mist"></i></div><div class="soil"></div></div>`;
const YARD_HTML = (z, i) => {
  const sc = SCENES[z.scene], lay = (Array.isArray(z.layout) && z.layout.length ? z.layout : sc ? sc.plants : ['lawn']).filter(k => PLANTS.includes(k));
  const lawn = !lay.length || lay[0] === 'lawn', side = /^side/.test(z.scene || '');
  return `<div class="yard ${lawn ? 'lawny' : 'bedy'}${side ? ' sc-side' : ''}${z.sw ? '' : ' nent'}" data-z="${i}" data-a="sel" data-y="${i}">${sc ? sc.props.map(k => PROPS[k]).join('') : ''}${lawn ? `<div class="plot${sc && sc.path ? ' ' + sc.path : ''}"></div><div class="nozzle"></div>` : `<div class="bedrow">${lay.map(PLANT_HTML).join('')}</div>`}
    <div class="ylab"><span><button class="yname" data-a="hist" data-y="${i}" aria-label="${esc(z.n)} history"><b>${esc(z.n)}</b><span data-k="zs${i}"></span>${HICO}</button><button class="zb" data-a="zone" data-y="${i}"></button></span><span class="bat" data-k="zb${i}"></span></div></div>`;
};
const HTML = (E, seasons) => {
  const panes = [];
  if (E.times.length) panes.push(`<section class="pane"><h2>Today</h2>${E.times.map((s, i) => `<div class="row" data-r="${i}"><i class="dot"></i><button class="t" data-a="more" data-e="${esc(s.entity || '')}"></button><div class="d"><b></b><span></span></div></div>`).join('')}</section>`);
  const skipBtn = E.skip || (E.hold && E.resume), two = skipBtn && E.hold;
  panes.push(`<section class="pane ctl"><h2>${seasons.length ? 'Season' : 'Water'}</h2>${seasons.length ? `<div class="seg" style="--k:${seasons.length}"><i></i>${seasons.map(s => `<button data-a="season" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
    ${E.mins ? `<div class="step"><span class="lab">Per yard</span><span class="pm"><button class="rb" data-a="mins" data-v="-1" aria-label="Fewer minutes">&minus;</button><span class="v" data-k="mins"></span><button class="rb" data-a="mins" data-v="1" aria-label="More minutes">+</button></span></div>` : ''}
    <div class="acts"><button class="btn go" data-a="go"></button><button class="btn stop" data-a="stop" hidden>Stop watering</button>
    ${skipBtn ? `<button class="btn${two ? '' : ' wide'}" data-a="skip"${E.skip ? '' : ' hidden'}>Skip today</button>` : ''}${E.hold ? `<button class="btn${two ? '' : ' wide'}" data-a="more" data-e="${esc(E.hold)}">Hold until&hellip;</button>` : ''}</div></section>`);
  if (E.rules.length) panes.push(`<section class="pane"><h2>Rain rules</h2>${E.rules.map((r, i) => `<div class="rule" data-u="${i}"><div class="top"><b>${esc(r.label)}</b><span class="now"></span></div>
    <div class="bar"><u></u><s></s></div><div class="bot"><span class="say"></span>${r.thr ? `<span class="pm"><button class="rb" data-a="thr" data-u="${i}" data-v="-1" aria-label="Lower">&minus;</button><button class="rb" data-a="thr" data-u="${i}" data-v="1" aria-label="Raise">+</button></span>` : ''}</div></div>`).join('')}</section>`);
  return `
<div class="root${E.full ? ' full' : ''}${E.zones.length > 2 ? ' many' : ''}"><div class="glow"><i></i><i></i></div>
<div class="scene">
  <div class="sky day" data-sky="day"></div><div class="sky dusk" data-sky="dusk"></div><div class="sky night" data-sky="night"></div><div class="sky wet" data-sky="wet"></div>
  <div class="orb" data-k="orb"></div><div class="cloud"></div><div class="cloud"></div><div class="cloud"></div>
  <div class="haze"></div><canvas></canvas>
  <div class="head"><div class="eyebrow" data-k="eyebrow"></div><h1 data-k="h1"></h1><div class="sub" data-k="sub"></div></div>
  <div class="wx">${E.wx || E.tmax ? '<span class="chip" data-k="wx"></span>' : ''}${E.auto ? '<button class="chip autosw" data-a="auto"><span>Automatic</span><span class="tog"></span></button>' : ''}</div>
  <div class="yards" style="--n:${E.zones.length}">${E.zones.map(YARD_HTML).join('')}</div>
</div>
<div class="grid p${panes.length}">${panes.join('')}</div>
${E.log || E.hold ? '<div class="foot"><span data-k="last"></span><span data-k="hold"></span></div>' : ''}</div>
<div class="hs" data-k="hs" hidden><div class="hs-bg" data-a="hclose"></div>
<section class="hs-card" role="dialog" aria-modal="true" aria-label="Yard history">
  <div class="hs-top"><div><div class="eyebrow">History · last ${HIST_DAYS} days</div><h3 data-k="ht"></h3><div class="hs-since" data-k="hsince"></div></div>
  <button class="hs-x" data-a="hclose" aria-label="Close">&times;</button></div>
  ${E.zones.length > 1 ? `<div class="seg two" style="--k:${E.zones.length}"><i></i>${E.zones.map((z, i) => `<button data-a="hyard" data-y="${i}">${esc(z.n)}</button>`).join('')}</div>` : ''}
  <div class="hsum" data-k="hsum"></div>
  <div class="hbat" data-k="hbat"></div>
  <div class="hdays" data-k="hdays"></div>
  <h4 data-k="hdl"></h4><ul class="ev" data-k="hev"></ul>
  <p class="hs-note" data-k="hnote"></p>
</section></div>`;
};

const hhmm = t => { const m = /(\d{1,2}):(\d\d)/.exec(String(t == null ? '' : t)); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
const clock = v => { const t = hhmm(v); if (!t) return '--'; let h = +t.slice(0, 2), m = t.slice(3, 5); return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`; };
const hm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const tfmt = t => { const d = new Date(t), h = d.getHours(); return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const dur = ms => {
  const s = Math.round(ms / 1000); if (s < 60) return `${s} s`;
  const m = Math.round(s / 60); if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
  return `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ''}`;
};
const durShort = ms => { const m = Math.round(ms / 6e4); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; };
const dayStart = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const OFFLINE = s => s === undefined || s === 'unavailable' || s === 'unknown';
// zone state -> run | idle | off (switch on/off, valve open/closed)
const ZK = s => s === 'on' || s === 'open' || s === 'opening' ? 'run' : s === 'off' || s === 'closed' || s === 'closing' ? 'idle' : 'off';

// Card config -> one flat object the card reads. Every entity is optional except a zone's switch/valve.
const normConfig = c => {
  const scripts = c.scripts || {};
  return {
    title: c.title || 'Irrigation',
    full: c.full_height !== false,
    zones: (Array.isArray(c.zones) ? c.zones : []).map(z => typeof z === 'string' ? { entity: z } : z).filter(z => z && typeof z === 'object').slice(0, MAX_ZONES).map((z, i) => ({
      name: z.name != null && z.name !== '' ? String(z.name) : undefined, n: z.name != null && z.name !== '' ? String(z.name) : `Zone ${i + 1}`, sw: z.entity || z.switch || z.valve || '', rem: z.remaining, bat: z.battery, st: z.status, scene: z.scene, layout: z.layout,
    })),
    wx: c.weather, sun: c.sun || 'sun.sun', tmax: c.max_temp,
    auto: c.automatic, season: c.season, mins: c.minutes,
    times: (Array.isArray(c.times) ? c.times : []).filter(t => t && typeof t === 'object').map((t, i) => ({ name: t.name != null && t.name !== '' ? String(t.name) : `Run ${i + 1}`, entity: t.entity, time: t.time != null ? String(t.time) : undefined })),
    next: c.next_run, verdict: c.verdict, reason: c.reason, log: c.log, hold: c.hold, queue: c.queue,
    run: scripts.run, stop: scripts.stop, skip: scripts.skip, resume: scripts.resume, startNow: scripts.start_now,
    rules: (Array.isArray(c.rain_rules) ? c.rain_rules : []).filter(r => r && r.sensor).map(r => ({ label: r.name != null ? String(r.name) : 'Rain', val: r.sensor, thr: r.threshold, unit: r.unit, max: +r.max || 0 })),
  };
};

class ArcaneIrrigationCard extends HTMLElement {
  setConfig(c) {
    if (!c || !Array.isArray(c.zones) || !c.zones.length) throw new Error('Add at least one zone under `zones:` (each with an `entity:` switch or valve).');
    this._c = c; this._E = normConfig(c);
    if (this._built) { this._render(); if (this._h) this._update(); }
  }
  getCardSize() { return 12; }
  getGridOptions() { return { columns: 'full', min_columns: 6 }; }
  static getStubConfig(hass) {
    const ids = Object.keys((hass && hass.states) || {}), pick = ids.filter(id => /^(switch|valve)\./.test(id) && /irrigat|sprinkl|water|zone|valve|garden|lawn/.test(id)).slice(0, 2);
    const looks = ['back_grass', 'front_garden'];
    return { zones: (pick.length ? pick : ['']).map((entity, i) => ({ entity, scene: looks[i] })) };
  }
  static getConfigElement() { return document.createElement('arcane-irrigation-card-editor'); }
  connectedCallback() { this._live = true; if (this._built) { cancelAnimationFrame(this._raf); this._loop(); } }
  disconnectedCallback() { this._live = false; cancelAnimationFrame(this._raf); if (this._built) this._hClose(); }
  set hass(h) { this._h = h; if (!this._built) this._build(); else if (this._needNames()) this._render(); this._update(); }

  _s(id) { if (!id) return undefined; const s = this._h.states[id]; return s ? s.state : undefined; }
  _n(id, d = 0) { const v = parseFloat(this._s(id)); return isNaN(v) ? d : v; }
  _a(id, k) { const s = id && this._h.states[id]; return s && s.attributes ? s.attributes[k] : undefined; }
  _q(k) { return this._root.querySelector(`[data-k="${k}"]`); }
  _text(el, v, swap) { if (!el) return; if (el.textContent !== v) { el.textContent = v; if (swap) { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); } } }
  // a zone without a `name` takes its entity's friendly name once hass has it
  _names() { return this._E.zones.map(z => z.name || (this._h && this._a(z.sw, 'friendly_name')) || z.n).join('|'); }
  _needNames() { return this._names() !== this._namesAt; }

  _build() {
    this._built = true;
    this._root = this.attachShadow({ mode: 'open' });
    this._root.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) this._act(b, e); });
    this._still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._render();
    if (this.isConnected) { this._live = true; cancelAnimationFrame(this._raf); this._loop(); }
  }
  _render() {
    if (this._hy != null) this._hClose();
    const E = this._E;
    if (this._h) E.zones.forEach(z => { if (!z.name) z.n = this._a(z.sw, 'friendly_name') || z.n; });
    this._namesAt = this._names();
    const opts = this._h && this._a(E.season, 'options');
    this._seasons = Array.isArray(opts) ? opts.slice(0, 4) : [];
    this._root.innerHTML = `<style>${CSS}</style>${HTML(E, this._seasons)}`;
    this._cv = this._root.querySelector('canvas'); this._ctx = this._cv.getContext('2d');
    this._rain = []; this._spray = []; this._seep = []; this._burst = []; this._sel = new Set(); this._running = E.zones.map(() => false);
    this._stars = Array.from({ length: 60 }, () => [Math.random(), Math.random() * .62, Math.random() * 6.28, .5 + Math.random()]);
    this._rem = E.zones.map(() => ({ v: 0, at: 0, src: null, end: 0 }));
    this._hist = {}; this._histFor = null; this._seasonsFor = JSON.stringify(opts || null);
  }

  _call(dom, svc, data) { return this._h.callService(dom, svc, data); }
  _script(id, variables) { return this._call('script', 'turn_on', variables ? { entity_id: id, variables } : { entity_id: id }); }
  // switch / valve / anything else, straight on or off
  _zoneSet(i, on) {
    const id = this._E.zones[i].sw, dom = id.split('.')[0];
    if (dom === 'valve') return this._call('valve', on ? 'open_valve' : 'close_valve', { entity_id: id });
    if (dom === 'switch' || dom === 'input_boolean') return this._call(dom, on ? 'turn_on' : 'turn_off', { entity_id: id });
    return this._call('homeassistant', on ? 'turn_on' : 'turn_off', { entity_id: id });
  }
  _stopAll() {
    if (this._E.stop) return this._script(this._E.stop);
    this._running.forEach((on, i) => { if (on) this._zoneSet(i, false); });
  }
  _act(b) {
    const E = this._E, a = b.dataset.a, v = b.dataset.v;
    if (a === 'hist') this._hOpen(+b.dataset.y);
    else if (a === 'hclose') this._hClose();
    else if (a === 'hyard') { this._hy = +b.dataset.y; this._hRender(); }
    else if (a === 'hday') { this._hd = +b.dataset.d; this._hRender(); }
    else if (a === 'auto') this._call('input_boolean', 'toggle', { entity_id: E.auto });
    else if (a === 'season') this._call(E.season.split('.')[0], 'select_option', { entity_id: E.season, option: v });
    else if (a === 'mins') {
      const lo = +this._a(E.mins, 'min') || 1, hi = +this._a(E.mins, 'max') || 60, st = +this._a(E.mins, 'step') || 1;
      this._call(E.mins.split('.')[0], 'set_value', { entity_id: E.mins, value: Math.min(hi, Math.max(lo, this._n(E.mins, lo) + v * st)) });
    }
    else if (a === 'thr') {
      const r = E.rules[+b.dataset.u], lo = +this._a(r.thr, 'min') || 0, hi = this._a(r.thr, 'max') != null ? +this._a(r.thr, 'max') : 100, st = +this._a(r.thr, 'step') || 1;
      this._call(r.thr.split('.')[0], 'set_value', { entity_id: r.thr, value: Math.min(hi, Math.max(lo, this._n(r.thr, lo) + v * st)) });
    }
    else if (a === 'more') { if (b.dataset.e) this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: b.dataset.e } })); }
    else if (a === 'stop') this._stopAll();
    else if (a === 'skip') this._script(this._held && E.resume ? E.resume : E.skip);
    else if (a === 'zone' || a === 'sel') {
      // Tap a yard to light it up (or put it out); Water now then runs whatever is lit.
      const i = +b.dataset.y, zi = E.zones[i]; if (!zi.sw || (!this._running[i] && (OFFLINE(this._s(zi.sw)) || (zi.st && OFFLINE(this._s(zi.st)))))) return;
      if (this._running[i]) { if (a === 'zone') { if (E.stop && this._running.filter(Boolean).length === 1) this._script(E.stop); else this._zoneSet(i, false); } return; }
      // While another yard waters, this yard's button is Start now (runs it alongside, out of the queue).
      if (this._running.some(Boolean)) {
        if (a === 'zone') { b.disabled = true; Promise.resolve(E.startNow ? this._script(E.startNow, { zone: E.zones[i].sw }) : this._zoneSet(i, true)).finally(() => setTimeout(() => { b.disabled = false; }, 4000)); }
        return;
      }
      this._sel.has(i) ? this._sel.delete(i) : this._sel.add(i);
      clearTimeout(this._selT); this._selT = setTimeout(() => { this._sel.clear(); this._update(); }, 60000);
      this._update();
    }
    else if (a === 'go') {
      const pick = [...this._sel].sort();
      if (!pick.length) { const y = this._root.querySelector('.yards'); y.classList.remove('nudge'); void y.offsetWidth; y.classList.add('nudge'); if (y.getBoundingClientRect().bottom < 60) y.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if (E.run) this._script(E.run, { zones: pick.map(i => E.zones[i].sw), ...(E.mins ? { minutes: this._n(E.mins) } : {}) });
      else pick.forEach(i => this._zoneSet(i, true));
      this._sel.clear(); clearTimeout(this._selT);
      const r = this._root.querySelector('.root').getBoundingClientRect(), q = b.getBoundingClientRect();
      this._boom(q.left + q.width / 2 - r.left, q.top - r.top); this._update();
    }
  }

  _boom(x, y) {
    if (this._still) return;
    const root = this._root.querySelector('.root'), r = root.getBoundingClientRect();
    if (this._bx) this._bx.remove();
    this._bx = document.createElement('canvas'); // full-card burst layer, removed when spent
    Object.assign(this._bx.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: 5, pointerEvents: 'none' });
    this._bx.width = r.width; this._bx.height = r.height; root.appendChild(this._bx);
    this._burst = Array.from({ length: 130 }, () => { const a = -Math.PI * Math.random(), v = 5 + Math.random() * 15; return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, r: 2 + Math.random() * 5, l: 1 }; });
  }

  // seconds left on a zone, from a number sensor (s / min / h, by its unit) or a timestamp sensor (end time)
  _readRem(i) {
    const z = this._E.zones[i], st = z.rem && this._h.states[z.rem], r = this._rem[i];
    if (!st) { r.at = 0; return; }
    if (st.last_updated === r.src) return;
    r.src = st.last_updated;
    const v = parseFloat(st.state), ts = Date.parse(st.state);
    if (isNaN(+st.state) && !isNaN(ts)) { r.end = ts; r.at = Date.now(); return; }
    if (isNaN(v)) { r.at = 0; return; }
    const u = String((st.attributes || {}).unit_of_measurement || 's').toLowerCase();
    r.end = 0; r.v = v * (u.startsWith('h') ? 3600 : u.startsWith('m') && u !== 'ms' ? 60 : 1); r.at = Date.now();
  }
  _left(i) { const r = this._rem[i]; if (!r.at) return null; return Math.max(0, r.end ? (r.end - Date.now()) / 1000 : r.v - (Date.now() - r.at) / 1000); }

  _update() {
    const h = this._h, E = this._E; if (!h) return;
    const opts = this._a(E.season, 'options');
    if (JSON.stringify(opts || null) !== this._seasonsFor) { this._render(); }
    const season = this._s(E.season), autoS = this._s(E.auto), auto = E.auto && !OFFLINE(autoS) ? autoS === 'on' : null, verdict = this._s(E.verdict);
    const reason = (this._s(E.reason) || '').replace(/^(Skip|Water)\s*:\s*/i, '');
    const water = verdict === undefined ? null : /^(water|on|true|yes)/i.test(verdict);
    const running = E.zones.map(z => ZK(this._s(z.sw)) === 'run'), any = running.some(Boolean);
    this._running = running; if (any) this._sel.clear();
    E.zones.forEach((z, i) => this._readRem(i));
    // sky
    const wx = this._s(E.wx) || '', wet = /rain|pour|lightning|hail|snow/.test(wx), sunSt = this._s(E.sun);
    const hr = new Date().getHours(), night = sunSt ? sunSt === 'below_horizon' : (hr >= 20 || hr < 6);
    const sky = wet ? 'wet' : night ? 'night' : (hr >= 17 || hr < 7) ? 'dusk' : 'day';
    this._root.querySelectorAll('.sky').forEach(el => el.classList.toggle('on', el.dataset.sky === sky));
    this._root.querySelector('.scene').classList.toggle('wetsky', wet);
    const orb = this._q('orb'); orb.classList.toggle('moon', night); orb.classList.toggle('hid', wet);
    const cloudy = wet || /cloud|fog/.test(wx);
    this._root.querySelectorAll('.cloud').forEach((c, i) => c.classList.toggle('on', cloudy || (i === 0 && !night)));
    this._wet = wet ? (/pour|lightning/.test(wx) ? 1 : .6) : 0; this._night = night && !wet;
    // header
    const mins = E.mins ? this._n(E.mins, 0) : 0, nx = this._s(E.next), nd = nx && !isNaN(Date.parse(nx)) ? new Date(nx) : null;
    const dd = nd ? Math.round((dayStart(nd) - dayStart(Date.now())) / 864e5) : 0, today = nd && dd === 0;
    const when = nd ? `${clock(hm(nd))}${dd === 0 ? '' : dd === 1 ? ' tomorrow' : ` ${DAYS_LONG[nd.getDay()]}`}` : '';
    // queued yard (a run script waters yards one at a time; the next one waits here) and when it should start
    const qs = (this._s(E.queue) || '').split(':')[0].trim().toLowerCase(), runOn = !E.run || this._s(E.run) === 'on';
    const qi = any && qs && runOn ? E.zones.findIndex((z, k) => !running[k] && (z.sw.toLowerCase() === qs || z.n.toLowerCase() === qs)) : -1;
    let qeta = '';
    if (qi >= 0) { const left = this._left(running.indexOf(true)); if (left) qeta = clock(hm(new Date(Date.now() + left * 1000))); }
    this._qi = qi;
    let h1, sub;
    const ri = running.indexOf(true), nRun = running.filter(Boolean).length;
    if (any) {
      h1 = nRun > 1 ? `${nRun} yards are watering` : `${E.zones[ri].n} is watering`;
      sub = qi >= 0 ? `${E.zones[qi].n} is up next${qeta ? `, about ${qeta}` : ''}. Tap Start now to run it at the same time.` : this._left(ri) != null ? 'It turns off by itself when the time is up.' : 'Tap Stop when it has had enough.';
    }
    else if (auto === false) { h1 = 'The schedule is off'; sub = 'Nothing waters by itself until Automatic is switched on.'; }
    else if (E.next && !nd) { h1 = 'No run is due'; sub = 'Nothing is scheduled yet.'; }
    else if (nd && (!today || water === null)) { h1 = `Next run ${when}`; sub = reason ? `Right now: ${reason.charAt(0).toLowerCase() + reason.slice(1)}.` : 'Tap a yard, then Water now, to water sooner.'; }
    else if (nd && water) { h1 = `Watering at ${when}`; sub = reason ? `${cap(reason)}.` : 'All set.'; }
    else if (nd) { h1 = `Skipping the ${when} run`; sub = reason ? `${cap(reason)}.` : 'The rain rules say skip.'; }
    else { h1 = 'Ready to water'; sub = `Tap ${E.zones.length > 1 ? 'a yard' : E.zones[0].n}, then Water now.`; }
    this._text(this._q('eyebrow'), `${E.title}${season && !OFFLINE(season) ? ` · ${season}` : ''}`);
    this._text(this._q('h1'), h1, true); this._text(this._q('sub'), sub, true);
    const wc = this._q('wx');
    if (wc) {
      const tm = this._s(E.tmax), tok = tm !== undefined && !isNaN(parseFloat(tm)), tu = this._a(E.tmax, 'unit_of_measurement');
      const sig = wx + '|' + tm;
      if (wc.dataset.s !== sig) {
        wc.dataset.s = sig; wc.innerHTML = '';
        wc.append(...[E.wx ? (wx && !OFFLINE(wx) ? cap(wx.replace(/-/g, ' ')) : 'Weather') : '', tok ? `${E.wx ? ' · ' : ''}max ` : '', tok ? Object.assign(document.createElement('b'), { textContent: `${Math.round(parseFloat(tm))}°${tu === '°F' ? 'F' : ''}` }) : ''].filter(Boolean));
      }
    }
    const asw = this._root.querySelector('.autosw'); if (asw) asw.classList.toggle('on', !!auto);
    // yards
    E.zones.forEach((z, i) => {
      const y = this._root.querySelector(`.yard[data-z="${i}"]`); y.classList.toggle('run', running[i]); const sel = this._sel.has(i); y.classList.toggle('sel', sel);
      const off = !z.sw || OFFLINE(this._s(z.sw)) || (z.st && OFFLINE(this._s(z.st)));
      const zb = y.querySelector('.zb'), late = any && !running[i]; y.classList.toggle('late', late);
      this._text(zb, running[i] ? 'Stop' : late ? '▶ Start now' : sel ? '✓ Selected' : 'Select');
      zb.className = 'zb' + (running[i] ? ' halt' : late || sel ? ' arm' : ''); zb.hidden = !running[i] && off;
      const zs = this._q('zs' + i);
      if (!running[i]) { zs.className = i === qi ? 'cd' : ''; this._text(zs, !z.sw ? 'Pick a switch' : off ? 'Offline' : i === qi ? (qeta ? `Next · ${qeta}` : 'Up next') : 'Idle'); }
      const bt = this._n(z.bat, NaN), bel = this._q('zb' + i); this._text(bel, isNaN(bt) ? '' : `Battery ${Math.round(bt)}%`); bel.classList.toggle('low', bt < 25);
    });
    // today
    if (E.times.length) {
      const nowHM = hm(new Date());
      let nextMarked = false;
      E.times.forEach((tc, i) => {
        const row = this._root.querySelector(`[data-r="${i}"]`), t = hhmm(tc.entity ? this._s(tc.entity) : tc.time), dot = row.querySelector('.dot');
        const ok5 = !!t, past = ok5 && t <= nowHM, rec = this._hist[tc.name];
        let cls = '', s = '';
        if (!ok5) s = 'No time set';
        else if (past) {
          if (rec) {
            cls = /skip/i.test(rec) ? 'skip' : /not start|did not|didn.t|fail|error/i.test(rec) ? 'bad' : 'ok';
            s = cls === 'skip' ? `Skipped${(rec.split(/skip\s*:\s*/i)[1] || '') ? `: ${rec.split(/skip\s*:\s*/i)[1]}` : ''}` : cls === 'bad' ? 'A yard did not start' : `Watered${mins ? `, ${mins} min each yard` : ''}`;
          } else s = 'Earlier today';
        } else if (auto === false) s = 'Schedule is off';
        else if (!nextMarked) { nextMarked = true; cls = 'next'; s = water === false ? 'Up next, will skip as it stands' : `Up next${mins ? `, ${mins} min each yard` : ''}`; }
        else s = 'Later today';
        dot.className = 'dot ' + cls;
        this._text(row.querySelector('.t'), clock(t)); this._text(row.querySelector('b'), tc.name); this._text(row.querySelector('span'), s);
      });
    }
    const last = this._s(E.log) || '';
    if (E.log && E.times.length && last !== this._histFor) { this._histFor = last; this._loadHist(); }
    // controls
    if (this._seasons.length) {
      const si = Math.max(0, this._seasons.indexOf(season));
      this._root.querySelector('.pane .seg i').style.transform = `translateX(${si * 100}%)`;
      this._root.querySelectorAll('[data-a="season"]').forEach(b => b.classList.toggle('on', b.dataset.v === season));
    }
    const mv = this._q('mins'); if (mv && mv.dataset.v !== String(mins)) { mv.dataset.v = mins; mv.innerHTML = `${mins}<small> min</small>`; }
    const go = this._root.querySelector('.go'), pick = [...this._sel].sort(), each = mins ? ` · ${mins} min${pick.length > 1 ? ' each' : ''}` : '';
    const names = E.zones.map(z => z.n), list = names.length > 2 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names.join(' or ');
    const gs = pick.length ? (pick.length === E.zones.length && E.zones.length > 1 ? `${E.zones.length === 2 ? 'Both yards' : `All ${E.zones.length} yards`}${each}` : `${pick.map(i => names[i]).join(' + ')}${each}`) : `Tap ${list} first`;
    if (go.dataset.s !== gs) { go.dataset.s = gs; go.innerHTML = 'Water now<small></small>'; go.lastChild.textContent = gs; }
    go.classList.toggle('none', !pick.length);
    go.hidden = any; this._root.querySelector('.stop').hidden = !any;
    const hd = this._s(E.hold), held = !!hd && /^\d{4}-\d\d-\d\d/.test(hd) && hd.slice(0, 10) >= new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    this._held = held;
    const skb = this._root.querySelector('[data-a="skip"]'); if (skb) { this._text(skb, held && E.resume ? 'Clear the hold' : 'Skip today'); skb.hidden = !E.skip && !(held && E.resume); }
    const hel = this._q('hold');
    if (hel) { this._text(hel, held ? `On hold through ${new Date(+hd.slice(0, 4), +hd.slice(5, 7) - 1, +hd.slice(8, 10)).toLocaleDateString()}` : ''); hel.className = held ? 'hold' : ''; }
    // rain rules
    E.rules.forEach((r, i) => {
      const el = this._root.querySelector(`.rule[data-u="${i}"]`), raw = this._s(r.val) || '';
      const unit = r.unit != null ? r.unit : (this._a(r.val, 'unit_of_measurement') || ''), sp = unit && unit !== '%' ? ' ' : '';
      const val = parseFloat(raw.replace(/[–—]/g, '-').split(/-(?=\d)/).pop()), thr = r.thr ? this._n(r.thr, NaN) : NaN, ok = !isNaN(val);
      const max = r.max || (unit === '%' ? 100 : Math.max(10, (isNaN(thr) ? 0 : thr) * 2.5, ok ? val : 0));
      this._text(el.querySelector('.now'), ok ? `${/[–—-]/.test(raw.trim().slice(1)) ? raw : Math.round(val * 10) / 10}${sp}${unit}` : 'No reading');
      el.querySelector('u').style.width = `${ok ? Math.min(100, val / max * 100) : 0}%`;
      const mark = el.querySelector('s'); mark.hidden = isNaN(thr); if (!isNaN(thr)) mark.style.left = `${Math.min(100, thr / max * 100)}%`;
      el.querySelector('.bar').classList.toggle('hit', ok && !isNaN(thr) && val >= thr);
      this._text(el.querySelector('.say'), isNaN(thr) ? '' : `Skips from ${Math.round(thr * 10) / 10}${sp}${unit}`);
    });
    this._text(this._q('last'), E.log ? (last && !OFFLINE(last) ? `Last: ${last}` : 'Nothing logged yet') : '');
    // history sheet: reload only when a yard's switch changes (hass arrives many times a second)
    if (this._hy != null) { const sig = this._hSigNow(); if (sig !== this._hSig) { this._hSig = sig; this._hLoad(); } }
  }

  // ---------- history sheet: when each yard ran, sat idle or was offline, last 7 days
  _hSigNow() { return this._E.zones.map(z => { const s = z.sw && this._h.states[z.sw]; return s ? s.state + s.last_changed : ''; }).join('|'); }
  _hOpen(i) {
    if (!this._E.zones[i].sw) return;
    this._hy = i; this._hd = 0; this._hData = null; this._hSig = this._hSigNow();
    this._q('hs').hidden = false;
    if (!this._hKey) this._hKey = e => { if (e.key === 'Escape') this._hClose(); };
    document.addEventListener('keydown', this._hKey);
    clearInterval(this._hTick); this._hTick = setInterval(() => this._hRender(), 60000);
    this._hRender(); this._hLoad();
  }
  _hClose() {
    clearInterval(this._hTick); if (this._hKey) document.removeEventListener('keydown', this._hKey);
    if (this._hy == null) return;
    this._hy = null; this._hSeq = (this._hSeq || 0) + 1; const hs = this._q('hs'); if (hs) hs.hidden = true;
  }
  _hDays(now) { const n = new Date(now); return Array.from({ length: HIST_DAYS }, (_, d) => ({ ds: new Date(n.getFullYear(), n.getMonth(), n.getDate() - d).getTime(), de: new Date(n.getFullYear(), n.getMonth(), n.getDate() - d + 1).getTime() })); }
  async _hLoad() {
    const seq = this._hSeq = (this._hSeq || 0) + 1, from = this._hDays(Date.now())[HIST_DAYS - 1].ds, ids = [...new Set(this._E.zones.flatMap(z => [z.sw, z.bat]).filter(Boolean))];
    try {
      const res = await this._h.callWS({ type: 'history/history_during_period', start_time: new Date(from).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      if (seq === this._hSeq) this._hData = { from, rows: this._E.zones.map(z => (z.sw && res[z.sw]) || []), bats: this._E.zones.map(z => z.bat ? this._hBat(res[z.bat] || []) : null) };
    } catch (e) { if (seq === this._hSeq) this._hData = { err: true }; }
    if (seq === this._hSeq) this._hRender();
  }
  // battery rows -> [{t, v}] readings, numbers only (unavailable while offline is skipped)
  _hBat(rows) {
    return rows.map(x => { const s = x.s !== undefined ? x.s : x.state, ts = x.lu || x.lc; return { t: ts ? ts * 1000 : Date.parse(x.last_updated || x.last_changed), v: parseFloat(s) }; })
      .filter(p => !isNaN(p.v) && !isNaN(p.t)).sort((a, b) => a.t - b.t);
  }
  // last battery reading at or before t (else the first one after)
  _batAt(pts, t) { if (!pts || !pts.length) return null; let v = pts[0].v; for (const p of pts) { if (p.t > t) break; v = p.v; } return v; }
  // the battery panel: a 7-day line, offline stretches shaded behind it
  _hBatHtml(pts, sg, from, now, cur) {
    if (!pts) return '';
    if (!pts.length) return `<div class="bt"><span class="k">Battery</span><span>No readings in the last ${HIST_DAYS} days</span></div>`;
    const W = 700, H = 64, x = t => ((Math.max(from, t) - from) / (now - from) * W).toFixed(1), y = v => (H - Math.max(0, Math.min(100, v)) / 100 * H).toFixed(1);
    let d = `M${x(pts[0].t)} ${y(pts[0].v)}`;
    pts.forEach((p, j) => { if (j) d += ` H${x(p.t)} V${y(p.v)}`; });
    d += ` H${W}`;
    const offs = sg.filter(g => g.k === 'off').map(g => `<rect x="${x(g.a)}" y="0" width="${Math.max(1.5, x(g.b) - x(g.a))}" height="${H}" fill="rgba(255,143,133,.28)"/>`).join('');
    const last = pts[pts.length - 1].v, lo = Math.min(...pts.map(p => p.v)), first = pts[0].v;
    const trend = lo === last && first === last ? `Steady all week` : first > last ? `Down from ${Math.round(first)}%` : `Lowest ${Math.round(lo)}%`;
    return `<div class="bt"><span class="k">Battery</span><span><b class="${last < 25 ? 'low' : ''}">${Math.round(last)}%</b> ${cur ? 'now' : 'last reading'} · ${trend}</span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Battery over the last ${HIST_DAYS} days">${offs}
      <line x1="0" x2="${W}" y1="${y(25)}" y2="${y(25)}" stroke="rgba(255,143,133,.5)" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/>
      <path d="${d}" fill="none" stroke="var(--ok)" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg>
      <div class="ax"><span>${this._hDayName(from, HIST_DAYS - 1)}</span><span>Red = offline · dashed = 25%</span><span>Now</span></div>`;
  }
  // history rows -> back-to-back spans {k: run|idle|off, a, b, live}
  _hSegs(rows, from, now) {
    const pts = [];
    rows.forEach(x => {
      const s = x.s !== undefined ? x.s : x.state, ts = x.lc || x.lu;
      const t = Math.min(now, Math.max(from, ts ? ts * 1000 : Date.parse(x.last_changed || x.last_updated) || from));
      const k = ZK(s);
      while (pts.length && pts[pts.length - 1].a >= t) pts.pop();
      if (!pts.length || pts[pts.length - 1].k !== k) pts.push({ k, a: t });
    });
    return pts.map((g, j) => ({ ...g, b: j + 1 < pts.length ? pts[j + 1].a : now, live: j + 1 === pts.length }));
  }
  // spans -> the list: runs and drops, idle left out; a short drop inside a run stays one run, with a note
  _hEvents(sg) {
    const ev = [];
    for (let j = 0; j < sg.length; j++) {
      const g = sg[j], last = ev[ev.length - 1], nx = sg[j + 1];
      if (g.k === 'idle') continue;
      if (g.k !== 'run' && g.b - g.a < BLIP_MS && last && last.k === 'run' && last.b === g.a && nx && nx.k === 'run') { last.lost += g.b - g.a; last.b = nx.b; last.live = nx.live; j++; continue; }
      ev.push({ k: g.k, a: g.a, b: g.b, live: g.live, lost: 0 });
    }
    return ev;
  }
  _hWhen(t, ref, rel) {
    const diff = Math.round((dayStart(ref) - dayStart(t)) / 864e5);
    return diff === 0 ? tfmt(t) : rel && diff === 1 ? `yesterday ${tfmt(t)}` : `${DAYS[new Date(t).getDay()]} ${tfmt(t)}`;
  }
  _hDayName(ds, n, long) { const d = new Date(ds); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : long ? `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : `${DAYS[d.getDay()]} ${d.getDate()}`; }
  _hRender() {
    if (this._hy == null || !this._h) return;
    const E = this._E, i = this._hy, z = E.zones[i], now = Date.now(), days = this._hDays(now), st = this._h.states[z.sw], k0 = ZK(st && st.state);
    this._text(this._q('ht'), `${z.n} ${k0 === 'run' ? 'is watering' : k0 === 'idle' ? 'is idle' : 'is offline'}`);
    const lc = st && Date.parse(st.last_changed);
    const bpts = this._hData && this._hData.bats ? this._hData.bats[i] : null, bnow = this._batAt(bpts, lc || now);
    this._text(this._q('hsince'), lc ? `Since ${this._hWhen(lc, now, true)}${k0 === 'off' && bnow != null ? ` · battery read ${Math.round(bnow)}% just before` : ''}` : '');
    const sgi = this._root.querySelector('.seg.two i'); if (sgi) sgi.style.transform = `translateX(${i * 100}%)`;
    this._root.querySelectorAll('[data-a="hyard"]').forEach(b => b.classList.toggle('on', +b.dataset.y === i));
    const { ds, de } = days[this._hd], end = Math.min(de, now), d = this._hData;
    const sum = this._q('hsum'), list = this._q('hdays'), evl = this._q('hev'), note = this._q('hnote');
    this._text(this._q('hdl'), this._hDayName(ds, this._hd, true));
    if (!d || d.err) {
      sum.innerHTML = ''; list.innerHTML = ''; note.textContent = ''; this._q('hbat').innerHTML = '';
      evl.innerHTML = `<li class="none">${d ? 'Couldn’t load the history. Close this and try again.' : 'Loading…'}</li>`;
      return;
    }
    const all = d.rows.map(r => this._hSegs(r, d.from, now)), live = all.filter((o, m) => E.zones[m].sw);
    all.forEach((sg, j) => sg.forEach(g => {
      if (g.k !== 'off' || g.live || g.b - g.a >= BLIP_MS) return;
      if (live.length > 1 && all.every((o, m) => m === j || !E.zones[m].sw || o.some(h => (h.k === 'off' || h.k === 'blip') && Math.abs(h.a - g.a) < TOGETHER_MS))) g.k = 'blip';
    }));
    const sg = all[i], ev = this._hEvents(sg), tot = { run: 0, idle: 0, off: 0, blip: 0 };
    sg.forEach(g => { tot[g.k] += g.b - g.a; });
    const known = tot.run + tot.idle + tot.off + tot.blip, n = k => ev.filter(e => e.k === k).length, runs = n('run'), offs = n('off'), blips = n('blip');
    sum.innerHTML = [
      ['run', 'Running', tot.run ? dur(tot.run) : '0 min', runs ? `${runs} run${runs > 1 ? 's' : ''}` : 'No runs'],
      ['idle', 'Idle', dur(tot.idle), known ? `${Math.round(tot.idle / known * 100)}% of the time` : ''],
      ['off', 'Offline', tot.off ? dur(tot.off) : 'Never', offs ? `${offs} time${offs > 1 ? 's' : ''}` : 'Always in reach'],
    ].map(([k, l, v, t]) => `<div class="tile"><div class="k"><i class="kd ${k}"></i>${l}</div><div class="v">${v}</div><div class="s">${t}</div></div>`).join('');
    this._q('hbat').innerHTML = this._hBatHtml(bpts, sg, d.from, now, k0 !== 'off');
    list.innerHTML = `<div class="hax"><i></i><span>${['12am', '6am', '12pm', '6pm', '12am'].map((l, j) => `<em style="left:${j * 25}%">${l}</em>`).join('')}</span></div>` + days.map((dy, m) => {
      const e2 = Math.min(dy.de, now), span = dy.de - dy.ds; let runMs = 0;
      const bars = sg.filter(g => g.b > dy.ds && g.a < e2).map(g => {
        const a = Math.max(g.a, dy.ds), b = Math.min(g.b, e2); if (g.k === 'run') runMs += b - a;
        return `<i class="${g.k}" style="left:${((a - dy.ds) / span * 100).toFixed(3)}%;width:${((b - a) / span * 100).toFixed(3)}%"></i>`;
      }).join('');
      return `<button class="hd${m === this._hd ? ' on' : ''}" data-a="hday" data-d="${m}"><span class="dl">${this._hDayName(dy.ds, m)}</span><span class="strip">${bars}${m === 0 ? `<b style="left:${((now - dy.ds) / span * 100).toFixed(3)}%"></b>` : ''}</span><span class="dm${runMs ? '' : ' z'}">${runMs ? durShort(runMs) : '–'}</span></button>`;
    }).join('');
    const first = sg.length ? sg[0].a : Infinity, evs = ev.filter(e => e.b > ds && e.a < end);
    if (first >= end) evl.innerHTML = `<li class="none">No record for this day.</li>`;
    else if (!evs.length) evl.innerHTML = `<li class="none">${first > ds ? `Records start at ${tfmt(first)}. Idle since then` : this._hd ? 'Idle all day' : 'Idle so far today'}: no watering, never offline.</li>`;
    else evl.innerHTML = evs.map(e => {
      const len = dur((e.live ? now : e.b) - e.a), until = `Until ${this._hWhen(e.b, e.a)} · ${len}`;
      const [title, detail] = e.k === 'run' ? [e.live ? 'Watering now' : 'Watered', (e.live ? `${len} so far` : until) + (e.lost ? ` · lost contact for ${dur(e.lost)}` : '')]
        : e.k === 'off' ? [e.live ? 'Offline now' : 'Offline', (e.live ? `${len} so far` : until) + (this._batAt(bpts, e.a) != null ? ` · battery ${Math.round(this._batAt(bpts, e.a))}%` : '')]
        : ['Brief drop', `All yards at once, back in ${len}`];
      return `<li class="${e.k}"><i class="kd ${e.k}"></i><span class="tm">${tfmt(e.a)}${e.a < ds ? `<small>${DAYS[new Date(e.a).getDay()]}</small>` : ''}</span><span class="tx"><b>${title}</b><span>${detail}</span></span></li>`;
    }).join('');
    const fd = new Date(first);
    const lastOff = [...ev].reverse().find(e => e.k === 'off'), bOff = lastOff ? this._batAt(bpts, lastOff.a) : null;
    note.textContent = 'Offline means Home Assistant couldn’t reach the controller.'
      + (bOff == null ? '' : bOff >= 25 ? ` The battery read ${Math.round(bOff)}% just before it last went offline, so it was more likely out of reach (signal) than flat.` : ` The battery was low (${Math.round(bOff)}%) just before it last went offline: try fresh batteries first.`)
      + (blips ? ' Brief drops hit every yard at the same moment, so they come from Home Assistant’s side, not the yard, and aren’t counted as offline.' : '')
      + (first > days[HIST_DAYS - 1].ds && first < Infinity ? ` Records for ${z.n} start ${DAYS[fd.getDay()]} ${fd.getDate()} ${MONTHS[fd.getMonth()]}, ${tfmt(first)}.` : '');
  }

  // Today panel: today's entries of the `log` text helper, matched to each run time by name
  // ("Morning run …", "Morning run … skipped. Skip: …", "Morning run … did NOT start").
  async _loadHist() {
    const E = this._E;
    try {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const res = await this._h.callWS({ type: 'history/history_during_period', start_time: d.toISOString(), entity_ids: [E.log], minimal_response: true, no_attributes: true });
      const out = {};
      (res[E.log] || []).forEach(x => { const s = x.s || x.state || '', t = (x.lu || 0) * 1000; if (!x.lu || t >= d.getTime()) E.times.forEach(({ name }) => { if (s.toLowerCase().startsWith(name.toLowerCase())) out[name] = s; }); });
      this._hist = out; this._update();
    } catch (e) { /* history is a nicety; the card works without it */ }
  }

  _loop() {
    if (!this._live || !this._cv) return;
    cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(() => this._loop());
    const cv = this._cv, r = cv.getBoundingClientRect(); if (!r.width) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = this._ctx, W = r.width, H = r.height, t = performance.now() / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const any = (this._running || []).some(Boolean);
    // countdown text ticks locally between the controller's reports
    (this._running || []).forEach((on, i) => { if (!on) return; const left = this._left(i), el = this._q('zs' + i); if (!el) return; el.className = 'cd'; this._text(el, left != null ? `${mmss(left)} left` : 'Running'); });
    if (this._still) return;
    if (this._night) { this._stars.forEach(s => { g.globalAlpha = .35 + .5 * Math.abs(Math.sin(t * s[3] + s[2])); g.fillStyle = '#fff'; g.fillRect(s[0] * W, s[1] * H, 1.6, 1.6); }); g.globalAlpha = 1; }
    // rain
    const want = Math.round((this._wet || 0) * 230);
    while (this._rain.length < want) this._rain.push({ x: Math.random() * (W + 200), y: Math.random() * H, v: 3.2 + Math.random() * 3.6, l: 9 + Math.random() * 13 });
    if (this._rain.length > want) this._rain.length = want;
    g.strokeStyle = 'rgba(200,225,255,.42)'; g.lineWidth = 1.2; g.beginPath();
    this._rain.forEach(d => { d.y += d.v; d.x -= d.v * .14; if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 200); } g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * .14, d.y - d.l); });
    g.stroke();
    // sprinklers
    (this._running || []).forEach((on, i) => {
      if (!on) return;
      const yd = this._root.querySelector(`.yard[data-z="${i}"]`); if (!yd) return;
      const nzl = yd.querySelector('.nozzle');
      yd.querySelectorAll('.mist').forEach(m => { const q = m.getBoundingClientRect(), x = q.left + 1.5 - r.left, y = q.top - r.top; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (Math.random() - .5) * 2.6, v = 1.4 + Math.random() * 2.2; this._spray.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: .7, gy: y + 9 + Math.random() * 6 }); } });
      yd.querySelectorAll('.drip').forEach(dl => { if (Math.random() < .4) { const q = dl.getBoundingClientRect(); this._seep.push({ x: q.left - r.left + Math.random() * q.width, y: q.bottom - r.top, l: 1 }); } });
      if (!nzl) return;
      const nz = nzl.getBoundingClientRect(), x = nz.left + nz.width / 2 - r.left, y = nz.top - r.top - 4;
      for (let k = 0; k < 9; k++) { const sweep = Math.sin(t * 1.15 + i * 2) * 1.05, a = -Math.PI / 2 + sweep + (Math.random() - .5) * .34, v = 5.2 + Math.random() * 3.4; this._spray.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, gy: y + 26 + Math.random() * 46 }); }
    });
    g.fillStyle = '#d8f3ff';
    this._spray = this._spray.filter(p => { p.vy += .2; p.x += p.vx; p.y += p.vy; if (p.vy > 0 && p.y > p.gy) p.l -= .2; else p.l -= .004; if (p.l <= 0) return false; g.globalAlpha = Math.min(.9, p.l); g.beginPath(); g.arc(p.x, p.y, 1.7, 0, 6.28); g.fill(); return true; });
    g.fillStyle = '#8fdcff';
    this._seep = this._seep.filter(p => { p.y += .2; p.l -= .011; if (p.l <= 0) return false; g.globalAlpha = p.l * .9; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 6.28); g.fill(); return true; });
    g.globalAlpha = 1;
    if (!any && this._spray.length > 2000) this._spray.length = 0;
    // burst from "Water now", on its own full-card layer
    if (this._bx) {
      const b = this._bx.getContext('2d'); b.clearRect(0, 0, this._bx.width, this._bx.height);
      this._burst = this._burst.filter(p => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.l -= .014; if (p.l <= 0) return false; b.globalAlpha = p.l; b.fillStyle = p.r > 5 ? '#fff' : '#8fdcff'; b.beginPath(); b.arc(p.x, p.y, p.r * p.l, 0, 6.28); b.fill(); return true; });
      if (!this._burst.length) { this._bx.remove(); this._bx = null; }
    }
  }
}
if (!customElements.get('arcane-irrigation-card')) customElements.define('arcane-irrigation-card', ArcaneIrrigationCard);

// ---------- visual editor (ha-form): yards (1–4) with switch/valve, name, look and optional sensors,
// then weather, schedule helpers and scripts. Run times and rain rules are YAML only.
const ent = (name, label, domain, helper) => ({ name, label, helper, selector: { entity: domain ? { domain } : {} } });
class ArcaneIrrigationCardEditor extends HTMLElement {
  setConfig(c) { this._c = c || {}; this._render(); }
  set hass(h) { this._h = h; if (this._f) this._f.hass = h; }
  _zones() { return Array.isArray(this._c.zones) ? this._c.zones.slice(0, MAX_ZONES) : []; }
  _render() {
    if (!this._f) {
      this._f = document.createElement('ha-form');
      this._f.computeLabel = s => s.label || s.title || s.name;
      this._f.computeHelper = s => s.helper;
      this._f.addEventListener('value-changed', e => this._changed(e.detail.value));
      this.appendChild(this._f);
    }
    const looks = Object.entries(SCENES).map(([value, s]) => ({ value, label: s.label }));
    const zones = this._zones(), count = Math.max(1, zones.length);
    if (this._open0 === undefined) this._open0 = !(zones[0] || {}).entity; // decided once, so the panel doesn't snap shut while filling it in
    const zoneSchema = z => [
      { ...ent('entity', 'Switch or valve', ['switch', 'valve']), required: true },
      { name: 'name', label: 'Name', selector: { text: {} } },
      { name: 'scene', label: 'Look', helper: z.layout && !z.scene ? 'Uses a hand-made layout; picking a look replaces it.' : undefined, selector: { select: { mode: 'dropdown', options: looks } } },
      ent('remaining', 'Time left sensor (optional)', 'sensor', 'Shows a countdown while it waters.'),
      ent('battery', 'Battery sensor (optional)', 'sensor'),
      ent('status', 'Status sensor (optional)', null, 'When this is unavailable the yard shows Offline.'),
    ];
    const scripts = this._c.scripts || {};
    this._f.schema = [
      { name: 'title', label: 'Title', selector: { text: {} } },
      { name: 'count', label: 'Number of yards', selector: { select: { mode: 'dropdown', options: ['1', '2', '3', '4'].map(v => ({ value: v, label: v })) } } },
      ...Array.from({ length: count }, (_, i) => { const z = zones[i] || {}; return { type: 'expandable', name: `zone_${i}`, title: `Yard ${i + 1}${z.name ? `: ${z.name}` : ''}`, expanded: i === 0 && this._open0, schema: zoneSchema(z) }; }),
      { type: 'expandable', name: 'g_wx', flatten: true, title: 'Weather (optional)', schema: [ent('weather', 'Weather', 'weather'), ent('sun', 'Sun (default sun.sun)', 'sun'), ent('max_temp', "Today's top temperature", 'sensor')] },
      { type: 'expandable', name: 'g_sched', flatten: true, title: 'Schedule helpers (optional)', schema: [
        ent('automatic', 'Automatic on/off', 'input_boolean'), ent('season', 'Season', ['input_select', 'select']), ent('minutes', 'Minutes per yard', ['input_number', 'number']),
        ent('next_run', 'Next run (timestamp sensor)', 'sensor'), ent('verdict', 'Water or skip (sensor)', 'sensor'), ent('reason', 'Reason text (sensor)', 'sensor'),
        ent('log', 'Last event (text helper)', ['input_text', 'sensor']), ent('hold', 'Hold until (date helper)', 'input_datetime'), ent('queue', 'Queued yard (text helper)', ['input_text', 'sensor']),
      ] },
      { type: 'expandable', name: 'scripts', title: 'Scripts (optional)', schema: [
        ent('run', 'Water now', 'script', 'Called with the picked zones. Leave empty to switch them on directly.'), ent('stop', 'Stop', 'script'),
        ent('skip', 'Skip today', 'script'), ent('resume', 'Clear the hold', 'script'), ent('start_now', 'Start now (queued yard)', 'script'),
      ] },
    ];
    const data = { ...this._c, count: String(count), scripts };
    for (let i = 0; i < count; i++) data[`zone_${i}`] = zones[i] || {};
    delete data.zones;
    this._f.data = data;
    if (this._h) this._f.hass = this._h;
  }
  _changed(v) {
    const old = this._zones(), count = Math.min(MAX_ZONES, Math.max(1, parseInt(v.count, 10) || 1)), zones = [];
    for (let i = 0; i < count; i++) {
      const z = { ...(old[i] || {}), ...(v[`zone_${i}`] || {}) };
      if (z.scene && z.scene !== (old[i] || {}).scene) delete z.layout;
      Object.keys(z).forEach(k => { if (z[k] === '' || z[k] == null) delete z[k]; });
      zones.push(z);
    }
    const c = { ...v, zones };
    delete c.count; for (let i = 0; i < MAX_ZONES; i++) delete c[`zone_${i}`];
    const sc = { ...(c.scripts || {}) }; Object.keys(sc).forEach(k => { if (!sc[k]) delete sc[k]; });
    if (Object.keys(sc).length) c.scripts = sc; else delete c.scripts;
    Object.keys(c).forEach(k => { if (c[k] === '' || c[k] == null) delete c[k]; });
    this._c = c;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: c }, bubbles: true, composed: true }));
    this._render();
  }
}
if (!customElements.get('arcane-irrigation-card-editor')) customElements.define('arcane-irrigation-card-editor', ArcaneIrrigationCardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'arcane-irrigation-card')) window.customCards.push({ type: 'arcane-irrigation-card', name: 'Arcane Irrigation', description: 'Tap-to-water irrigation card with a living sky, yard pictures and 7-day history.', preview: true, documentationURL: 'https://github.com/deekay2153/arcane-irrigation-card' });
console.info(`%c ARCANE-IRRIGATION-CARD %c ${VERSION} `, 'color:#04121d;background:#62c8f5;font-weight:700', 'color:#62c8f5;background:#04121d');
