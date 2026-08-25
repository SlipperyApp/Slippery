/* Slippery view layer.
 *
 * Ported from the approved prototype: every view, every sheet, all eight
 * themes, every string. The prototype rendered into a harness with a route
 * bar and a Desktop/Phone switch; here the same render layer is mounted into
 * the real page and `go()` is wired to the router, so every screen has a URL,
 * the back button works, and a sheet is linkable.
 *
 * The layer is deliberately a pure function of one state object rather than a
 * component tree. That is how the prototype was specified and reviewed, and
 * rewriting three thousand lines of final copy into JSX is the one change
 * guaranteed to lose a string. React owns mounting, routing and data; this
 * owns painting.
 */
import { ACTIONS, NOT_BUILT, key as ACTION_KEY } from './actions.js';
import { load as loadStored, save as saveStored, storageWorks } from './store.js';

export function mountProto(host, opts) {
  const onView = (opts && opts.onView) || (() => {});
  const onReady = (opts && opts.onReady) || (() => {});

  /* Every listener the prototype attached to `document` is recorded so a
     remount cannot end up with two of each, which would fire every handler
     twice and double every toast. */
  const bound = [];
  const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); bound.push([t, type, fn, o]); };
  const doc = { addEventListener: (type, fn, o) => on(document, type, fn, o) };
  const win = { addEventListener: (type, fn, o) => on(window, type, fn, o) };


/* ═══ brand mark: a slip with a torn corner, S cut out of it ═══ */
const MARK=`<span class="mark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Slippery"> <defs><clipPath id="slip-icont-cut"><path d="M2461.7 -1908.8 L-1320.9 2932.8 L1099.8 4824.1 L4882.4 -17.5 Z"/></clipPath></defs> <path d="M520.56 870.91Q443.20 870.91 374.71 848.40Q306.23 825.89 259.30 778.33Q212.38 730.77 199.70 654.68L372.18 620.43Q377.88 678.14 413.08 707.63Q448.27 737.11 513.59 737.11Q576.36 737.11 606.80 712.06Q637.24 687.02 637.24 653.41Q637.24 623.61 613.46 602.05Q589.68 580.48 531.34 571.61L469.20 561.46Q432.42 555.75 390.88 545.93Q349.35 536.10 312.57 516.12Q275.79 496.15 252.33 460.64Q228.87 425.13 228.87 369.32Q228.87 301.47 265.33 252.96Q301.79 204.45 366.47 178.77Q431.15 153.09 514.22 153.09Q590.95 153.09 654.36 175.60Q717.77 198.11 760.58 241.55Q803.38 284.98 816.06 349.03L643.58 384.54Q639.14 358.54 626.78 335.71Q614.41 312.89 589.05 298.62Q563.68 284.35 520.56 284.35Q471.73 284.35 442.88 303.37Q414.03 322.40 414.03 355.37Q414.03 379.47 430.20 394.69Q446.37 409.91 474.59 419.10Q502.81 428.30 538.32 434.64L609.34 446.69Q663.87 455.56 713.02 477.44Q762.16 499.32 793.23 539.90Q824.30 580.48 824.30 646.43Q824.30 719.36 784.67 769.45Q745.04 819.55 676.24 845.23Q607.44 870.91 520.56 870.91Z" fill="currentColor"/> <g clip-path="url(#slip-icont-cut)"><path d="M520.56 870.91Q443.20 870.91 374.71 848.40Q306.23 825.89 259.30 778.33Q212.38 730.77 199.70 654.68L372.18 620.43Q377.88 678.14 413.08 707.63Q448.27 737.11 513.59 737.11Q576.36 737.11 606.80 712.06Q637.24 687.02 637.24 653.41Q637.24 623.61 613.46 602.05Q589.68 580.48 531.34 571.61L469.20 561.46Q432.42 555.75 390.88 545.93Q349.35 536.10 312.57 516.12Q275.79 496.15 252.33 460.64Q228.87 425.13 228.87 369.32Q228.87 301.47 265.33 252.96Q301.79 204.45 366.47 178.77Q431.15 153.09 514.22 153.09Q590.95 153.09 654.36 175.60Q717.77 198.11 760.58 241.55Q803.38 284.98 816.06 349.03L643.58 384.54Q639.14 358.54 626.78 335.71Q614.41 312.89 589.05 298.62Q563.68 284.35 520.56 284.35Q471.73 284.35 442.88 303.37Q414.03 322.40 414.03 355.37Q414.03 379.47 430.20 394.69Q446.37 409.91 474.59 419.10Q502.81 428.30 538.32 434.64L609.34 446.69Q663.87 455.56 713.02 477.44Q762.16 499.32 793.23 539.90Q824.30 580.48 824.30 646.43Q824.30 719.36 784.67 769.45Q745.04 819.55 676.24 845.23Q607.44 870.91 520.56 870.91Z" fill="var(--s, #A8C2E8)"/></g> </svg></span>`;
/* THE WORDMARK'S CLIP PATH NEEDS A UNIQUE ID.
 *
 * It is drawn twice on the landing page, in the top bar and in the footer,
 * and it carries a hardcoded `id` for its clipPath. Two elements with the
 * same id is invalid, and worse than invalid here: `url(#slip-wmt-cut)`
 * resolves to whichever came first, so the second wordmark is clipped by the
 * first one's geometry. A counter rather than a random value, so the markup
 * is stable between renders and a snapshot diff stays readable. */
let wmSeq = 0;
const WORDMARK_TPL = `<span class="wordmark" role="img" aria-label="Slippery"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 983.9 285.4" role="img" aria-label="Slippery"> <defs><clipPath id="slip-wmt-cut"><path d="M2160.7 -2183.3 L-1473.8 2468.7 L3178.2 6103.2 L6812.7 1451.2 Z"/></clipPath></defs> <path d="M88.45 217.41Q70.29 217.41 56.81 211.95Q43.33 206.48 35.81 195.34Q28.29 184.21 28.00 167.41H61.11Q61.59 174.45 64.96 179.23Q68.33 184.02 74.24 186.41Q80.15 188.80 88.06 188.80Q95.19 188.80 100.36 186.85Q105.54 184.89 108.32 181.38Q111.11 177.86 111.11 173.18Q111.11 168.98 108.52 166.05Q105.93 163.12 100.75 160.87Q95.58 158.62 87.57 156.87L72.14 153.25Q53.29 148.96 42.55 139.19Q31.81 129.43 31.81 113.02Q31.81 99.54 39.13 89.39Q46.46 79.23 59.20 73.62Q71.95 68.00 88.45 68.00Q105.34 68.00 117.75 73.71Q130.15 79.43 136.98 89.63Q143.82 99.84 144.02 113.31H110.91Q110.23 105.40 104.46 101.01Q98.70 96.61 88.35 96.61Q81.52 96.61 76.83 98.42Q72.14 100.23 69.80 103.40Q67.45 106.57 67.45 110.68Q67.45 115.17 70.09 118.24Q72.73 121.32 77.61 123.37Q82.49 125.42 88.94 126.89L101.54 129.82Q112.08 132.06 120.33 135.92Q128.59 139.78 134.30 145.15Q140.01 150.52 142.99 157.55Q145.97 164.58 145.97 173.27Q145.97 187.04 139.08 196.96Q132.20 206.87 119.36 212.14Q106.52 217.41 88.45 217.41Z M161.93 215.46V69.95H196.40V187.34H257.24V215.46Z M307.09 69.95V215.46H272.61V69.95Z M327.34 215.46V69.95H386.91Q403.32 69.95 415.23 76.30Q427.15 82.65 433.54 93.98Q439.94 105.30 439.94 120.25Q439.94 135.29 433.40 146.42Q426.85 157.55 414.75 163.80Q402.64 170.05 385.94 170.05H349.02V142.80H379.69Q387.79 142.80 393.26 139.97Q398.73 137.14 401.46 132.06Q404.20 126.98 404.20 120.25Q404.20 113.41 401.46 108.38Q398.73 103.35 393.21 100.62Q387.69 97.88 379.59 97.88H361.82V215.46Z M455.31 215.46V69.95H514.88Q531.29 69.95 543.20 76.30Q555.12 82.65 561.52 93.98Q567.91 105.30 567.91 120.25Q567.91 135.29 561.37 146.42Q554.83 157.55 542.72 163.80Q530.61 170.05 513.91 170.05H476.99V142.80H507.66Q515.76 142.80 521.23 139.97Q526.70 137.14 529.44 132.06Q532.17 126.98 532.17 120.25Q532.17 113.41 529.44 108.38Q526.70 103.35 521.18 100.62Q515.67 97.88 507.56 97.88H489.79V215.46Z M583.29 215.46V69.95H684.26V98.08H617.76V128.16H678.99V155.70H617.76V187.34H684.16V215.46Z M702.86 215.46V69.95H762.43Q778.83 69.95 790.75 75.86Q802.66 81.77 809.06 92.61Q815.46 103.45 815.46 118.29Q815.46 133.23 808.91 143.83Q802.37 154.43 790.26 159.89Q778.15 165.36 761.45 165.36H723.46V138.12H755.20Q763.31 138.12 768.73 135.97Q774.15 133.82 776.93 129.43Q779.71 125.03 779.71 118.29Q779.71 111.46 776.93 106.96Q774.15 102.47 768.68 100.18Q763.21 97.88 755.10 97.88H737.33V215.46ZM782.74 215.46 747.29 148.96H784.21L820.53 215.46Z M868.79 215.46V162.73L814.69 69.95H855.12L877.97 114.58Q881.29 121.03 883.93 127.57Q886.57 134.11 889.30 142.80H883.15Q885.69 134.02 888.18 127.47Q890.67 120.93 893.89 114.58L915.67 69.95H955.90L903.07 162.73V215.46Z" fill="currentColor"/> <g clip-path="url(#slip-wmt-cut)"><path d="M88.45 217.41Q70.29 217.41 56.81 211.95Q43.33 206.48 35.81 195.34Q28.29 184.21 28.00 167.41H61.11Q61.59 174.45 64.96 179.23Q68.33 184.02 74.24 186.41Q80.15 188.80 88.06 188.80Q95.19 188.80 100.36 186.85Q105.54 184.89 108.32 181.38Q111.11 177.86 111.11 173.18Q111.11 168.98 108.52 166.05Q105.93 163.12 100.75 160.87Q95.58 158.62 87.57 156.87L72.14 153.25Q53.29 148.96 42.55 139.19Q31.81 129.43 31.81 113.02Q31.81 99.54 39.13 89.39Q46.46 79.23 59.20 73.62Q71.95 68.00 88.45 68.00Q105.34 68.00 117.75 73.71Q130.15 79.43 136.98 89.63Q143.82 99.84 144.02 113.31H110.91Q110.23 105.40 104.46 101.01Q98.70 96.61 88.35 96.61Q81.52 96.61 76.83 98.42Q72.14 100.23 69.80 103.40Q67.45 106.57 67.45 110.68Q67.45 115.17 70.09 118.24Q72.73 121.32 77.61 123.37Q82.49 125.42 88.94 126.89L101.54 129.82Q112.08 132.06 120.33 135.92Q128.59 139.78 134.30 145.15Q140.01 150.52 142.99 157.55Q145.97 164.58 145.97 173.27Q145.97 187.04 139.08 196.96Q132.20 206.87 119.36 212.14Q106.52 217.41 88.45 217.41Z M161.93 215.46V69.95H196.40V187.34H257.24V215.46Z M307.09 69.95V215.46H272.61V69.95Z M327.34 215.46V69.95H386.91Q403.32 69.95 415.23 76.30Q427.15 82.65 433.54 93.98Q439.94 105.30 439.94 120.25Q439.94 135.29 433.40 146.42Q426.85 157.55 414.75 163.80Q402.64 170.05 385.94 170.05H349.02V142.80H379.69Q387.79 142.80 393.26 139.97Q398.73 137.14 401.46 132.06Q404.20 126.98 404.20 120.25Q404.20 113.41 401.46 108.38Q398.73 103.35 393.21 100.62Q387.69 97.88 379.59 97.88H361.82V215.46Z M455.31 215.46V69.95H514.88Q531.29 69.95 543.20 76.30Q555.12 82.65 561.52 93.98Q567.91 105.30 567.91 120.25Q567.91 135.29 561.37 146.42Q554.83 157.55 542.72 163.80Q530.61 170.05 513.91 170.05H476.99V142.80H507.66Q515.76 142.80 521.23 139.97Q526.70 137.14 529.44 132.06Q532.17 126.98 532.17 120.25Q532.17 113.41 529.44 108.38Q526.70 103.35 521.18 100.62Q515.67 97.88 507.56 97.88H489.79V215.46Z M583.29 215.46V69.95H684.26V98.08H617.76V128.16H678.99V155.70H617.76V187.34H684.16V215.46Z M702.86 215.46V69.95H762.43Q778.83 69.95 790.75 75.86Q802.66 81.77 809.06 92.61Q815.46 103.45 815.46 118.29Q815.46 133.23 808.91 143.83Q802.37 154.43 790.26 159.89Q778.15 165.36 761.45 165.36H723.46V138.12H755.20Q763.31 138.12 768.73 135.97Q774.15 133.82 776.93 129.43Q779.71 125.03 779.71 118.29Q779.71 111.46 776.93 106.96Q774.15 102.47 768.68 100.18Q763.21 97.88 755.10 97.88H737.33V215.46ZM782.74 215.46 747.29 148.96H784.21L820.53 215.46Z M868.79 215.46V162.73L814.69 69.95H855.12L877.97 114.58Q881.29 121.03 883.93 127.57Q886.57 134.11 889.30 142.80H883.15Q885.69 134.02 888.18 127.47Q890.67 120.93 893.89 114.58L915.67 69.95H955.90L903.07 162.73V215.46Z" fill="var(--s, #A8C2E8)"/></g> </svg></span>`;
const WORDMARK_GET = () => {
  const id = 'slip-wmt-cut-' + (++wmSeq);
  return WORDMARK_TPL.split('slip-wmt-cut').join(id);
};

/* THE WORKED EXAMPLE, AND WHAT REPLACES IT.
 *
 * Signed out, these screens are the product's own demonstration and are the
 * figures the prototype specifies. Signed in, hydrateLedger() replaces every
 * one of them with the account's own, including an account whose answer is
 * zero. Nobody is ever shown somebody else's record as their own. */
let DAYVALS={1:186,3:-58,5:264,7:-96,8:64,10:212,12:-74,13:148,15:-41,16:238,18:229,19:112};
const DSUM=ks=>ks.reduce((t,k)=>t+(DAYVALS[k]||0),0);
let MTD=DSUM(Object.keys(DAYVALS).map(Number));
let WTD=DSUM([17,18,19,20,21,22,23]);
let TDY=DAYVALS[19];
const CURVE=(()=>{let t=0;return Array.from({length:19},(_,i)=>{t+=DAYVALS[i+1]||0;return t})})();
const PENCIL=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
const TG='<svg class="i"><use href="#tgi"/></svg>';
const APPLEBADGE=`<button class="badgelink" data-toast="Coming soon to the App Store" aria-label="Download on the App Store">
<svg viewBox="0 0 140 44" role="img" aria-label="Download on the App Store"><rect x=".75" y=".75" width="138.5" height="42.5" rx="9" fill="none" stroke="currentColor" stroke-opacity=".38" stroke-width="1.5"/>
<path fill="currentColor" d="M31.9 23.2a5.2 5.2 0 0 1 2.5-4.36 5.33 5.33 0 0 0-4.2-2.27c-1.77-.19-3.63 1.05-4.61 1.05-1 0-2.52-1.02-4.14-.99a5.6 5.6 0 0 0-4.7 2.86c-2 3.47-.51 8.6 1.43 11.42.95 1.38 2.08 2.92 3.57 2.87 1.43-.06 1.97-.93 3.7-.93s2.22.93 3.72.9c1.54-.03 2.52-1.4 3.46-2.79a11.6 11.6 0 0 0 1.58-3.21 5.02 5.02 0 0 1-3.05-4.6zM29.03 14.7a5.12 5.12 0 0 0 1.17-3.67 5.21 5.21 0 0 0-3.37 1.74 4.88 4.88 0 0 0-1.2 3.53 4.31 4.31 0 0 0 3.4-1.6z"/>
<text x="47" y="18.5" fill="currentColor" font-family="var(--ui)" font-size="8" opacity=".72" letter-spacing=".3">Download on the</text>
<text x="46" y="33.5" fill="currentColor" font-family="var(--ui)" font-size="16" font-weight="600" letter-spacing="-.02em">App Store</text></svg></button>`;
const PLAYBADGE=`<button class="badgelink" data-toast="Coming soon to Google Play" aria-label="Get it on Google Play">
<svg viewBox="0 0 152 44" role="img" aria-label="Get it on Google Play"><rect x=".75" y=".75" width="150.5" height="42.5" rx="9" fill="none" stroke="currentColor" stroke-opacity=".38" stroke-width="1.5"/>
<g transform="translate(17 11)" fill="currentColor">
<path d="M.42.36A1.5 1.5 0 0 0 .06 1.3v19.4c0 .38.13.7.36.94l.1.1L11.4 11.11v-.26L.52.26z" opacity=".95"/>
<path d="M15.03 14.73l-3.63-3.62v-.26l3.63-3.63.08.05 4.3 2.44c1.23.7 1.23 1.84 0 2.54l-4.3 2.44z" opacity=".8"/>
<path d="M15.11 14.68L11.4 10.98.42 21.7a1.2 1.2 0 0 0 1.52.05l13.17-7.07" opacity=".6"/>
<path d="M15.11 7.28L1.94.22A1.2 1.2 0 0 0 .42.27L11.4 10.98z" opacity="1"/></g>
<text x="47" y="18.5" fill="currentColor" font-family="var(--ui)" font-size="7.6" opacity=".72" letter-spacing=".9">GET IT ON</text>
<text x="46" y="33.5" fill="currentColor" font-family="var(--ui)" font-size="16" font-weight="600" letter-spacing="-.02em">Google Play</text></svg></button>`;
const BRAND=`<button type="button" class="brand" data-go="landing" data-home aria-label="Slippery, go to the home page">${WORDMARK_GET()}</button>`;
const BRANDMARK=`<button type="button" class="brand" data-go="landing" data-home aria-label="Slippery, go to the home page">${MARK}${WORDMARK_GET()}</button>`;
const TRIAL={base:'5 days or 15 slips',ref:'14 days or 40 slips'};
const BOOKS=[['Flutter',['Paddy Power','Betfair Sportsbook','Sky Bet','PokerStars']],
 ['Kambi',['LiveScore Bet','Virgin Bet','LeoVegas','BetMGM UK','BetUK','Expekt','Bally Bet','Monopoly Casino & Sports','Jackpotjoy Sports','Rainbow Riches','Grosvenor Sport','Casumo']],
 ['Other',['Ladbrokes','Coral','bwin','32Red','William Hill','888sport','Betfred','BoyleSports','Betfair Exchange','Smarkets']]];
const PERLIST=[['today','Today'],['W','This week'],['M','This month'],['Y','This year'],['All','All time']];
let PERIODS={today:{net:TDY,bets:3,units:TDY/25,to:75,void:0,tgt:100,pace:.5,lab:'today'},
 W:{net:WTD,bets:12,units:WTD/25,to:390,void:25,tgt:400,pace:.71,lab:'this week'},
 M:{net:MTD,bets:96,units:MTD/25,to:3180,void:80,tgt:2000,pace:.61,lab:'this month'},
 Y:{net:3171,bets:412,units:126.84,to:14200,void:410,tgt:6000,pace:.63,lab:'this year'},
 All:{net:3171,bets:412,units:126.84,to:14200,void:410,tgt:0,pace:0,lab:'all time'}};
function BETSFOR(d){const v=DAYVALS[d]||0,n=v>0?3:2,st=n*30,rt=st+v;
 const rows=(v>0?[['w','Bayern v Villa','Bayern −1 · 2.87 · £50 · Coral','+£93.50'],['l','Slavia v Sparta','Slavia · 2.10 · £30 · Coral','−£30.00'],['w','York 16:10','Selection 9 · 2.35 · £25 · Sky Bet','+£33.75']]
  :[['l','Inter v Milan','Inter · 3.19 · £25 · Sky Bet','−£25.00'],['l','Sevilla v Man Utd','Sevilla · 2.24 · £25 · Betfred','−£25.00']])
  .map(b=>`<div class="bet"><div class="o ${b[0]}">${outc(b[0]).mark}</div><div class="m"><div class="n" style="font-size:13px">${b[1]}</div><div class="d">${b[2]}</div></div><div class="v" style="color:var(--${outc(b[0]).col})">${b[3]}</div></div>`).join('');
 return {n,st,rt,wr:v>0?'67%':'0%',roi:(v/st*100).toFixed(1)+'%',u:(v/25).toFixed(2)+'u',rows}}
const TERMSDOC=[
 ['Who we are and what Slippery is',['Slippery is a record keeping tool for people who bet. It reads bookmaker slips you send it, stores the results, and shows you what your record says.',
  'Slippery is not a bookmaker. It does not accept bets, hold your money, pay winnings, or place anything on your behalf. It does not give tips, predictions or advice, and nothing in the product should be read as a recommendation to bet.',
  'Contact slipperyapp@gmail.com for anything to do with these terms.']],
 ['Who can use it',['You must be 18 or over. One account per person. You may not share your login or let anyone else use your account.',
  'If we have reason to believe you are under 18 we will close the account and refund any unused subscription.',
  'You may not use Slippery to work around a self exclusion you have put in place.']],
 ['Your account',['You are responsible for keeping your password secure and for everything done through your account. Tell us at once if you think someone else has access.',
  'Your display name is visible to groups you join and people who follow you. Do not impersonate anyone.',
  'We may suspend an account that breaches these terms, and will tell you why.']],
 ['Free trial',['Every new account gets a free trial. The standard trial is 5 days or 15 slips, whichever runs out first. A valid referral code extends it to 14 days or 40 slips.',
  'A payment card is required to start a trial. Nothing is charged during the trial.',
  'When the trial ends the yearly plan starts automatically at the price shown at signup. Cancel any time before the trial ends and you will not be charged.']],
 ['Subscription and payment',['Plans are £3.49 a month or £29.99 a year, shown to you before you commit.',
  'Subscriptions renew automatically until cancelled. Cancellation takes effect at the end of the period you have paid for.',
  'We do not give partial refunds for unused time in a period already paid for. If we change the price we will tell you at least 30 days before it applies.',
  'Payments are handled by a third party processor. We never see or store your full card number.']],
 ['Failed payments and read only mode',['If a payment fails we will try again. If two attempts fail, the account moves to read only.',
  'In read only mode you keep full sight of everything you have logged and can export all of it. New slips are not read, imports are paused, and the Telegram bot stops accepting slips.',
  'We will never delete your betting history because a payment failed. Read only is always reversible by adding a working card.']],
 ['Your data and your record',['Your bets belong to you. Export everything as CSV, JSON or PDF at any time, including in read only mode and after cancelling.',
  'We store and process your data to run the service. What we collect and why is in the privacy policy.',
  'If you delete your account we remove your bets and slip images, except records the law requires us to keep.']],
 ['Accuracy and your responsibility',['Slip reading is automated and can be wrong. Result lookups use third party fixture data which can be late or incorrect.',
  'Every bet is shown to you before it saves and every field can be corrected. You are responsible for checking your record is right.',
  'Figures in Slippery are a record, not a statement of account. Where Slippery and your bookmaker disagree, your bookmaker is correct.',
  'Imported figures have no slip behind them, so they are excluded from win rate, streaks and best and worst day.']],
 ['Acceptable use',['Do not scrape, reverse engineer, resell or attempt unauthorised access.',
  'Do not upload anything illegal, or anything that is not a betting record.',
  'Do not use Slippery to promote gambling to anyone under 18, or to misrepresent a tipping record.']],
 ['Groups and what others can see',['Inside a group, other members can see your unit size and your figures in units. That is the point of a group and cannot be turned off while you are a member.',
  'Outside a group, what others see is controlled by your privacy setting. Stake amounts are never shown outside a group.',
  'Group admins can remove members, change the invite code and delete the group. Deleting a group does not delete anyone\u2019s bets.']],
 ['Third parties we rely on',['Hosting and serverless functions, a managed Postgres database, an automated image reading service, a payment processor, transactional email, and error monitoring. Each is named in the privacy policy.']],
 ['Availability',['We aim to keep Slippery available but do not promise uninterrupted service. Features may change. We will not remove your ability to see or export your own record.']],
 ['Liability',['Nothing here limits liability for death or personal injury caused by negligence, for fraud, or anything else that cannot be limited by law.',
  'Otherwise our total liability is limited to the greater of what you paid us in the previous 12 months or £100.',
  'We are not liable for betting losses, or for decisions you made using figures in Slippery.']],
 ['Ending it',['You may close your account at any time from Settings.',
  'We may end your access with reasonable notice, or immediately for a serious breach. If we end it without cause we refund the unused part of your period.']],
 ['Changes and governing law',['We may update these terms and will email you at least 30 days before a material change.',
  'These terms are governed by the law of England and Wales. If you are a consumer you keep your statutory rights.']]];
const PRIVDOC=[
 ['Who is responsible',['Slippery is the data controller for the personal data described here. Contact slipperyapp@gmail.com.',
  'If you are unhappy with how we handle a request you can complain to the Information Commissioner\u2019s Office at ico.org.uk.']],
 ['What we collect',['Account: email address, hashed password, display name, handle, join date.',
  'Betting records: event, selection, market, odds, stake, result, returns, bookmaker, tipster, sport, date placed, and where the bet came from.',
  'Slip images you send us, and the text extracted from them.',
  'Telegram: your user ID, chat ID and username if you have one.',
  'Payment: the last four digits and expiry of your card, held by our processor. We never receive the full number.',
  'Technical: IP address, device and browser type, error reports.']],
 ['Why we use it, and our lawful basis',['To run the service you signed up for. Basis: performance of a contract.',
  'To take payment and prevent fraud. Basis: contract and legitimate interests.',
  'To keep the service secure, including rate limiting sign in attempts. Basis: legitimate interests.',
  'To send service email such as verification codes and payment notices. Basis: contract.',
  'To send optional summaries or product news. Basis: consent, withdrawable any time.']],
 ['Slip images and automated reading',['Slip images are sent to an automated image reading service to extract the bet.',
  'Images and extracted text are not used to train anyone\u2019s models.',
  'Slip images are deleted 90 days after upload, or immediately if you delete them from Settings.',
  'Nothing is saved to your ledger until you confirm it, so no decision is made about you by automated means alone.']],
 ['Who we share it with',['Hosting and serverless platform. Managed Postgres database. Automated image reading provider. Payment processor. Transactional email provider. Error monitoring.',
  'We do not sell your data, and we do not share it with advertisers or bookmakers.']],
 ['What other Slippers can see',['Inside a group: your display name, your figures in units, and your unit size.',
  'Outside a group, per your privacy setting: nothing on Private, units and ROI to Slippers you follow back on Friends only, or to anyone on Public.',
  'Stake amounts and slip images are never visible to another user, in any setting.']],
 ['How long we keep it',['Bets and imported figures: until you delete them or close your account.',
  'Slip images: 90 days. Rate limiting records: 24 hours. Error logs: 30 days.',
  'Payment and tax records: as long as the law requires, currently six years.',
  'Closed accounts: bets and images removed within 30 days.']],
 ['International transfers',['Where a provider processes data outside the UK we rely on UK adequacy regulations or the International Data Transfer Addendum to the standard contractual clauses.']],
 ['Your rights',['Access, correction, deletion, restriction, objection, and withdrawal of consent.',
  'Export is built in: CSV, JSON or PDF from Settings, at any time.',
  'We answer within one month, at no charge unless a request is excessive.']],
 ['Cookies',['A session cookie so you stay signed in, and a preference store for your theme and layout.',
  'No advertising cookies, no cross site tracking, no profiling analytics.']],
 ['Security',['Encrypted in transit and at rest. Passwords hashed, never stored readably.',
  'Access to production data is limited to what is needed to run the service.',
  'If a breach is likely to be a risk to you we tell you and the ICO within 72 hours.']],
 ['Children',['Slippery is not for anyone under 18. We do not knowingly collect data about children.']],
 ['Gambling harm',['Slippery is a tracker, not a bookmaker, so we cannot exclude you from betting. If betting is causing you harm, GamCare on 0808 8020 133 and BeGambleAware.org can help.',
  'You can pause logging at any time from Settings, and delete your account entirely.']],
 ['Changes',['If we change this policy in a way that affects you we email you at least 30 days beforehand.']]];
const MARKETGROUPS=[
 ['Match result',['1X2','Full time result','Match odds','Win/Draw/Win','Home/Draw/Away']],
 ['Both teams to score',['BTTS','Both teams to score','GG/NG','Goal/No goal']],
 ['Total goals',['Over/Under goals','Total goals','Goals over/under','O/U goals']],
 ['Asian handicap',['AH','Asian handicap','Asian line']],
 ['Handicap',['Handicap','European handicap','Spread']],
 ['Double chance',['Double chance','1X','X2','12']],
 ['Correct score',['Correct score','Exact score','Score']],
 ['First goalscorer',['First scorer','1st goalscorer','First goalscorer']],
 ['Anytime goalscorer',['Anytime scorer','To score','Anytime goalscorer']],
 ['Player shots',['Shots','Total shots','Player shots']],
 ['Player shots on target',['SOT','Shots on target','Player shots on target']],
 ['Player cards',['To be carded','Card','Player to be booked']],
 ['Total cards',['Cards','Total cards','Booking points']],
 ['Total corners',['Corners','Total corners','Corner count']],
 ['Win',['Win','To win','Outright win']],
 ['Each way',['E/W','Each way','Win or place']],
 ['Place',['Place','To place','Top 3']],
 ['Match winner',['Match winner','To win match','Winner']],
 ['Total games',['Games','Total games','O/U games']],
 ['Set betting',['Set betting','Correct sets','Set score']]];
let bets=[
 ['w','Arsenal v Spurs','Arsenal to win','Match result',1.90,10,19,'+£9.00','+0.36u','bet365','Own picks','Screenshot','9 Aug 2026, 13:00',1,null],
 ['l','Inter v Milan','Inter','Match result',3.19,25,0,'−£25.00','−1.00u','Sky Bet','BlueSlip','Telegram','18 Aug 2026, 19:45',0,null],
 ['w','Monaco v Roma','Both teams to score','Both teams to score',2.51,25,62.75,'+£37.75','+1.51u','Betfred','Own picks','Telegram','18 Aug 2026, 20:00',0,null],
 ['l','Brentford v Wolves','Brentford','Match result',2.57,50,0,'−£50.00','−2.00u','Ladbrokes','Own picks','Screenshot','17 Aug 2026, 15:00',0,null],
 ['w','Juventus v Cremonese','4 legs, one fixture','Multiple',1.80,100,180,'+£80.00','+3.20u','bet365','Own picks','Telegram','19 Aug 2026, 19:12',0,
  [['Under 4 Cards','Total cards','w'],['Under 4.5 Shots on Target','Cremonese','w'],['Under 11.5 Shots','Cremonese','w'],['Juventus to win','Match result','w']]],
 ['l','Sevilla v Man Utd','Sevilla','Match result',2.24,25,0,'−£25.00','−1.00u','Betfred','KerryEdge','Telegram','17 Aug 2026, 20:00',0,null],
 /* 55 · The bet the six outcomes could not express. £20 each way, 1/5 odds,
    places 1-3, finished 3rd of 12. The old model called it LOST at −£20.00;
    it returned £16.00, so the answer is −£4.00 and the word is PLACED.
    Two child parts, one row.

    A NOTE ON THE PRICE. The brief's panel gives a 6.00 win price, a 2.00
    place price and a +£6.00 place profit, and no two of those three agree:
    £10 at 2.00 returns £20 and profits £10, and at 6.00 with 1/5 terms the
    whole bet is level rather than down £4. The figures the brief leads with
    — returned £16.00, net −£4.00 — need a 4.00 win price, which gives a 1.60
    place price and £16 back. Those are the ones used here, because they are
    the point the item is making. */
 ['p','York 16:10','Selection 9','Win',4.00,20,16,'−£4.00','−0.16u','Sky Bet','Own picks','Screenshot','16 Aug 2026, 16:10',0,null,
  {ew:{frac:'1/5',places:3,win:{stake:10,price:4.00,out:'l',ret:0},place:{stake:10,price:1.60,out:'w',ret:16}}}],
 /* 56 · Exchange P&L without commission is wrong by 2 to 5% on every
    winner. £30 at 2.41 grosses £42.30; 2% of the winnings is 85p. */
 ['w','Rublev v Fritz','Rublev','Match winner',2.41,30,71.45,'+£41.45','+1.66u','Smarkets','Own picks','Telegram','16 Aug 2026, 12:30',0,null,
  {comm:{rate:2.0,grossProfit:42.30,charged:0.85}}],
 ['w','Köln v Augsburg','Under 3.5 Goals','Total goals',1.55,40,62,'+£22.00','+0.88u','Paddy Power','BlueSlip','Telegram','15 Aug 2026, 14:30',0,null],
 ['l','Slavia v Sparta','Slavia','Match result',2.10,30,0,'−£30.00','−1.20u','Coral','Own picks','Screenshot','14 Aug 2026, 17:00',0,null],
 ['w','Bayern v Villa','Bayern −1','Handicap',2.87,50,143.50,'+£93.50','+3.74u','Coral','FiveFolds','Telegram','13 Aug 2026, 20:00',0,null],
 ['l','West Ham v Everton','Over 2.5 Goals','Total goals',5.91,25,0,'−£25.00','−1.00u','Sky Bet','Own picks','Telegram','13 Aug 2026, 17:30',0,null]];
/* adaptive bankroll: what you started with, plus everything settled since */
/* 07/11 · LEDGER PAGINATION. Fifty a page, and a button rather than infinite
   scroll: a ledger is something people scan for one bet, and infinite scroll
   makes the footer unreachable and the position unrestorable. */
const LEDGER_PAGE=50;

const BR_START=1000;
/* What is at risk right now: the remaining stake of everything unsettled.
   It was a constant, which meant an account with nothing running still
   claimed £88 was on the table. */
let BR_OPEN=88;
function roiOf(d){
  const base=(d.to||0)-(d.void||0);
  if(!base)return '—';
  const pct=d.net/base*100;
  return (pct>0?'+':'')+pct.toFixed(1)+'%';
}
/* 57 · BANKROLL WAS TWO DIFFERENT NUMBERS UNDER ONE WORD.
 *
 * Settings called £1,000 "Bankroll" and described it as a starting balance.
 * The sidebar called £4,171 "Bankroll" too. Four times apart, same label.
 *
 *   STARTING BANKROLL  what a person sets. Fixed. The denominator for growth.
 *   BALANCE            derived, never stored:
 *                        starting + net + deposits − withdrawals
 *
 * Exposure divides by BALANCE. Dividing by the starting figure means the
 * percentage drifts further from the truth the better somebody does: £88 at
 * risk reads 8.8% of £1,000 when it is 2.1% of what they actually hold, and
 * the number meant to stop over-staking is four times too alarming. */
const BR_ADJUSTMENTS=[];
const adjustmentsTotal=()=>BR_ADJUSTMENTS.reduce((t,a)=>t+(a.amount||0),0);
const startingBankroll=()=>BR_START;
const balance=()=>startingBankroll()
 +((cur.adaptBr!==false&&typeof PERIODS!=='undefined'&&PERIODS.All)?PERIODS.All.net:0)
 +adjustmentsTotal();
/* Kept as an alias so nothing that already called it breaks, but every new
   caller should say which of the two it means. */
const bankroll=()=>balance();
/* Guarded: a balance of zero is a division by zero, and the answer people
   need there is nothing at risk, not Infinity. */
const exposurePct=()=>{const b=balance();return b>0?(BR_OPEN/b*100):0};
const growthPct=()=>{const st=startingBankroll();
 const net=(typeof PERIODS!=='undefined'&&PERIODS.All)?PERIODS.All.net:0;
 return st>0?(net/st*100):null};
/* ANYTHING THAT CAME FROM OUTSIDE GOES THROUGH HERE FIRST.
 *
 * The render layer builds HTML strings, which is fine for copy written in
 * this file and a script injection for anything else. A bookmaker name read
 * off a screenshot, an event name, a group name somebody typed: all of it
 * is attacker-controlled in the sense that matters. */
const esc=v=>String(v==null?'':v)
 .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
 .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* A stake is not a result, so it takes no sign. `money` is for figures where
   up and down is the point. */
/* 11 · ONE CURRENCY PER ACCOUNT, and the symbol is never hardcoded. "Irish"
   appears nine times on the marketing site and the euro symbol appeared zero
   times in the product. Figures are never summed across currencies: adding
   £ and € into one Net is not a number of anything. */
const CUR_SYM={GBP:'£',EUR:'€'};
const CUR_LOC={GBP:'en-GB',EUR:'en-IE'};
const sym=()=>CUR_SYM[cur.currency||'GBP']||'£';
const loc=()=>CUR_LOC[cur.currency||'GBP']||'en-GB';
const nfmt=n=>Math.abs(Number(n)||0).toLocaleString(loc(),{minimumFractionDigits:2,maximumFractionDigits:2});

const amount=n=>sym()+nfmt(n);

const money=n=>(n>0?'+':n<0?'−':'')+sym()+nfmt(n);
/* 11 · FRACTIONAL IS A LOOKUP, NOT ARITHMETIC.
   The old best-fit search returned the mathematically smallest fraction,
   which is not what a bookmaker prints: 2.50 came out 3/2 where every UK
   board says 6/4, and a tracker disagreeing with the slip it just read looks
   broken. This is the standard ladder; a price between two rungs takes the
   nearer one rather than inventing a fraction. */
const FRACLADDER=[[1.01,'1/100'],[1.02,'1/50'],[1.04,'1/25'],[1.05,'1/20'],[1.06,'1/16'],
 [1.07,'1/14'],[1.08,'1/12'],[1.10,'1/10'],[1.11,'1/9'],[1.12,'2/17'],[1.13,'1/8'],
 [1.14,'1/7'],[1.17,'1/6'],[1.20,'1/5'],[1.22,'2/9'],[1.25,'1/4'],[1.29,'2/7'],
 [1.30,'3/10'],[1.33,'1/3'],[1.36,'4/11'],[1.40,'2/5'],[1.44,'4/9'],[1.45,'9/20'],
 [1.50,'1/2'],[1.53,'8/15'],[1.57,'4/7'],[1.60,'3/5'],[1.62,'8/13'],[1.67,'4/6'],
 [1.73,'8/11'],[1.80,'4/5'],[1.83,'5/6'],[1.91,'10/11'],[2.00,'1/1'],[2.10,'11/10'],
 [2.20,'6/5'],[2.25,'5/4'],[2.38,'11/8'],[2.50,'6/4'],[2.63,'13/8'],[2.75,'7/4'],
 [2.88,'15/8'],[3.00,'2/1'],[3.20,'11/5'],[3.25,'9/4'],[3.50,'5/2'],[3.75,'11/4'],
 [4.00,'3/1'],[4.33,'10/3'],[4.50,'7/2'],[5.00,'4/1'],[5.50,'9/2'],[6.00,'5/1'],
 [6.50,'11/2'],[7.00,'6/1'],[7.50,'13/2'],[8.00,'7/1'],[9.00,'8/1'],[10.00,'9/1'],
 [11.00,'10/1'],[12.00,'11/1'],[13.00,'12/1'],[15.00,'14/1'],[17.00,'16/1'],
 [21.00,'20/1'],[26.00,'25/1'],[34.00,'33/1'],[41.00,'40/1'],[51.00,'50/1'],
 [67.00,'66/1'],[101.00,'100/1']];
function fmtOdds(d){
 if(!(d>0))return '—';
 if(cur.oddsFmt==='Fractional'){
  let best=FRACLADDER[0],err=Math.abs(d-best[0]);
  for(const r of FRACLADDER){const e=Math.abs(d-r[0]);if(e<err){err=e;best=r}}
  return best[1]}
 if(cur.oddsFmt==='American')return d>=2?'+'+Math.round((d-1)*100):String(Math.round(-100/(d-1)));
 return d.toFixed(2)}
function reOdds(txt){return txt.replace(/(^|[\s·])(\d+\.\d{2})(?=[\s·]|$)/g,(m,a,d)=>a+fmtOdds(parseFloat(d)))}
function showVal(mny,un,col){
 if(cur.showIn==='Units')return `<div class="v" style="color:var(--${col})">${un}</div>`;
 if(cur.showIn==='Both')return `<div class="v" style="color:var(--${col})">${mny}<small style="color:inherit;opacity:.7">${un}</small></div>`;
 return `<div class="v" style="color:var(--${col})">${mny}<small>${un}</small></div>`}
/* 55 · A bet outcome is no longer a boolean.
 *
 * Four separate `b[0]==='w' ? … : …` ternaries each quietly assumed there
 * were exactly two outcomes, so adding "placed" — the each-way case where the
 * win part lost and the place part won — would have rendered it as a loss in
 * three of the four and a tick in none. One table instead.
 *
 * `p` is placed: a loss in pounds and a win in the sense that matters to
 * whoever backed it, which is why it takes the warning colour rather than
 * being rounded to one of the other two. */
const OUTCOME={
 w:{mark:'✓',col:'pos',word:'WON'},
 l:{mark:'✕',col:'neg',word:'LOST'},
 p:{mark:'◐',col:'a',  word:'PLACED'},
 v:{mark:'—',col:'t3', word:'VOID'},
 r:{mark:'·',col:'a',  word:'RUNNING'},
 o:{mark:'·',col:'a',  word:'OPEN'}};
const outc=c=>OUTCOME[c]||OUTCOME.l;

const betRow=(b,i)=>`<button class="bet" data-bet="${i}">${cur.bulk?`<span style="width:18px;height:18px;border-radius:5px;flex:0 0 auto;margin-top:3px;border:1.5px solid ${i<3?'var(--pos)':'var(--line)'};background:${i<3?'color-mix(in srgb,var(--pos) 22%,transparent)':'none'};display:grid;place-items:center;font-size:10px;color:var(--pos)">${i<3?'✓':''}</span>`:`<div class="o ${b[0]}" aria-label="${outc(b[0]).word}">${outc(b[0]).mark}</div>`}
 <div class="m"><div class="n">${b[1]}${b[13]?'<span class="tag">IMPORTED</span>':''}</div>
  <div class="d">${b[2]} · ${fmtOdds(b[4])} · ${sym()}${b[5].toFixed(2)} · ${b[9]}</div></div>
 ${showVal(b[7],b[8],outc(b[0]).col)}</button>`;
/* 17 · The six the bot may send. Mirrors lib/notifications.ts, which is the
   server's copy and the one the sender reads; this is the render layer's, and
   the two are asserted equal in tests so they cannot drift. */
const NOTIFS=[
 ['settled','Bet settled','When a bet finishes, with your running total for the day',1],
 ['overtaken','Someone passed you','Once, when your weekly opponent goes ahead',1],
 ['reaction','Reactions','Batched, never one message per tap',0],
 ['weekly','Sunday result','How your week finished and where you are in the table',0],
 ['promotion','Promotion','When you move division at the end of a month',0],
 ['challenge','Challenge ending','The day before a challenge you entered closes',0]];
const wantsNotif=k=>{
 const v=cur.notifs&&cur.notifs[k];
 if(typeof v==='boolean')return v;
 const row=NOTIFS.find(n=>n[0]===k);
 return !!(row&&row[3]);
};

const THEMES=[['carbon','Carbon','Steel on near-black. The default.','#0C0E13','#6E86B8','#E6EBF3'],
 ['graphite','Graphite','Deep green-grey. Almost black.','#0A0C0B','#7E9188','#EAF0EC'],
 ['ink','Ink','Near black, violet cast. The darkest.','#050508','#8B84C4','#F3F1FA'],
 ['slate','Slate','Steel blue-grey. The lightest dark.','#161A21','#7E93B5','#EEF2F7'],
 ['periwinkle','Periwinkle','Indigo on deep navy.','#0A0F1E','#6D86DB','#F2F5FA'],
 ['liquid','Liquid','Deep marine. The coldest.','#04171C','#54AEBE','#E6F7FA'],
 ['bronze','Bronze','Warm paper on dark. The only warm one.','#12100C','#A8926A','#F2ECE0'],
 ['cinnabar','Cinnabar','Burnt red on near-black.','#130D0B','#C4643F','#F6EAE4']];
const CARDS=[['net','Net and target'],['cal','Calendar'],['recent','Recent bets'],['alltime','All time'],
 ['book','By bookmaker'],['market','By market'],['tips','By tipster'],['sport','By sport'],['curve','Profit over time'],['months','Month by month'],['stake','Staking discipline'],['running','Running now'],['oddsband','By odds band']];
const unitExample=u=>`<div class="row" style="font-size:12.5px;justify-content:space-between">
  <span>Stake ${sym()}${u}, returns ${sym()}${u*2} <span style="color:var(--t3)">so profit is ${sym()}${u}</span></span><b class="mono" style="color:var(--pos)">+1.00u</b></div>
 <div class="row" style="font-size:12.5px;justify-content:space-between;margin-top:7px">
  <span>Stake ${sym()}${u*2}, returns ${sym()}0 <span style="color:var(--t3)">so loss is ${sym()}${u*2}</span></span><b class="mono" style="color:var(--neg)">−2.00u</b></div>
 <p class="note" style="margin-top:8px">Units track profit, not what comes back.</p>`;
const DEFAULT_ABOVE=['net','cal','running','recent','alltime','oddsband','curve','sport','stake','market','tips','book'];
/* 23 · ORDERED BY ROUTE, not by when each module was written. The daily
   return — what is live, what needs me — comes before anything analytical,
   because that is the thirty-second session people actually make. Then the
   record, then the weekly review. */
/* 03 · THE ORDER IS THE PACKING. Twelve modules, six rows, every row exactly
   twelve columns, no ragged tail:
     1  net 12
     2  cal 5 + running 7
     3  recent 7 + [alltime 5 stacked on oddsband 5]
     4  curve 8 + sport 4
     5  stake 6 + market 6
     6  tips 6 + book 6
   Performance is span 8 rather than 12: at 12 the chart is 1,154px for eight
   bars and mostly whitespace. Change this list and you change the packing, so
   redo the arithmetic. */
const DEFAULT_ORDER=['net','cal','running','recent','alltime','oddsband','curve','sport',
 'stake','market','tips','book'];
const NETALL=['bets','units','turnover','roi','winrate'];
const NETORDER=()=>{const o=(cur.netOrder||NETALL).slice();return o.concat(NETALL.filter(k=>o.indexOf(k)<0))};
const NETFIGS=()=>NETORDER().filter(k=>(cur.netShow.length?cur.netShow:['bets','units']).indexOf(k)>=0);
const cur={netOrder:null,chalGroup:'All',chalTab:'Running',shareKinds:['Summary'],netShow:['bets','units'],calUnits:false,promo:'SEUN-8QK4',unit:25,currency:'GBP',oddsFmt:'Decimal',showIn:'Currency',view:'landing',theme:'carbon',per:'M',calDates:true,weekStart:1,demoSeen:false,signedIn:false,
 running:4,risk:88,above:[...DEFAULT_ABOVE],
 /* canonical size per widget by content shape, assigned by the system */
 /* SIZED AGAINST WHAT EACH ONE CARRIES.
    A card holding two rows and a card holding thirty one squares were the
    same size, so the sparse one was mostly padding and the dense one was
    cramped. c = compact, s = standard, w = double width, f = feature.
    Anything with a chart in it gets the width a chart needs; anything that
    is three figures gets the room three figures need and no more. */
 mod:{}, openMenu:null, hidden:[], stakeTol:10,
 SIZE:{net:'w',cal:'f',curve:'w',recent:'w',alltime:'c',months:'w',running:'s',
  stake:'s',oddsband:'s',book:'c',market:'s',tips:'c',sport:'c',course:'s',odds:'s',dow:'s'},
 LOCKED:['net','cal','recent'],order:[...DEFAULT_ORDER]};
const V={},SH={};
let T=[];const clearT=()=>{T.forEach(clearTimeout);T=[]};

/* ═══ segmented control with sliding indicator ═══ */
function segHTML(items,active,attr){return `<div class="seg" data-seg><span class="ind"></span>
 ${items.map(x=>`<button aria-current="${x===active}" ${attr?attr(x):'data-pickone'}>${x}</button>`).join('')}</div>`}
function placeInd(seg){const a=seg.querySelector('button[aria-current=true]'),ind=seg.querySelector('.ind');
 if(!a||!ind)return;ind.style.width=a.offsetWidth+'px';ind.style.transform=`translateX(${a.offsetLeft-3}px)`;}
function allInds(){document.querySelectorAll('[data-seg]').forEach(placeInd)}

/* ═══ dashboard blocks ═══ */
function netCard(){
 const d=PERIODS[cur.per],tgt=d.tgt>0,pct=tgt?Math.min(100,Math.round(d.net/d.tgt*100)):0;
 const ahead=pct>=d.pace*100,met=pct>=100;
 const col=met?'linear-gradient(90deg,#4ade80,var(--pos))':ahead?'linear-gradient(90deg,var(--p),var(--s))':'linear-gradient(90deg,var(--a),#fbbf24)';
 return `<div class="card" data-cardid="net"><div class="hd"><span class="lbl" data-netlab>Net</span>
  <span class="netctl">
  <button class="iconb" data-sheet="share" aria-label="Share"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg></button>
  <button class="iconb" data-sheet="netfigs" aria-label="Choose figures">⋯</button>
  <button class="pill" data-sheet="period">${PERLIST.find(x=>x[0]===cur.per)[1]} ▾</button></span></div>
 <div class="big mono" data-count="${d.net}">+£0.00</div>
 <div class="row">${NETFIGS().map(k=>({bets:`Bets <b>${d.bets}</b>`,
   units:`Units <b class="mono">+${d.units.toFixed(2)}u</b>`,
   turnover:`Turnover <b>${sym()}${(d.to-d.void).toLocaleString('en-GB')}</b>`,
   /* Nothing staked has no return on it. Printing NaN, or a confident 0.0%,
      both say something untrue about a period with no bets in it. */
   roi:`ROI <b class="mono">${roiOf(d)}</b>`,
   winrate:`Win rate <b>${Math.round(d.bets*0.54)}/${d.bets}</b>`}[k])).map(t=>`<span>${t}</span>`).join('')}</div>
 ${tgt?`<div class="tgt"><div class="r1"><span style="color:var(--t3)">Target ${sym()}${d.tgt.toLocaleString('en-GB')}</span>
   <span><b class="mono" style="color:${met?'var(--pos)':ahead?'var(--s)':'var(--a)'}">${pct}%</b>
   <span class="mono" style="margin-left:8px;color:var(--t3)">${met?'met':'£'+(d.tgt-d.net).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+' to go'}</span></span></div>
  <div class="pacebar"><div class="f" data-w="${pct}" style="background:${col}"></div>
   ${met?'':`<div class="pace" style="left:${Math.max(4,Math.min(96,Math.round(d.pace*100)))}%"></div>`}</div></div>`:''}
 </div>`}
function calCard(){return `<div class="card" data-cardid="cal"><div class="hd"><b>August 2026</b>
  <span class="hdctl">${modMenu('cal',[
   {type:'seg',label:'Cell style',key:'style',value:'intensity',
    items:[['intensity','Intensity'],['flat','Flat']]},
   {type:'rule'},
   {type:'check',label:'Show figures',key:'figures',value:true},
   {type:'check',label:'Show dates',key:'dates',value:true},
   {type:'rule'},
   {type:'seg',label:'Week starts',key:'ws',value:cur.weekStart===0?'sun':'mon',
    items:[['mon','Mon'],['sun','Sun']]}])}</span></div>
 <div class="calwrap open" data-calwrap><div class="cal chartfill" data-cal="month"></div></div>
 <div class="callegend"><span><i class="sw p"></i>Profitable</span><span><i class="sw n"></i>Losing</span><span><i class="sw z"></i>No bets</span></div></div>`}
function calCardMonth(){return `<div class="card" data-cardid="cal"><div class="hd"><b>August 2026</b><span class="chip">Collapse</span></div>
 <div class="cal chartfill" data-cal="month"></div>
 <div class="callegend"><span><i class="sw p"></i>Profitable</span><span><i class="sw n"></i>Losing</span><span><i class="sw z"></i>No bets</span></div></div>`}
const SIZES=[['c','▪','Compact'],['s','▬','Standard'],['w','▭','Wide'],['f','◼','Feature']];
/* 18 · ONE STRIP FOR EVERYTHING NOT YET UNLOCKED, at the bottom, instead of
 * a greyed card in each module's own place. It names what each needs, so the
 * dashboard says "there is more, here is how to get it" rather than "most of
 * this is broken".
 */
function lockedStrip(){
 const locked=(cur.above||DEFAULT_ABOVE)
  .filter(k=>!cur.hidden.includes(k)&&moduleState(k)==='waiting');
 if(!locked.length)return '';
 return `<div class="lockstrip" data-cardid="locked">
  <div class="lbl">Unlocks as you go</div>
  <div class="lockitems">${locked.map(k=>{
   const title=(CARDS.find(c=>c[0]===k)||[,k])[1];
   return `<span class="lockitem"><b>${esc(title)}</b> ${esc(MODULE_UNLOCK[k]||'Needs more bets')}</span>`
  }).join('')}</div></div>`}

function szCard(k){
 /* 02 · a module hidden from its own menu stays hidden until Edit overview
    puts it back. */
 if(cur.hidden.includes(k))return '';
 /* 12 · and one that cannot say anything true yet says what unlocks it
    instead of drawing an empty chart. */
 const st=moduleState(k);
 const title=(CARDS.find(c=>c[0]===k)||[,k])[1];
 /* 18 · A LOCKED MODULE IS NOT DRAWN. It used to render a greyed card saying
    what it needs, so a new account's dashboard was half placeholder — which
    teaches somebody on their first minute that most of this does not work.
    They are collected into one dashed strip at the bottom instead, by
    lockedStrip(), and each one appears in place the moment it can say
    something true. */
 if(st==='waiting')return '';
 const z=cur.SIZE[k]||'s';
 const html=CARDFN[k]().replace('class="card"',`class="card sz-${z}"`);
 /* A partial module draws what it has and says how much that is, rather
    than withholding a chart that would be true. */
 return st==='partial'
   ? html.replace('</div>$','').replace(/<\/div>\s*$/,
       `<p class="note partialnote">Drawn from ${moduleCount(k)} so far. It fills out as you log more.</p></div>`)
   : html}
function recentCard(){const shown=bets.slice(0,8);
 return `<div class="card" data-cardid="recent"><div class="hd"><b>Recent bets</b><button class="chip" data-go="ledger">View all</button></div>
 <div class="scrolly recent5">${shown.map((b,i)=>betRow(b,i)).join('')}</div>
 <div class="rcount">Showing 5 of ${bets.length}</div>
 <button class="btn ghost full sm mfoot" style="margin-top:10px;flex:0 0 auto" data-go="ledger">See all ${bets.length} in the ledger</button></div>`}
/* A TOTAL IS NOT A TREND.
 *
 * "bet365 £742" says where you are and nothing about which way you are
 * going, and the two lead to opposite decisions. The sparkline is eight
 * weeks of that one facet's running net: no axes, no labels, nothing to
 * read — only the shape, which is all a figure this small can carry. */
function sparkline(vals,neg){
 if(!vals||vals.length<2)return '';
 const w=64,h=20,mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;
 const pt=(v,i)=>[(i*(w-2)/(vals.length-1)+1).toFixed(1),(h-1-((v-mn)/rng)*(h-2)).toFixed(1)];
 const d=vals.map((v,i)=>pt(v,i).join(',')).join(' ');
 const last=pt(vals[vals.length-1],vals.length-1);
 const col=neg?'var(--neg)':'var(--pos)';
 return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false">
  <polyline points="${d}" fill="none" stroke="${col}" stroke-width="1.6"
   stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
  <circle cx="${last[0]}" cy="${last[1]}" r="2.1" fill="${col}"/></svg>`}

function breakdown(id,title,rows){
 /* 07 · A ZERO ANCHOR IN THE TRACK, so positives fill right and negatives
    fill left from the same point. A card with no negatives — By tipster —
    puts the anchor flush left and renders exactly as it did.
    AND A BET COUNT beside each name, because profit without volume ranks one
    lucky bet above forty disciplined ones. */
 const vals=rows.map(r=>r[5]!=null?r[5]:0);
 const nums=rows.map(r=>parseFloat(String(r[1]).replace(/[^0-9.-]/g,''))*(r[3]?-1:1));
 const lo=Math.min(0,...nums),hi=Math.max(0,...nums),range=(hi-lo)||1;
 const zero=(-lo/range)*100;
 return `<div class="card" data-cardid="${id}"><div class="hd"><b>${title}</b><span class="lbl">${PERIODS[cur.per].lab}</span></div>
 <div class="grow">${rows.map((r,i)=>{
  const w=(Math.abs(nums[i])/range)*100, left=nums[i]>0?zero:zero-w;
  return `<div class="barline"><div class="h">
   <span class="bn">${esc(r[0])}${r[5]!=null?`<em>${r[5]}</em>`:''}</span>
   <span class="hv">${sparkline(r[4],r[3])}<b style="color:var(--${r[3]?'neg':'pos'})">${r[1]}</b></span></div>
   <div class="track">${zero>0.5?`<i class="zeroline" style="left:${zero}%"></i>`:''}
    <div class="fill ${r[3]?'neg':''}" style="left:${left}%" data-w="${w.toFixed(1)}"></div></div></div>`}).join('')}</div></div>`}
/* 15 · WHAT IS YOURS AND WHAT WAS THE OFFER.
 *
 * Nobody shows this, and it is the honest answer to "am I actually winning" —
 * because for most UK bettors the answer is offers. A tracker that reports
 * +£3,171 without saying that £2,240 of it was sign-up money is agreeing with
 * a story its owner is telling themselves.
 *
 * Free bets, bonus funds and boosts are flagged at ingestion; the field is
 * already on the bet sheet. The split is stated, not implied by a chart.
 */
const BONUS_NET=224000;   /* pence, from flagged bets */
function alltimeCard(){
 const net=317100, own=net-BONUS_NET;
 const share=Math.round(BONUS_NET/net*100);
 return `<div class="card" data-cardid="alltime"><div class="lbl" style="margin-bottom:9px">All time</div>
 <div class="g2">${[['Net',money(net/100),1],['Units','+126.80u',0],['Win rate','41.0%',0],['ROI','+6.9%',1]]
  .map(s=>`<div class="stat"><div class="k">${s[0]}</div><div class="v mono"${s[2]?' style="color:var(--pos)"':''}>${s[1]}</div></div>`).join('')}</div>
 <div class="bonussplit">
  <div class="bsrow"><span>From offers and free bets</span><b class="mono">${money(BONUS_NET/100)}</b></div>
  <div class="bsrow own"><span>Your own betting</span><b class="mono ${own>=0?'pos2':'neg2'}">${money(own/100)}</b></div>
  <div class="bstrack" role="img"
   aria-label="${share} per cent of all-time net came from offers"><i style="width:${share}%"></i></div>
  <p class="note" style="margin:8px 0 0">${share}% of your all-time net came from offers. That is not a
   criticism — it is the number most trackers leave out.</p></div></div>`}
function bdCard(id,title,rows){
 /* 07 · A ZERO ANCHOR IN THE TRACK, so positives fill right and negatives
    fill left from the same point. A card with no negatives — By tipster —
    puts the anchor flush left and renders exactly as it did.
    AND A BET COUNT beside each name, because profit without volume ranks one
    lucky bet above forty disciplined ones. */
 const vals=rows.map(r=>r[5]!=null?r[5]:0);
 const nums=rows.map(r=>parseFloat(String(r[1]).replace(/[^0-9.-]/g,''))*(r[3]?-1:1));
 const lo=Math.min(0,...nums),hi=Math.max(0,...nums),range=(hi-lo)||1;
 const zero=(-lo/range)*100;
 return `<div class="card" data-cardid="${id}"><div class="hd"><b>${title}</b><span class="lbl">${PERIODS[cur.per].lab}</span></div>
 <div class="grow">${rows.map((r,i)=>{
  const w=(Math.abs(nums[i])/range)*100, left=nums[i]>0?zero:zero-w;
  return `<div class="barline"><div class="h">
   <span class="bn">${esc(r[0])}${r[5]!=null?`<em>${r[5]}</em>`:''}</span>
   <span class="hv">${sparkline(r[4],r[3])}<b style="color:var(--${r[3]?'neg':'pos'})">${r[1]}</b></span></div>
   <div class="track">${zero>0.5?`<i class="zeroline" style="left:${zero}%"></i>`:''}
    <div class="fill ${r[3]?'neg':''}" style="left:${left}%" data-w="${w.toFixed(1)}"></div></div></div>`}).join('')}</div></div>`}
function lineChart(vals,id){const w=300,h=110,pad=4;
 const mn=Math.min(0,...vals),mx=Math.max(...vals),rng=(mx-mn)||1;
 const X=i=>pad+i*(w-pad*2)/(vals.length-1), Y=v=>h-pad-((v-mn)/rng)*(h-pad*2);
 const pts=vals.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
 const area=`${pad},${Y(mn)} ${pts} ${w-pad},${Y(mn)}`;
 return `<svg data-chart viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;overflow:visible">
  <defs><linearGradient id="cg${id}" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="var(--p)" stop-opacity=".28"/><stop offset="1" stop-color="var(--p)" stop-opacity="0"/></linearGradient></defs>
  <line x1="${pad}" y1="${Y(0)}" x2="${w-pad}" y2="${Y(0)}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3"/>
  <polygon points="${area}" fill="url(#cg${id})"/>
  <polyline data-draw points="${pts}" fill="none" stroke="var(--s)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${X(vals.length-1)}" cy="${Y(vals[vals.length-1])}" r="3.4" fill="var(--s)"/></svg>`}
/* ═══ STAKING DISCIPLINE ═══════════════════════════════════════════════════
 *
 * It was six vertical bars of absolute stake with a dashed line across them
 * at one unit. At card size that asks the reader to do the arithmetic: read
 * each bar's height, find the line, judge the gap, six times. The question
 * is not "what did I stake" — it is "did I stake to plan", and the chart was
 * not answering it.
 *
 * One row per week, all sharing a baseline at 1 unit. A week on plan is a
 * dot on the line. A week over plan is a bar to the right of it, as long as
 * the overshoot, coloured by how far. Discipline is then a shape: a straight
 * column of dots is disciplined, and the one week you chased is the one bar
 * sticking out. Nothing has to be measured against anything.
 * ═══════════════════════════════════════════════════════════════════════ */
/* ═══ 12 · THE GROWING STATE ═══════════════════════════════════════════════
 *
 * The dashboard went from an empty state straight to a full one, so a new
 * user's second session showed several modules each holding a single data
 * point. A trend line through one bet is worse than no trend line, because
 * it invites a conclusion.
 *
 * ON THE OWNER'S INSTRUCTION the thresholds are as low as they can honestly
 * go — one bet, one week — and where a module can draw something true with
 * the data that exists, IT DRAWS IT rather than waiting. A two-week staking
 * chart is a real two-week staking chart. What is withheld is only the thing
 * that would be a lie: a line implying a trend through a single point.
 *
 * So a module is in one of three states, not two:
 *   ready      enough for the full thing
 *   partial    draws what it has, and says how much that is
 *   waiting    cannot say anything true yet, and says what unlocks it
 * ═══════════════════════════════════════════════════════════════════════ */
/* 18 · THREE PRESETS, and the default is the one that works with no data.
 *
 * "Keep it simple" is four modules, all of which render on the first bet.
 * Nothing on that dashboard is greyed out, so nobody's first minute is spent
 * looking at what the product cannot do yet.
 */
const PRESETS=[
 ['simple','Keep it simple','Net, Calendar, Running now, Recent bets'],
 ['results','Track my results','Those four, plus All time, Performance, By sport and By bookmaker'],
 ['edge','Analyse my edge','Everything, including staking discipline and odds bands']];

const PRESET_MODULES={
 simple:['net','cal','running','recent'],
 results:['net','cal','running','recent','alltime','curve','sport','book'],
 edge:null};   /* null means every module in DEFAULT_ORDER */

const MODULE_MIN={
 net:{ready:1},
 recent:{ready:1},
 cal:{ready:1},
 running:{ready:1},
 /* Two points is a comparison, which is the least a bar chart can honestly
    show. One point draws as a single bar with no trend line implied. */
 stake:{partial:1,ready:3},
 book:{partial:2,ready:5}, market:{partial:2,ready:5},
 sport:{partial:2,ready:5}, tips:{partial:2,ready:5},
 course:{partial:2,ready:5}, odds:{partial:2,ready:5}, dow:{partial:2,ready:5},
 curve:{partial:2,ready:3},
 oddsband:{partial:5,ready:20},
 /* The one genuine hold: a mean with no distribution behind it is the thing
    that misleads, and imported bets carry no closing price at all. */
 alltime:{ready:1}};

/** How many data points a module actually has right now. */
function moduleCount(id){
 const settled=bets.filter(b=>b[0]!=='o').length;
 if(id==='stake')return Math.min(6,Math.ceil(settled/2));
 if(id==='curve')return Math.min(12,Math.ceil(settled/3));
 if(id==='oddsband')return settled;
 if(id==='running')return OPEN_BETS.length;
 return settled;
}
function moduleState(id){
 const m=MODULE_MIN[id];if(!m)return 'ready';
 const n=moduleCount(id);
 if(n>=m.ready)return 'ready';
 if(m.partial!=null&&n>=m.partial)return 'partial';
 return 'waiting';
}
const MODULE_UNLOCK={
 stake:'Needs a week of bets',
 book:'Needs 5 bookmakers', market:'Needs 5 markets', sport:'Needs 5 sports',
 tips:'Needs 5 tipsters', course:'Needs 5 courses', odds:'Needs 5 prices',
 dow:'Needs 5 days', curve:'Needs 2 months', oddsband:'Needs 5 bets'};

/** A module that cannot say anything true yet, saying what unlocks it. */
function waitingCard(id,title){
 return `<div class="card waiting" data-cardid="${id}"><div class="hd">
  <b>${esc(title)}</b><span class="chip">${esc(MODULE_UNLOCK[id]||'Needs more bets')}</span></div></div>`}

/* ═══ 09 · RUNNING NOW ═════════════════════════════════════════════════════
 *
 * The daily-return route — open, check what is live, leave, thirty seconds —
 * had no module at all. This is that module, and it is the reason to build
 * it ahead of anything analytical.
 *
 * ON BOOKMAKER COLOUR. You cannot have thirty distinguishable dots; at 9px
 * the ceiling is about ten, and below roughly 0.08 separation in oklab two
 * dots read as the same colour. So ten are hand tuned for the books that
 * carry the volume and everything else is hashed against a desaturated ramp.
 * Every bookmaker gets a stable colour, ten are memorable, and the NAME is
 * the real identifier — which is why the name went back to the muted text
 * colour and only the dot carries brand.
 *
 * EXCHANGES ARE NOT BOOKMAKERS. They charge commission, so their P/L maths
 * differs. A hollow ring marks them without spending another colour.
 * ═══════════════════════════════════════════════════════════════════════ */
const BOOK_TIER1={'bet365':'#2BC48E','Sky Bet':'#5FB8FF','Paddy Power':'#A8D84A',
 'Betfair':'#F0B429','Ladbrokes':'#EF5F6B','Coral':'#FF9E7A','Betfred':'#8E8CF0',
 'William Hill':'#46C9D6','BoyleSports':'#E88ACF','Unibet':'#7FB2E8'};
const BOOK_TIER2=['#B37B7A','#AC8261','#968D5B','#76976E','#599A8E','#5996AA',
 '#738DB7','#9283B1','#AA7C9A'];
const EXCHANGES=new Set(['Betfair Exchange','Smarkets','Matchbook']);
function bookHash(n){let h=0x811c9dc5;
 for(const c of String(n).trim().toLowerCase()){h^=c.codePointAt(0);h=Math.imul(h,0x01000193)>>>0}
 return h}
function bookColour(n){return BOOK_TIER1[n]||BOOK_TIER2[bookHash(n)%BOOK_TIER2.length]}

const OPEN_BETS=[
 {n:'Arsenal v Spurs',b:'bet365',p:'1.90',s:25,ret:47.50,live:1,meta:"68' · 1-0"},
 {n:'Monaco v Roma',b:'Betfred',p:'2.51',s:25,ret:62.75,live:0,meta:'19:45'},
 {n:'York 16:10',b:'Sky Bet',p:'2.35',s:25,ret:58.75,live:0,meta:'Awaiting result'},
 {n:'Rublev v Fritz',b:'Smarkets',p:'2.41',s:30,ret:72.30,live:0,meta:'Awaiting result'}];

function runningCard(){
 const risk=OPEN_BETS.reduce((t,o)=>t+o.s,0);
 const ret=OPEN_BETS.reduce((t,o)=>t+o.ret,0);
 const live=OPEN_BETS.filter(o=>o.live).length;
 const showRet=modv('running','returns',true);
 const showBar=modv('running','bar',true);
 const sorted=modv('running','sort','kick')==='stake'
   ? [...OPEN_BETS].sort((a,b)=>b.s-a.s) : OPEN_BETS;
 return `<div class="card run" data-cardid="running"><div class="hd"><b>Running now</b>
  <span class="hdctl"><span class="chip live"><i></i>${live} live · ${OPEN_BETS.length-live} waiting</span>
   ${modMenu('running',[
    {type:'seg',label:'Sort by',key:'sort',value:'kick',items:[['kick','Kick off'],['stake','Stake']]},
    {type:'rule'},
    {type:'check',label:'Show potential return',key:'returns',value:true},
    {type:'check',label:'Show exposure bar',key:'bar',value:true}])}</span></div>
  ${showBar?`<div class="expobar">
   <div class="ebrow"><span>At risk</span>
    <span class="ebfig">${sym()}${risk.toFixed(2)}<span class="ebto"> to ${sym()}${ret.toFixed(2)}</span></span></div>
   <div class="ebtrack"><i class="ebrisk" style="width:${(risk/ret*100).toFixed(1)}%"></i>
    <i class="ebret" style="width:${(100-risk/ret*100).toFixed(1)}%"></i></div>
   <div class="ebrow" style="margin-top:7px"><span>${(risk/bankroll()*100).toFixed(1)}% of bankroll</span>
    <span>Profit if all land <b style="color:var(--pos)">+${sym()}${(ret-risk).toFixed(2)}</b></span></div>
  </div>`:''}
  ${sorted.map(o=>{const c=bookColour(o.b),ex=EXCHANGES.has(o.b);
   return `<div class="orow">
    <span class="bdot${o.live?' livedot':''}${ex?' ex':''}" style="background:${ex?'transparent':c};color:${c}"></span>
    <span class="oinfo"><span class="oname">${esc(o.n)}</span>
     <span class="osub"><span>${esc(o.b)}</span><span>${o.p}</span>
      <i class="osep"></i><span class="${o.live?'olive':''}">${esc(o.meta)}</span></span></span>
    <span class="oval"><span class="ostake">${sym()}${o.s.toFixed(2)}</span>
     ${showRet?`<span class="oret">to ${sym()}${o.ret.toFixed(2)}</span>`:''}</span></div>`}).join('')}
  <button class="btn ghost full sm" style="margin-top:12px" data-go="ledger">See all open bets</button></div>`}

/* ═══ 11 · BY ODDS BAND ════════════════════════════════════════════════════
 *
 * Almost every bettor has a price range where they are quietly bad and
 * cannot see it, because the ledger sorts by date and the breakdowns sort by
 * market. Net and bet count bucketed by price answers it in one look.
 *
 * A band holding fewer than ten bets greys out and says so, because there is
 * nothing to read in it yet and a confident bar over four bets is a lie.
 * Presets because a horse racing punter and a football punter do not want
 * the same buckets.
 * ═══════════════════════════════════════════════════════════════════════ */
const BANDS={
 std:[['Under 1.50',218,34],['1.50 to 2.00',364,58],['2.00 to 3.00',192,41],
      ['3.00 to 5.00',-118,16],['5.00 and up',-64,6]],
 short:[['Under 1.30',96,18],['1.30 to 1.60',248,37],['1.60 to 1.90',210,44],
        ['1.90 to 2.20',138,29],['2.20 and up',-120,27]],
 long:[['Under 2.00',582,92],['2.00 to 4.00',134,49],['4.00 to 8.00',-92,13],
       ['8.00 and up',-52,9]]};

function oddsBandCard(){
 const key=modv('oddsband','preset','std');
 const rows=BANDS[key];
 const W=470,RH=42,H=rows.length*RH+20;
 const max=Math.max(...rows.map(r=>Math.abs(r[1])))*1.2;
 const zero=W*0.44,sc=v=>v/max*(W-zero-78);
 let out=`<line x1="${zero}" y1="2" x2="${zero}" y2="${rows.length*RH+2}" stroke="var(--line)"/>
  <text x="${zero}" y="${H-3}" text-anchor="middle" font-size="10" fill="var(--t3)">£0</text>`;
 rows.forEach(([n,v,c],i)=>{
  const y=i*RH+RH/2, thin=c<10, len=sc(Math.abs(v));
  out+=`<text x="0" y="${y+4}" font-size="12" fill="${thin?'var(--t4)':'var(--t2)'}">${esc(n)}</text>
   <rect x="${(v>0?zero:zero-len).toFixed(1)}" y="${y-9}" width="${len.toFixed(1)}" height="18" rx="3"
     fill="${thin?'var(--elev)':(v>0?'var(--p)':'var(--neg)')}" opacity=".94"/>
   <text x="${W}" y="${y+1}" text-anchor="end" font-size="12.5" font-weight="700"
     fill="${thin?'var(--t4)':(v>0?'var(--pos)':'var(--neg)')}">${v>0?'+':'−'}${sym()}${Math.abs(v)}</text>
   <text x="${W}" y="${y+15}" text-anchor="end" font-size="10" fill="var(--t3)">${
     thin?'n='+c+' too few':'n='+c}</text>`});
 const label={std:'Standard',short:'Short prices',long:'Longshots'}[key];
 return `<div class="card" data-cardid="oddsband"><div class="hd"><b>By odds band</b>
  <span class="hdctl"><span class="lbl">${label}</span>${modMenu('oddsband',[
   {type:'seg',label:'Preset',key:'preset',value:'std',
    items:[['std','Standard'],['short','Short'],['long','Longshots']]},
   {type:'rule'},
   {type:'check',label:'Grey bands under 10 bets',key:'grey',value:true}])}</span></div>
  <div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
    aria-label="Net profit by odds band">${out}</svg></div>
  <div class="stakefoot"><span>Sorted by price, not by size</span>
   <span><b>n</b> = bets settled</span></div></div>`}

/* ═══ 06 · PERFORMANCE ═════════════════════════════════════════════════════
 *
 * Two cards became one. A bankroll curve and a cumulative profit curve are
 * the same shape offset by the starting balance, so there is one module with
 * a basis switch rather than two charts saying the same thing twice.
 *
 * The bar panel was 20px tall, which is a sparkline pretending to be a
 * chart: at that height Feb at −£140 and Aug at +£1,184 are both "a bar".
 * It is 150px now with labelled gridlines and a zero line, so magnitude is
 * READ rather than compared by eye, and the proportions stay true.
 *
 * % OF BANKROLL is the basis worth having. This bankroll went £1,000 to
 * £4,171 in a year, so £300 in January and £300 in August are not the same
 * achievement, and a flat pound chart says they are.
 *
 * Both stacks the two panels rather than putting a second axis on one plot.
 * A dual axis lets you slide the series until they tell any story you like.
 * ═══════════════════════════════════════════════════════════════════════ */
const MONTHS=[['Sep',120],['Oct',-80],['Nov',190],['Dec',60],['Jan',210],['Feb',-140],
 ['Mar',260],['Apr',170],['May',-110],['Jun',350],['Jul',240],['Aug',MTD]];
const BR_OPEN_BAL=1000;

function perfSeries(basis,span){
 const M=MONTHS.slice(-span);let bal=BR_OPEN_BAL;
 return M.map(([m,v])=>{const start=bal;bal+=v;
  if(basis==='u')return{m,bar:v/25,cum:(bal-BR_OPEN_BAL)/25};
  if(basis==='pc')return{m,bar:v/start*100,cum:(bal/BR_OPEN_BAL-1)*100};
  return{m,bar:v,cum:bal-BR_OPEN_BAL}});
}
function perfFmt(v,basis){
 const a=Math.abs(v),sign=v<0?'−':'';
 if(basis==='u')return sign+a.toFixed(a<10?1:0)+'u';
 if(basis==='pc')return sign+a.toFixed(0)+'%';
 return sign+'£'+(a>=1000?(a/1000).toFixed(1)+'k':Math.round(a));
}
function niceStep(range){const raw=range/3.2,p=Math.pow(10,Math.floor(Math.log10(raw)||0));
 for(const k of [1,2,2.5,5,10])if(p*k>=raw)return p*k;return p*10}

function perfCard(){
 const basis=modv('perf','basis','gbp');
 /* 03 · BARS BY DEFAULT, and the curve is opt-in.
    "Both" meant the two-panel axis problem — a shared y with two different
    scales — appeared on every dashboard whether or not anyone wanted the
    running total. It now only appears when asked for.
    A phone still opens on the curve: eight bars at 390px cannot be read.

    SIDE EFFECT, DELIBERATE. The running total is then not visible by default
    anywhere in the product. If that matters, the cheap fix is a sparkline in
    the All time card, not reversing this. */
 const shape=modv('perf','shape',innerWidth<760?'curve':'bars');
 const span=modv('perf','span',8);
 const S=perfSeries(basis,span);
 /* The viewBox width has to be near the *rendered* width or every label in
    the chart is scaled with it: at W=720 in a 1124px card, 10px type drew at
    15.6px, and on a 358px phone card the same 10px drew at 5px. */
 /* Span 8 of twelve inside a 1152px content box:
      col = (1152 - 11*16) / 12 = 81.33 ; W = 8*col + 7*16 - 32 = 731 */
 const W=innerWidth>=1000?731:Math.max(340,Math.round(innerWidth-64));
 const showB=shape!=='curve',showC=shape!=='bars';
 const barH=showB?150:0,curveH=showC?(shape==='both'?168:210):0,gap=shape==='both'?22:0;
 const H=curveH+gap+barH+26,pL=58;
 const X=i=>pL+i*((W-pL-32)/Math.max(1,S.length-1));
 let out='';

 if(showC){
  const cum=S.map(d=>d.cum),lo=Math.min(0,...cum),hi=Math.max(...cum);
  const Y=v=>6+(hi-v)/((hi-lo)||1)*(curveH-12);
  const d=cum.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
  out+=`<line x1="${pL-8}" y1="${Y(0)}" x2="${W}" y2="${Y(0)}" stroke="var(--line)" stroke-dasharray="3 3"/>
   <text x="${pL-12}" y="${Y(0)+4}" text-anchor="end" font-size="10" fill="var(--t3)">${perfFmt(0,basis)}</text>
   <text x="${pL-12}" y="${Y(hi)+4}" text-anchor="end" font-size="10" fill="var(--t3)">${perfFmt(hi,basis)}</text>
   <defs><linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="var(--pos)" stop-opacity=".22"/>
    <stop offset="1" stop-color="var(--pos)" stop-opacity="0"/></linearGradient></defs>
   <path d="${d} L${X(S.length-1)} ${Y(0)} L${X(0)} ${Y(0)} Z" fill="url(#pgrad)"/>
   <path d="${d}" fill="none" stroke="var(--pos)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
   <circle cx="${X(S.length-1)}" cy="${Y(cum[cum.length-1])}" r="4" fill="var(--pos)"/>`;
 }
 if(showB){
  const top=curveH+gap;
  /* The panel is split between up and down in proportion to the data, so one
     outlier does not waste the other half and every bar stays true. */
  const up=Math.max(0,...S.map(d=>d.bar))*1.08;
  const dn=Math.max(0,...S.map(d=>-d.bar))*1.15;
  const rng=(up+dn)||1,k=barH/rng,zero=top+up*k,Yb=v=>zero-v*k;
  const st=niceStep(rng);
  for(let g=st;g<=up;g+=st)out+=`<line x1="${pL-8}" y1="${Yb(g)}" x2="${W}" y2="${Yb(g)}" stroke="var(--line)" stroke-dasharray="3 4"/>
   <text x="${pL-12}" y="${Yb(g)+3.5}" text-anchor="end" font-size="9.5" fill="var(--t3)">${perfFmt(g,basis)}</text>`;
  for(let g=st;g<=dn;g+=st)out+=`<line x1="${pL-8}" y1="${Yb(-g)}" x2="${W}" y2="${Yb(-g)}" stroke="var(--line)" stroke-dasharray="3 4"/>
   <text x="${pL-12}" y="${Yb(-g)+3.5}" text-anchor="end" font-size="9.5" fill="var(--t3)">${perfFmt(-g,basis)}</text>`;
  out+=`<line x1="${pL-8}" y1="${zero}" x2="${W}" y2="${zero}" stroke="var(--t3)" stroke-width="1.2"/>
   <text x="${pL-12}" y="${zero+3.5}" text-anchor="end" font-size="9.5" fill="var(--t3)">${perfFmt(0,basis)}</text>`;
  const peak=Math.max(...S.map(d=>Math.abs(d.bar)));
  S.forEach((d,i)=>{const bw=Math.min(30,(W-pL-20)/S.length*0.62),x=X(i)-bw/2;
   const y=d.bar>0?Yb(d.bar):zero,h=Math.max(2,Math.abs(d.bar)*k);
   out+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"
     rx="3" fill="${d.bar>0?'var(--p)':'var(--neg)'}" opacity=".92"/>`;
   if(Math.abs(d.bar)===peak)out+=`<text x="${X(i)}" y="${d.bar>0?y-6:y+h+13}"
     text-anchor="${i===S.length-1?'end':'middle'}" font-size="10" font-weight="700"
     fill="${d.bar>0?'var(--pos)':'var(--neg)'}">${perfFmt(d.bar,basis)}</text>`});
 }
 S.forEach((d,i)=>{out+=`<text x="${X(i)}" y="${H-4}" text-anchor="middle" font-size="10" fill="var(--t3)">${d.m}</text>`});

 const bname={gbp:'Net £',u:'Units',pc:'% of bankroll'}[basis];
 return `<div class="card" data-cardid="curve"><div class="hd"><b>Performance</b>
  <span class="hdctl"><span class="lbl">${bname} · ${shape}</span>${modMenu('perf',[
   {type:'seg',label:'Measure in',key:'basis',value:'gbp',
    items:[['gbp','Net £'],['u','Units'],['pc','% of bankroll']]},
   {type:'seg',label:'Show',key:'shape',value:shape,
    items:[['bars','Bars'],['curve','Curve'],['both','Both']]},
   {type:'rule'},
   {type:'seg',label:'Period',key:'span',value:8,items:[[6,'6m'],[8,'8m'],[12,'12m']]}])}</span></div>
  <div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
    aria-label="Performance, ${bname}, last ${span} months">${out}</svg></div>
  <div class="stakefoot"><span>Profitable <b>${S.filter(d=>d.bar>0).length} of ${S.length}</b></span>
   <span>${shape==='both'?'Bars per month, curve is the running total'
     :shape==='bars'?'Each month on its own':'Running total'}</span></div></div>`}

/* ═══ 02 · THE MODULE MENU ═════════════════════════════════════════════════
 *
 * You already had a dots button on Net this month and on the calendar, and
 * an Edit overview entry in settings. This standardises what was half built
 * rather than inventing a new thing, and it keeps two levels apart:
 *
 *   the dots button   options belonging to THIS module, its own period if
 *                     it has one, and hide
 *   Edit overview     order, visibility and span across the dashboard
 *
 * A fixed registry of modules, not a freeform grid builder. A product with a
 * point of view is worth more than one that can be arranged into anything,
 * and reorder-and-hide covers almost every real preference.
 * ═══════════════════════════════════════════════════════════════════════ */
function modMenu(id, groups){
 const open = cur.openMenu === id;
 return `<div class="dots${open?' open':''}" data-modmenu="${id}">
  <button class="iconb" data-menutoggle="${id}" aria-label="Options for this card"
    aria-expanded="${open}" aria-label="Options for this module">⋯</button>
  <div class="menu" role="menu">
   ${groups.map(g=>{
    if(g.type==='seg')return `<div class="mh">${esc(g.label)}</div>
     <div class="grp">${g.items.map(it=>
      `<button data-modset="${id}:${g.key}:${it[0]}" aria-pressed="${
        (cur.mod[id]&&cur.mod[id][g.key]||g.value)===it[0]}">${esc(it[1])}</button>`).join('')}</div>`;
    if(g.type==='check')return `<button type="button" class="mi" role="menuitemcheckbox"
      data-modtog="${id}:${g.key}" aria-checked="${
       cur.mod[id]&&cur.mod[id][g.key]!==undefined?cur.mod[id][g.key]:g.value}">${esc(g.label)}</button>`;
    if(g.type==='rule')return '<hr>';
    return `<button type="button" class="mi" role="menuitem" data-modhide="${id}">${esc(g.label)}</button>`;
   }).join('')}
   <hr><button type="button" class="mi" role="menuitem" data-modhide="${id}">Hide this module</button>
  </div></div>`}

/** What a module has been set to, falling back to the declared default. */
function modv(id,key,dflt){
 return (cur.mod[id]&&cur.mod[id][key]!==undefined)?cur.mod[id][key]:dflt;
}

/* ═══ 05 · STAKING DISCIPLINE, ANCHORED TO THE UNIT ════════════════════════
 *
 * The previous version used two visual languages for one variable: on-plan
 * weeks got a dot, over weeks got a bar, so no two weeks could be compared.
 * Bars also grew from the left edge rather than from the unit, so there was
 * no anchor, and under-staking could not be drawn at all — which matters,
 * because quietly under-betting your edge costs as much as chasing.
 *
 * One language now. The unit is a labelled line with a tolerance band, and
 * every week is a bar measured from it. Zero length is exactly on plan.
 * Under runs left, over runs right.
 * ═══════════════════════════════════════════════════════════════════════ */
function stakeChart(rows,unit){
 const tol=(cur.stakeTol||10)/100;
 const dev=rows.map(r=>r[1]-unit);
 const reach=Math.max(unit*0.35,...dev.map(Math.abs))*1.12;
 /* The unit line sits where zero deviation falls on a track that has to hold
    both directions. */
 const mid=50;
 const onPlan=dev.filter(d=>Math.abs(d)/unit<=tol).length;
 return `<div class="stakeplot">
  <div class="stakeaxis"><span class="sunit" style="left:${mid}%">${sym()}${unit} unit</span>
   <span class="stolL" style="left:${mid-(tol*unit/reach)*mid}%;width:${(tol*unit/reach)*mid*2}%"></span></div>
  ${rows.map(r=>{
   const d=r[1]-unit, pct=Math.abs(d)/reach*mid;
   const rel=Math.abs(d)/unit;
   const inBand=rel<=tol;
   const tone=inBand?'ok':rel>0.5?'neg':'a';
   const left=d>=0?mid:mid-pct;
   return `<div class="stakerow">
    <span class="sw2">${esc(r[0])}</span>
    <span class="strack">
     <i class="sband" style="left:${mid-(tol*unit/reach)*mid}%;width:${(tol*unit/reach)*mid*2}%"></i>
     <i class="sbase" style="left:${mid}%"></i>
     ${Math.abs(pct)<0.6
       ? `<i class="sdot" style="left:${mid}%"></i>`
       : `<i class="sbar ${tone}" data-bar style="left:${left}%;width:0;--tw:${pct.toFixed(1)}%"></i>`}
    </span>
    <b class="sval ${inBand?'':tone}">${inBand?'on plan':(d>0?'+':'−')+sym()+Math.abs(d).toFixed(0)}</b>
   </div>`}).join('')}
 </div>
 <div class="callegend"><span><i class="sw p"></i>Within ${cur.stakeTol||10}%</span>
  <span><i class="sw a"></i>Over</span><span><i class="sw n"></i>Well over</span></div>
 <div class="stakefoot"><span>On plan <b>${onPlan} of ${rows.length} weeks</b></span>
  <span>Average <b>${sym()}${Math.round(rows.reduce((t,r)=>t+r[1],0)/rows.length)}</b> against a <b>${sym()}${unit}</b> unit</span></div>`}
function barChart(rows){const mx=Math.max(...rows.map(r=>Math.abs(r[1])))||1;
 return `<div style="display:flex;align-items:flex-end;gap:6px;height:104px;margin:4px 0 8px">
  ${rows.map(r=>{const pos=r[1]>=0,hh=Math.max(4,Math.abs(r[1])/mx*82);
   return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0">
    <div data-bar style="width:100%;max-width:26px;height:0;--th:${hh}px;border-radius:5px 5px 2px 2px;
     background:${pos?'linear-gradient(180deg,var(--s),var(--p))':'linear-gradient(180deg,var(--neg),color-mix(in srgb,var(--neg) 65%,#000))'}"></div>
    <span style="font-size:9px;color:var(--t3)">${r[0]}</span></div>`}).join('')}</div>`}
const CARDFN={net:netCard,cal:calCard,recent:recentCard,
 curve:perfCard,
 months:perfCard,
 /* ═══ 08 · CLOSING LINE VALUE, HELD BACK ═════════════════════════════════
  *
  * Greyed and flagged rather than hidden or shipped. Three reasons it is not
  * ready, and all three change the number rather than the presentation:
  *
  *   IMPORTED HISTORY HAS NO CLOSING PRICE. Shipped as it stands, the figure
  *   averages over whichever bets happen to be priced and silently
  *   overstates itself.
  *
  *   The header has to read "84 of 312 priced", not a bare percentage, or it
  *   claims a sample it does not have.
  *
  *   A mean alone cannot say whether somebody is consistently a little sharp
  *   or occasionally very lucky, which is the entire question. The
  *   distribution is not optional.
  *
  * The shape is drawn as a skeleton rather than with invented figures, so
  * anybody who sees it knows what is arriving without being told a number
  * that is not real. Greying a module you have decided about beats hiding
  * it: it says the product has a plan. */
 stake:()=>`<div class="card" data-cardid="stake"><div class="hd"><b>Staking discipline</b>
  <span class="hdctl"><span class="lbl">Last 6 weeks</span>${modMenu('stake',[
   {type:'seg',label:'Tolerance',key:'tol',value:10,items:[[5,'5%'],[10,'10%'],[20,'20%']]},
   {type:'rule'},
   {type:'check',label:'Show week labels',key:'labels',value:true},
   {type:'check',label:'Show under staking only',key:'under',value:false}])}</span></div>
  ${stakeChart([['14 Jul',25],['21 Jul',22],['28 Jul',27],['4 Aug',48],['11 Aug',33],['18 Aug',25]],25)}</div>`,
 course:()=>breakdown('course','By course',[['York','£142',72,0,[18,34,52,48,78,104,126,142]],['Kempton','£96',49,0,[10,26,38,44,58,72,86,96]],['Ascot','£54',27,0,[6,12,20,26,34,42,48,54]],['Newmarket','−£38',19,1,[-4,-8,-6,-14,-20,-27,-33,-38]]]),
 odds:()=>bdCard('odds','By odds range',[['1.00 – 1.50','£96',20,0],['1.51 – 2.00','£438',66,0],['2.01 – 3.00','£512',78,0],['3.01 – 5.00','−£41',9,1],['5.00 +','−£120',18,1]]),
 dow:()=>bdCard('dow','By day of week',[['Saturday','£604',88,0],['Sunday','£301',46,0],['Wednesday','£188',29,0],['Tuesday','−£74',12,1]]),
 sport:()=>bdCard('sport','By sport',[['Football','£812',86,0,[110,190,260,340,468,590,704,812],58],['Horse racing','£262',31,0,[44,70,120,98,166,198,240,262],26],['Tennis','−£58',9,1,[-5,-12,-9,-22,-30,-41,-50,-58],12]]),
 book:()=>breakdown('book','By bookmaker',[['bet365','£742',88,0,[120,180,150,240,310,402,588,742],41],['Sky Bet','£310',42,0,[40,96,88,140,190,214,268,310],29],['Ladbrokes','−£96',14,1,[-8,-14,-30,-22,-51,-64,-88,-96],16]]),
 market:()=>breakdown('market','By market',[['Home win','£412',72,0,[60,90,145,132,208,296,350,412],31],['Both teams to score','£268',47,0,[30,58,96,120,164,190,236,268],24],['Overs','£141',25,0,[18,44,38,72,90,116,128,141],18],['Player to score','£96',17,0,[12,20,44,36,58,71,88,96],11],['Unders','−£62',11,1,[-6,-10,-24,-18,-33,-44,-55,-62],12]]),
 tips:()=>breakdown('tips','By tipster',[['Own picks','£552',82,0,[80,140,190,265,330,418,486,552],63],['BlueSlip','£404',62,0,[50,88,132,176,240,300,356,404],33]]),
 oddsband:oddsBandCard,
 running:runningCard,
 alltime:alltimeCard};


V.overview={nav:'dash',tab:'OVERVIEW',run:1,html:()=>{
 const top=cur.order.filter(k=>cur.above.includes(k)),more=cur.order.filter(k=>!cur.above.includes(k));
  return `<div class="pane grid">${top.map(k=>szCard(k)).join('')}
 ${more.length?`<details class="disc"><summary style="border:0;justify-content:flex-end;gap:8px"><span class="caret">▾</span><b style="font-size:14px">Show more</b></summary>
  <div style="margin-top:11px">${more.map(k=>szCard(k)).join('')}</div></details>`:''}
 ${lockedStrip()}
 <button class="btn ghost full sm" style="margin-top:6px" data-sheet="editov">Edit overview</button></div>`}};

/* ═══ LANDING ═══ */
/* THE EXPLAINER, AS A VIDEO.
 *
 * Not the storyboard below it: those six scenes are live components showing
 * real figures and reacting to the theme switcher, and rendering them to MP4
 * would freeze them to one palette and break seven of the eight themes. This
 * is a separate, linear thing for somebody who has not scrolled yet.
 *
 * preload="none" so it costs nothing until asked for, a poster so the space
 * is not empty while it waits, muted and playsinline because there is no
 * audio track and iOS will not play inline without it, and no autoplay: a
 * video that starts by itself on a page about money is an ambush. */
/* ═══════════════════════════════════════════════════════════════════════
 * ONE FILM PER SECTION, IN THE SHAPE THE DEVICE IS
 *
 * These replace five separate storyboards: the six-scene autoplay deck, the
 * Telegram preview, the import deck, the social deck and the settlement
 * carousel. Between them they were most of the thirty eight infinite
 * animations the page was running, each with its own timer, its own arrows
 * and its own dots, and no two of them moved the same way.
 *
 * WHY THE SHAPE MATTERS. A 16:9 clip on a phone is a 200px letterbox with
 * type nobody can read; a 9:16 clip on a laptop is a column of black either
 * side. `<source media>` is not honoured inside `<video>` — only inside
 * `<picture>` — so the choice is made once in script, before anything is
 * fetched, and again if the window crosses the breakpoint. Each cut is its
 * own Remotion composition rather than a crop, so the phone version is
 * laid out for a phone rather than having its right-hand words removed.
 *
 * NOTHING LOADS UNTIL ASKED. preload="none" and a poster, so a page with six
 * films on it costs six JPEGs. No autoplay: a video that starts by itself on
 * a page about money is an ambush. There is no audio track at all, which the
 * caption says, so nobody has to press play to find out.
 * ═══════════════════════════════════════════════════════════════════════ */
const FILM_TALL = '(max-width: 760px)';

function film(name, label){
  /* 04 · The brief's rule for a surviving video is: muted, looping, inline,
     no controls, starting on its own. It also takes the videos out until they
     are redone — and they are out, so nothing on the landing page calls this
     any more.

     The helper stays exactly as written, because the reasoning recorded
     against it holds for whatever uses it next: a page about somebody's money
     should not start moving at them unasked, and a film nobody requested
     should not cost them the bandwidth. `preload="none"` is that second half.
     When the films come back, this is the decision to revisit. */
  return `<figure class="filmwrap" data-film="${name}">
 <video class="film" controls preload="none" playsinline muted
   aria-label="${esc(label)}"></video>
</figure>`;
}

/* Sources are set here rather than in the markup so the browser cannot start
   fetching the wrong shape before the media query has been read. */
function setFilmSources(){
  const tall = matchMedia(FILM_TALL).matches;
  ph.querySelectorAll('[data-film]').forEach(fig=>{
    const name = fig.dataset.film;
    const v = fig.querySelector('video');
    if(!v) return;
    const suffix = tall ? '-tall' : '';
    if(v.dataset.shape === suffix) return;      /* already the right cut */
    /* Swapping the shape mid-playback would restart it, so a film somebody
       is watching keeps the cut it started in. */
    if(!v.paused && v.currentTime > 0) return;
    v.dataset.shape = suffix;
    v.poster = `/video/${name}${suffix}-poster.jpg`;
    v.innerHTML =
      `<source src="/video/${name}${suffix}.webm" type="video/webm">` +
      `<source src="/video/${name}${suffix}.mp4" type="video/mp4">` +
      `<p class="note">Your browser cannot play this. ` +
      `<a href="/video/${name}${suffix}.mp4">Download it instead.</a></p>`;
    v.load();
  });
}

let filmMQ = null;
function bindFilms(){
  setFilmSources();
  if(filmMQ) return;
  filmMQ = matchMedia(FILM_TALL);
  filmMQ.addEventListener('change', setFilmSources);
  /* One film at a time. Two playing at once on a marketing page is a bug
     nobody reports and everybody notices. */
  on(document,'play',e=>{
    if(!(e.target instanceof HTMLVideoElement))return;
    document.querySelectorAll('video').forEach(v=>{if(v!==e.target&&!v.paused)v.pause()});
  },true);
}

/* The explainer is one of the six now, so it goes through the same helper
   and gets the same two cuts as the rest. Six films that behave differently
   is what the landing page looked like before. */
/* ═══ 04 · SETTLED EITHER WAY, AS AN ANIMATION RATHER THAN A VIDEO ═════════
 *
 * The film this replaces showed a frame with `Stake £40.00`, an empty
 * `Returned` and a progress bar where a verdict belongs — a still of a bet
 * mid-settlement, on the section whose whole claim is that settlement
 * finishes. It also shipped with controls and no autoplay, so it never moved.
 *
 * This is ~2KB of markup and CSS instead. It follows every theme because it
 * uses the tokens, it costs no bandwidth, and it cannot show the wrong frame
 * because there is no frame to show.
 *
 * HOW IT READS. A scanner gloss sweeps down the slip while the legs resolve
 * one at a time, and stops dead when the verdict lands — the sweep means
 * "still working" and its absence means "done", which is the whole grammar.
 * Legs resolve at 430ms apart, the verdict 320ms after the last one.
 *
 * The dots are real buttons, so the six outcomes are reachable by keyboard
 * and by anyone who wants to see the one that matters to them rather than
 * waiting for it to come round.
 */
const SETTLE_CASES=[
 {k:'won',   book:'bet365',   verdict:'Won',              amt:'+£80.00', tone:'pos', stake:100, ret:180,
  legs:[['Under 4 Cards','w'],['Under 4.5 Shots on Target','w'],['Under 11.5 Shots','w'],['Juventus to win','w']]},
 {k:'lost',  book:'Sky Bet',  verdict:'Lost',             amt:'−£40.00', tone:'neg', stake:40, ret:0,
  legs:[['Arsenal to win','w'],['Over 2.5 Goals','l'],['Sinner to win','w']]},
 {k:'void',  book:'Coral',    verdict:'Void',             amt:'£0.00',   tone:'t2',  stake:25, ret:25,
  legs:[['Selection 4, Kempton','v']]},
 {k:'cashp', book:'Betfred',  verdict:'Cash out, ahead',  amt:'+£28.50', tone:'a',   stake:50, ret:78.5,
  legs:[['Brentford to win','w'],['Over 1.5 Goals','c']]},
 {k:'cashl', book:'Ladbrokes',verdict:'Cash out, behind', amt:'−£28.80', tone:'a',   stake:60, ret:31.2,
  legs:[['Sevilla to win','c'],['Both teams to score','l']]},
 {k:'cashf', book:'Sky Bet',  verdict:'Cash out, level',  amt:'£0.00',   tone:'a',   stake:30, ret:30,
  legs:[['Rublev to win','c']]}];

const SETTLE_MARK={w:'✓',l:'✕',v:'–',c:'£'};

function settleDemo(){
 const i=cur.settleI||0, c=SETTLE_CASES[i];
 /* The last leg lands at (n-1)*430ms; the verdict 320ms after it. The sweep
    runs for exactly that long and then stops, which is what says "settled". */
 const last=(c.legs.length-1)*430, done=last+320;
 return `<div class="settlebox" data-settledemo>
  <div class="slipcard" style="--settle-run:${done}ms">
   <span class="scan" aria-hidden="true"></span>
   <div class="sliphd"><b>${c.legs.length===1?'Single':c.legs.length+' legs'} · ${esc(c.book)}</b>
    <span class="chip">${c.legs.length} leg${c.legs.length>1?'s':''}</span></div>
   ${c.legs.map((l,n)=>`<div class="sleg" style="animation-delay:${n*430}ms">
     <span class="smk ${l[1]}" aria-hidden="true">${SETTLE_MARK[l[1]]}</span>
     <span class="sname">${esc(l[0])}</span></div>`).join('')}
   <div class="sfootrow">
    <span>Stake<b class="mono">${amount(c.stake)}</b></span>
    <span class="r">Returned<b class="mono">${amount(c.ret)}</b></span></div>
   <div class="sverdict ${c.tone}" style="animation-delay:${done}ms">
    ${esc(c.verdict)} · <span class="mono">${c.amt}</span></div>
  </div>
  <div class="sdots" role="tablist" aria-label="Six ways a bet can settle">
   ${SETTLE_CASES.map((x,n)=>`<button type="button" role="tab" data-settlego="${n}"
     aria-selected="${n===i}" aria-label="${esc(x.verdict)}"><i></i></button>`).join('')}</div>
 </div>`}

const EXPLAINER = () => film('explainer', 'How Slippery works, in three steps');

const WAVES=`<div class="waves" aria-hidden="true"><svg viewBox="0 0 1440 300" preserveAspectRatio="none"><defs>
 <linearGradient id="ga" x1="0" x2="1"><stop offset="0" stop-color="var(--lg1)" stop-opacity="0"/><stop offset=".32" stop-color="var(--lg1)"/><stop offset=".7" stop-color="var(--lg2)"/><stop offset="1" stop-color="var(--lg2)" stop-opacity="0"/></linearGradient>
 <linearGradient id="gb" x1="0" x2="1"><stop offset="0" stop-color="var(--lg1)" stop-opacity="0"/><stop offset=".32" stop-color="var(--lg2)"/><stop offset=".7" stop-color="var(--lg2)"/><stop offset="1" stop-color="var(--lg2)" stop-opacity="0"/></linearGradient>
 <filter id="b1" x="-40%" y="-200%" width="180%" height="500%"><feGaussianBlur stdDeviation="1.3"/></filter>
 <filter id="b2" x="-40%" y="-200%" width="180%" height="500%"><feGaussianBlur stdDeviation="3.6"/></filter></defs>
 <g filter="url(#b1)"><path class="rb rb1" d="M-200 140C180 80 460 210 740 120S1240 50 1640 130" stroke="url(#ga)" stroke-width="15" fill="none" stroke-linecap="round"/>
 <path class="rb rb2" d="M-200 195C250 255 520 100 820 180S1280 240 1640 155" stroke="url(#gb)" stroke-width="11" fill="none" stroke-linecap="round"/></g>
 <g filter="url(#b2)"><path class="rb rb3" d="M-200 95C300 165 560 45 900 110S1300 165 1640 90" stroke="url(#ga)" stroke-width="20" fill="none" stroke-linecap="round"/>
 <path class="rb rb4" d="M-200 235C340 185 640 275 980 220S1340 175 1640 230" stroke="url(#gb)" stroke-width="24" fill="none" stroke-linecap="round"/></g></svg></div>`;

/* The five storyboards that used to live here — the settlement carousel,
   the social deck, the import deck, the Telegram preview and the six-scene
   film — are Remotion films now. Roughly 240 lines of absolutely positioned
   scenes, each with its own timer and its own pair of arrows, and no two of
   them moving the same way. See video/src/Films.tsx. */

V.landing={bare:1,html:()=>`
<header class="topbar">${BRANDMARK}
 <nav class="tnav">${[['How it works','how'],['Pricing','price'],['FAQs','faq']].map(x=>`<button data-scroll="${x[1]}">${x[0]}</button>`).join('')}
  <button data-go="demo">Demo</button><button data-go="login">Sign in</button>
  <button class="btn sm" data-go="su1">Get started</button></nav>
 <button class="burger" data-sheet="menu" aria-label="Open menu"><span></span><span></span></button></header>
<div class="lhero"><div class="inner">
 <div class="herocol">
  <p class="leyebrow">Bet tracking for UK and Irish bettors</p>
  <h1 class="lh1">Don't let your profit <em>slip.</em></h1>
  <p class="lsub">Forward a slip to the bot before kick off, in play, or after it settled. Slippery reads it, settles it, keeps the record.</p>
  <!-- 22 · THE DEMO IS A PEER, NOT A FOOTNOTE. It is a fully populated
       dashboard and the strongest asset on the page; it was 13px of
       underlined text under the primary button. -->
  <div class="herocta"><button class="btn" data-go="su1">Start tracking free</button>
   <button class="btn ghost" data-go="demo">See a live demo</button></div>
  <!-- A price and a trust line above the fold. £3.49 only appeared after a
       scroll, and a cheap stated price is a strength in this market. The
       "not a bookmaker" line lived in the FAQs, which is too late for the
       share of arrivals who assume this is another book and bounce. -->
  <p class="herotrust">£3.49 a month after the trial.
   <b>Slippery records bets. It does not take them.</b></p>
  <!-- 04 · The App Store and Google Play badges are gone. Both stores
       require a live listing before their badge may be displayed at all, so
       showing one for an app that does not exist yet is a brand-guidelines
       breach as well as a promise nobody asked for. One honest line. -->
  <p class="storenote">Works in any browser today. Native apps are coming.</p>
 </div>
 <div class="heroshot">${shotFrame()}</div>
 </div>
 <div class="wavewrap">${WAVES}</div></div>

<div class="lsec" data-sec="how"><h2 class="lh2" style="text-align:center">Three steps, then it runs itself.</h2>
  <ol class="steps">
  <li><span class="dot" aria-hidden="true"></span><div><h3>Send the screenshot</h3><p>One slip or several at once.</p></div></li>
  <li><span class="dot" aria-hidden="true"></span><div><h3>It reads every leg</h3><p>Stake, price, selections, bookmaker.</p></div></li>
  <li><span class="dot" aria-hidden="true"></span><div><h3>You confirm, it tracks</h3><p>Settles itself at full time.</p></div></li></ol></div>

<div class="lsec c" data-sec="settle"><h2 class="lh2">Every slip, settled either way.</h2>
 ${settleDemo()}
 <!-- Six outcomes, named in text as well as shown, because the animation is
      one at a time and this is the accessible version of the same thing. -->
 <ul class="outcomes">${[['Won','Stake back, plus profit','pos'],
  ['Lost','Stake gone','neg'],['Void','Stake back, £0 profit',''],
  ['Cash out, ahead','What you actually took','pos'],
  ['Cash out, behind','What you actually took','neg'],
  ['Cash out, level','Stake back, £0 profit','']]
  .map(o=>`<li><b class="${o[2]}">${o[0]}</b><span>${o[1]}</span></li>`).join('')}</ul></div>

<div class="lsec c" data-sec="tour"><h2 class="lh2">See it in action.</h2>
 </div>

<div class="lsec c"><h2 class="lh2">Send a bet on Telegram.<br>It is tracked instantly.</h2>
 <div class="tgbox">
  <div class="tgcard"><span class="tgicon">${TG}</span>
   <div style="text-align:left;flex:1;min-width:0"><b style="font-size:14px;display:block">@SlipperyAppBot</b>
    <span style="font-size:11.5px;color:var(--t3)">Private chat or group</span></div>
   <span class="pill g">Live</span></div>
  <ul class="tgflow">
   ${[['Create an account','You get a code'],['Paste it to the bot','One time only'],['Forward slips','Or add it to a group']].map(x=>`
    <li class="tgstep"><span class="tgn"></span><div><b>${x[0]}</b><span>${x[1]}</span></div></li>`).join('')}</ul>
  </div></div>

<div class="lsec c payhue" data-sec="price"><h2 class="lh2">Pick how you pay.</h2>
 <p class="lsub" style="margin-bottom:24px">One product. Monthly and annual are the same thing, billed differently.</p>
 <div class="plans2">
 <div class="plan"><div class="top"><h3>Free trial</h3></div>
  <div class="price"><b style="font-size:34px">£0</b></div>
  <ul><li>5 days or 15 slips, whichever ends sooner</li><li>Longer with a referral or promo code</li></ul>
  <button class="btn text full plancta" data-go="su1">Start free</button></div>
 <div class="plan"><div class="top"><h3>Monthly</h3></div>
  <div class="price"><b style="font-size:34px">£3.49</b><span style="font-size:13px;color:var(--t3)">a month</span></div>
  <p class="pn">Charged today, then every month.</p>
  <ul><li>Unlimited slips</li></ul>
  <button class="btn ghost full plancta" data-go="su1">Choose monthly</button></div>
 <div class="plan pick2"><div class="top"><h3>Annual</h3><span class="badge">Most popular</span></div>
  <div class="price"><b style="font-size:34px">£29.99</b><span style="font-size:13px;color:var(--t3)">a year</span><span class="was">£34.99</span></div>
  <div class="saveline">£2.50 a month · save £11.89</div>
  <p class="pn">Charged today, then every year.</p>
  <ul><li>Unlimited slips</li><li>Priority slip reading</li><li>Profile verification review</li></ul>
  <button class="btn full plancta" data-go="su1">Choose annual</button></div></div></div>

<div class="lsec c" data-sec="import"><h2 class="lh2">Switch in seconds.</h2>
 <div class="tgbox aura">
  <ul class="tgflow">
   ${[['Export from your old tracker','CSV or Excel, however it comes out'],['Drop the file in','No column mapping to learn'],['Every row read and checked','Duplicates flagged, nothing overwritten']].map(x=>`
    <li class="tgstep"><span class="tgn"></span><div><b>${x[0]}</b><span>${x[1]}</span></div></li>`).join('')}</ul>
  </div></div>
<div class="lsec c newfeat" data-sec="social"><span class="newtag">New</span>
 <h2 class="lh2">Friends, ranked honestly.</h2>
 </div>
<div class="lsec c" data-sec="themes"><h2 class="lh2">Pick a theme.</h2>
 <div class="themerow">${THEMES.map(t=>`
  <button class="swatch" data-theme="${t[0]}" aria-label="${t[1]} theme" title="${t[1]}">
   <span class="sw" style="background:${t[3]}"><i style="background:${t[4]}"></i></span><span class="swn">${t[1]}</span></button>`).join('')}</div></div>
<div class="lsec" data-sec="faq"><h2 class="lh2" style="text-align:center">FAQs</h2>
 <div class="qcat">Reading slips</div>
 <div class="faqbox">
  <details class="q"><summary>What bookmakers are supported?</summary><p>${BOOKS.map(c=>`<b>${c[0]}</b><br>${c[1].join(', ')}`).join('<br><br>')}<br><br>Not listed? Add any bookmaker as a custom entry and it will read those slips too.</p></details>
  <details class="q"><summary>What happens when it misreads one?</summary><p>You see every field before it saves and can correct any of them.</p></details>
  <details class="q"><summary>Can it read several bets in one screenshot?</summary><p>Yes. It splits them and shows each one separately.</p></details>
 </div>
 <div class="qcat">Settlement</div>
 <div class="faqbox">
  <details class="q"><summary>How are multi-leg bets settled?</summary><p>Legs on one fixture settle at the single price you were given. Legs across separate fixtures multiply, so a void leg reprices the bet.</p></details>
  <details class="q"><summary>What if a result cannot be found?</summary><p>The bet is flagged and you pick the result.</p></details>
 </div>
 <div class="qcat">Your data</div>
 <div class="faqbox">
  <details class="q"><summary>Does it handle cash out and void?</summary><p>Yes. Cashed bets record what you took, void bets return the stake and count as neither a win nor a loss.</p></details>
  <details class="q"><summary>Can imported history affect my win rate?</summary><p>No. Imported figures never touch win rate, streaks, or best and worst day.</p></details>
 </div>
 <div class="qcat">Billing</div>
 <div class="faqbox">
  <details class="q"><summary>What does a referral code get me?</summary><p>${TRIAL.ref}, and you and the person who referred you follow each other.</p></details>
  <details class="q"><summary>What if I cancel?</summary><p>Export everything as CSV, JSON or PDF at any time, including after cancelling.</p></details>
  <details class="q"><summary>What ends the free trial?</summary><p>${TRIAL.base}, whichever runs out first.</p></details>
 </div>
</div>

<div class="lfoot"><div style="display:flex;justify-content:center">${BRAND}</div>
  <nav>${[['How it works','how'],['Pricing','price'],['Bookmakers','faq'],['FAQs','faq']].map(x=>`<button style="font-size:13px;color:var(--t2)" data-scroll="${x[1]}">${x[0]}</button>`).join('')}
  <button style="font-size:13px;color:var(--t2)" data-go="demo">Demo</button>
  <button style="font-size:13px;color:var(--t2)" data-sheet="changelog">Changelog</button>
  <button style="font-size:13px;color:var(--t2)" data-sheet="support">Support</button>
  </nav>
 <div class="rule"></div>
 <p>© 2026 Slippery. Slippery tracks bets. It does not accept them and never handles money.</p>
 <div class="legal"><button data-sheet="terms">Terms</button><button data-sheet="privacypol">Privacy</button><button data-sheet="support">Feedback</button></div>
 <div class="age"><i>18+</i><span>Please gamble responsibly. <b style="color:var(--t2)">BeGambleAware.org</b></span></div>
 <p style="margin-top:10px;font-size:11.5px">National Gambling Helpline 0808 8020 133, free and confidential, 24 hours a day.</p></div>`};

function shotCal(){return `<div class="card" data-cardid="cal"><div class="hd"><b>August 2026</b><span class="lbl">This month</span></div>
 <div class="calwrap"><div class="cal chartfill" data-cal="auto"></div></div>
 <div class="callegend"><span><i class="sw p"></i>Profitable</span><span><i class="sw n"></i>Losing</span><span><i class="sw z"></i>No bets</span></div></div>`}
function shotFrame(){return `<div class="shotframe" style="border-radius:14px;overflow:hidden;border:1px solid var(--line);background:var(--elev)">
 <div style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:rgba(255,255,255,.05);border-bottom:1px solid var(--line)">
  <span style="width:8px;height:8px;border-radius:50%;background:#FF5F57"></span><span style="width:8px;height:8px;border-radius:50%;background:#FEBC2E"></span>
  <span style="width:8px;height:8px;border-radius:50%;background:#28C840"></span>
  <span class="mono" style="flex:1;text-align:center;font-size:10px;color:var(--t3)">slippery.app</span></div>
 <div style="padding:12px;text-align:left" id="shotBody" inert aria-hidden="true">${netCard()}${shotCal()}</div></div>`}

/* ═══ other views ═══ */
const FIXTURES=[
 ['Arsenal v Spurs','Sat 15:00','Premier League','Football'],
 ['Arsenal v Newcastle','Wed 20:00','Premier League','Football'],
 ['Aston Villa v Everton','Sat 15:00','Premier League','Football'],
 ['Brentford v Wolves','Sun 14:00','Premier League','Football'],
 ['Chelsea v Brighton','Sat 17:30','Premier League','Football'],
 ['Leeds v Burnley','Sat 12:30','Championship','Football'],
 ['Celtic v Rangers','Sun 12:00','Scottish Premiership','Football'],
 ['Inter v Milan','Sat 19:45','Serie A','Football'],
 ['Bayern v Villa','Tue 20:00','Champions League','Football'],
 ['Kempton 19:45','Tonight','Kempton Park','Horse racing'],
 ['Ascot 14:30','Sat','Ascot','Horse racing'],
 ['York 16:10','Sat','York','Horse racing'],
 ['Sinner v Alcaraz','Sun 13:00','ATP Masters','Tennis'],
 ['Rublev v Fritz','Fri 18:00','ATP Masters','Tennis']];
const MARKETS={Football:['Match result','Both teams to score','Over 2.5 goals','Under 2.5 goals','Anytime goalscorer','Player shots on target','Total corners','Double chance'],
 'Horse racing':['Win','Each way','Place','Forecast'],
 Tennis:['Match winner','Total games','Set betting','Handicap games']};
const CHECK=[['Set your unit','unit',1],['Connect Telegram','bot',0],['Log your first bet','import',0],['Join a group','social',0]];
/* ═══ 17 · THE ONBOARDING PREVIEW ═════════════════════════════════════════
 *
 * The dead space is not in the app, it is in signup: verify is 65% empty on
 * desktop, name 61%, unit 54%. Six near-empty screens in a row read as a
 * long form, and that is where signups are lost.
 *
 * The preview responds to the answer being given, which makes the question
 * feel consequential rather than bureaucratic. It sits BESIDE the original
 * worked example rather than replacing it, on the owner's instruction: the
 * two-line profit and loss explanation is what actually teaches what a unit
 * IS, and a month of sample bets is what shows why it matters. One without
 * the other is half the answer.
 * ═══════════════════════════════════════════════════════════════════════ */
function unitPreview(u){
 const rows=[['Arsenal v Spurs',1.90,1],['Inter v Milan',3.19,0],
   ['Monaco v Roma',2.51,1],['York 16:10',2.35,1]];
 const total=rows.reduce((t,[,p,w])=>t+(w?u*p-u:-u),0);
 return `<div class="unitprev">
  <div class="hd" style="margin-bottom:8px"><b style="font-size:13px">With a ${sym()}${u} unit</b>
   <span class="lbl">Sample month</span></div>
  ${rows.map(([n,p,w])=>{const ret=w?u*p-u:-u;
   return `<div class="uprow"><span class="uo ${w?'w':'l'}">${w?'✓':'✕'}</span>
    <span class="un">${esc(n)}</span>
    <span class="us">${sym()}${u.toFixed(2)}</span>
    <b class="uv ${w?'pos2':'neg2'}">${ret>0?'+':'−'}${sym()}${Math.abs(ret).toFixed(2)}</b></div>`}).join('')}
  <div class="upfoot"><span>Net from these four</span>
   <b class="${total>0?'pos2':'neg2'}">${total>0?'+':'−'}${sym()}${Math.abs(total).toFixed(2)}</b></div>
 </div>`}

/* ═══ 18 · TELLING GROUPS AND PEOPLE APART ═════════════════════════════════
 *
 * Colour alone will not do it, because the two tabs had an identical
 * information hierarchy and the eye reads structure before hue. They also
 * answer different questions: a group asks HOW IS OUR TABLE DOING, a person
 * asks ARE THEY ANY GOOD. So they get different shapes, different accents
 * and a different primary figure.
 *
 * Groups: squircle, a left rail in the group's own colour, a stack of member
 * faces, net units as the headline. Chunky rows, because a group is a
 * container you go into.
 *
 * People: circle, a rank, and ROI promoted with units and sample size
 * beneath. Tighter rows, because this is a leaderboard you scan.
 *
 * ROI RATHER THAN UNITS AS THE RANK. Units reward whoever stakes biggest;
 * ROI with the bet count shown is harder to game and matches the product's
 * own line — ranked in units, not in pounds.
 * ═══════════════════════════════════════════════════════════════════════ */
const AV_BASE=['#B0CFFF','#B6A7EA','#EFBBF3','#E399B7','#FFB7B1','#E2A278',
 '#EDCB86','#B2BA72','#AAE0A8','#6CC7AE','#7EE2EC','#72BDE6'];
const AV_DEEP=['#84A8F2','#9381CE','#CD90D2','#C57094','#E98B86','#C57A47',
 '#CBA34C','#8E973C','#7BBC7A','#25A68A','#31BECA','#379ACA'];
function initialsOf(n,max){const w=String(n).trim().split(/[\s._-]+/).filter(Boolean);
 const t=w.length===1?1:Math.min(max||2,w.length);
 return w.slice(0,t).map(x=>Array.from(x)[0]).join('').toUpperCase()}
function avatarHTML(name,kind,size,letters){
 const i=bookHash(name)%AV_BASE.length,two=letters?letters===2:size>=26;
 return `<span class="av ${kind==='group'?'g':'u'}" aria-hidden="true"
  style="width:${size}px;height:${size}px;font-size:${Math.round(size*(two?0.38:0.46))}px;
   background:linear-gradient(128deg,${AV_BASE[i]} 0 48%,${AV_DEEP[i]} 48% 100%)"
  >${initialsOf(name,two?2:1)}</span>`}

const GROUPLIST=[['Ultras','4 of 12 members','+63.4u',1,0,['Emeka Mbeki','Aoife Kelly','Marcus Osei','Priya Raman']],
 ['Sunday League','2 of 7 members','−4.1u',0,1,['Tom Whitfield','Zainab Ali']]];
const PEOPLELIST=[['BlueSlip','+9.4%','+18.2u',112],['KerryEdge','+4.1%','+11.7u',203],
 ['FiveFolds','+2.2%','+8.4u',87]];

function GROUPROWS(){return GROUPLIST.map(g=>{
 const i=bookHash(g[0])%AV_BASE.length;
 const sel=(cur.groupSel||GROUPLIST[0][0])===g[0];
 return `<button class="grow2${sel?' on':''}" data-groupsel="${esc(g[0])}" aria-current="${sel}">
  <i class="grail" style="background:${AV_BASE[i]}"></i>
  ${avatarHTML(g[0],'group',40)}
  <span class="gmeta"><span class="gname">${esc(g[0])}${g[4]?' <em class="pill">Admin</em>':''}</span>
   <span class="gsub">${esc(g[1])}</span></span>
  <span class="gstack">${g[5].map(p=>avatarHTML(p,'user',24,1)).join('')}</span>
  <b class="gval ${g[3]?'pos2':'neg2'}">${esc(g[2])}</b></button>`}).join('')}

function PEOPLEROWS(){return PEOPLELIST.map((p,i)=>`
 <button class="prow" data-personsel="${esc(p[0])}">
  <span class="prank">${i+1}</span>
  ${avatarHTML(p[0],'user',32)}
  <span class="pmeta"><span class="pname">${esc(p[0])}</span>
   <span class="psub">${esc(p[2])} · ${p[3]} bets</span></span>
  <span class="pval"><b>${esc(p[1])}</b><span>ROI</span></span></button>`).join('')}

/* ═══ 16 · EMPTY STATES SHOW THE THING, LABELLED ═══════════════════════════
 *
 * Three screens said a version of "there is nothing here". This is the
 * screen a new signup reaches straight after a landing page that promised a
 * calendar full of green and red, and a blank box is the moment that promise
 * breaks.
 *
 * The worked example is rendered behind a scrim with the real call to action
 * on top, and it is LABELLED AS AN EXAMPLE so nobody mistakes it for their
 * own record. It costs nothing: this is the same demo data /demo already
 * renders.
 * ═══════════════════════════════════════════════════════════════════════ */
function ghostCard(inner,title,body,cta){
 return `<div class="card ghostwrap">
  <div class="ghostbody" aria-hidden="true">${inner}</div>
  <div class="ghostcta"><div class="gin">
   <b>${esc(title)}</b><p>${esc(body)}</p>${cta}
   <span class="gtag">Everything behind this is an example month</span>
  </div></div></div>`}

V.fresh={nav:'dash',tab:'OVERVIEW',html:()=>{
 const done=CHECK.filter(c=>c[2]).length;
 return `<div class="pane">
 <div class="card" style="border-color:var(--p)"><div class="hd"><b>Get set up</b><span class="pill">${done} of ${CHECK.length}</span></div>
  <div class="track" style="margin-bottom:11px"><div class="fill" data-w="${Math.round(done/CHECK.length*100)}"></div></div>
  ${CHECK.map(c=>`<button class="ck ${c[2]?'done':''}" ${c[2]?'':`data-${c[1]==='import'||c[1]==='social'?'go':'sheet'}="${c[1]}"`}>
   <span class="box">${c[2]?'✓':''}</span><span class="t">${c[0]}</span>${c[2]?'':'<span class="caret" style="transform:rotate(-90deg)">▾</span>'}</button>`).join('')}
  <p class="note">This card disappears once all four are done.</p></div>
 ${ghostCard(
   `<div class="lbl">Net this month</div><div class="big">+£1,184.00</div>
    <div class="row" style="font-size:12px">Bets 96 &nbsp; Units +47.36u</div>
    <div class="cal chartfill" data-cal="month" style="margin-top:14px"></div>`,
   'This fills in as you go',
   'Forward one slip and the calendar starts colouring in.',
   `<button class="btn" data-go="import">Forward your first slip</button>
    <div style="margin-top:9px"><button class="btn txt" data-go="manual">or add one by hand</button></div>`)}
 ${ghostCard(
   `<div class="hd"><b>Recent bets</b></div>${bets.slice(0,4).map(betRow).join('')}`,
   'Your ledger starts with one slip',
   'Screenshot it, forward it to the bot, or type it in. Any of the three.',
   `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
     <button class="btn sm" data-go="import">Add a bet</button>
     <button class="btn ghost sm" data-sheet="bot">Set up the bot</button></div>`)}</div>`}};
V.freshledger={narrow:1,nav:'dash',tab:'LEDGER',html:()=>`<div class="pane">
 ${ghostCard(bets.slice(0,6).map(betRow).join(''),
   'Your ledger starts with one slip',
   'Once there are a few, filter them by outcome, sport, bookmaker, tipster or odds band.',
   '<button class="btn" data-go="import">Add your first</button>')}</div>`};
V.freshsocial={narrow:1,nav:'soc',html:()=>`<div class="pane">
 ${ghostCard(GROUPROWS(),
   'A table needs somebody in it',
   'A group ranks everyone by units, so stake size stays private. Start one or find one.',
   `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
     <button class="btn sm" data-sheet="creategroup">Create a group</button>
     <button class="btn ghost sm" data-go="discover">Discover</button></div>`)}
 <div class="card"><div class="empty" style="padding:16px"><b style="font-size:13.5px">Nobody following you</b>
  <p style="margin:0">Share your handle and your figures show in units.</p></div></div></div>`};
V.offline={nav:'dash',tab:'OVERVIEW',run:1,html:()=>`<div class="pane">
 <!-- 20 · one banner. Two saying the same thing cost 78px of the viewport. -->
 <div class="offbar"><span class="oi">⚠</span>
  <div><b>Offline, 2 bets queued</b>
   <span>Figures are 14 minutes old. Nothing is lost, they send when you are back.</span></div>
  <button class="chip" data-toast="Retrying…">Retry</button></div>
 <div style="opacity:.55;pointer-events:none">${netCard()}</div></div>`};
V.saveerr={narrow:1,nav:'imp',html:()=>`<div class="pane">
 <div class="banner err"><span>⚠</span><div><b>That did not save</b>The server rejected the bet because the odds and returns do not agree. Nothing has been lost.</div></div>
 <div class="card"><div class="hd"><b>Juventus v Cremonese</b><span class="pill r">Not saved</span></div>
  <div class="setrow"><div class="k" style="font-size:13.5px">Odds</div><b class="mono">1.80</b></div>
  <div class="setrow"><div><div class="k" style="font-size:13.5px">Returns</div><div class="dd" style="color:var(--neg)">£100 at 1.80 returns £180.00, not £160.00</div></div><b class="mono" style="color:var(--neg)">£160.00</b></div>
  <div style="display:flex;gap:9px;margin-top:12px"><button class="btn full sm" data-toast="Corrected to £180.00">Use £180.00</button>
   <button class="btn ghost full sm" data-sheet="editbet">Edit by hand</button></div></div>
 <button class="btn ghost full sm" data-toast="Kept as a draft">Keep as a draft and fix later</button></div>`};
V.readererr={narrow:1,nav:'imp',html:()=>`<div class="pane">
 <div class="banner warn"><span>⚠</span><div><b>Could not read that one</b>The reader is available but this image was too low resolution to be sure of the odds.</div></div>
 <div class="card"><div class="hd"><b>What it did get</b><span class="pill a">2 of 4</span></div>
  ${[['Bookmaker','bet365','g'],['Stake','£100.00','g'],['Odds','Not found','r'],['Selections','Partial, 3 of 4','a']].map(x=>`
   <div class="setrow"><div class="k" style="font-size:13.5px">${x[0]}</div><span class="pill ${x[2]}">${x[1]}</span></div>`).join('')}
  <div style="display:flex;gap:9px;margin-top:12px"><button class="btn full sm" data-go="manual">Fill in the rest</button>
   <button class="btn ghost full sm" data-go="import">Try another image</button></div></div>
 <p class="note" style="text-align:center">Tip: crop to the slip and avoid a screenshot of a screenshot.</p></div>`};
V.ledger={nav:'dash',tab:'LEDGER',run:1,html:()=>{
 const c={w:0,l:0};bets.forEach(b=>c[b[0]]++);
 const staked=bets.reduce((t,b)=>t+b[5],0),ret=bets.reduce((t,b)=>t+b[6],0),net=ret-staked;
 const facets=[['All',bets.length,'',1],['Won',c.w,'w',0],['Lost',c.l,'l',0]];
 return `<div class="pane">
 <div class="hd"><span class="lbl">${PERIODS[cur.per].lab}</span><button class="pill" data-sheet="period">${PERLIST.find(x=>x[0]===cur.per)[1]} ▾</button></div>
 <div class="card" data-cardid="lsum"><div class="lsumgrid">
  ${[['Staked',amount(staked),0],['Returned',amount(ret),0],['Net',money(net),1],['ROI',roiOf({net,to:staked,void:0}),1]].map(x=>`
   <div class="stat"><div class="k">${x[0]}</div><div class="v"${x[2]?` style="color:var(--${net>0?'pos':'neg'})"`:''}>${x[1]}</div></div>`).join('')}</div></div>
 <div class="card" data-cardid="lrows">
  <div class="ltools">
   <input class="field lsearch" type="search" placeholder="Search event, selection or bookmaker" aria-label="Search event, selection or bookmaker" autocomplete="off">
   <button class="chip" data-sheet="filters">Filter and sort</button>
   ${cur.bulk?`<button class="chip" data-bulk>Done</button>`:''}</div>
  ${cur.bulk?`<div class="bulkbar"><b style="font-size:13px">3 selected</b>
   <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="chip" data-sheet="tipsterpick">Tipster</button>
    <button class="chip" data-sheet="tags">Tag</button><button class="chip" data-sheet="sports">Sport</button>
    <button class="chip" data-toast="3 bets deleted">Delete</button></div></div>`:''}
  <div class="chips">${facets.map(f=>`<button class="chip ${f[2]}" aria-current="${!!f[3]}" data-pickone>${f[0]} ${f[1]}</button>`).join('')}</div>
  ${bets.slice(0,cur.ledgerShown||LEDGER_PAGE).map(betRow).join('')}
  ${bets.length>(cur.ledgerShown||LEDGER_PAGE)
   ? `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:13px">
      <button class="btn ghost sm" data-loadmore>Load more</button>
      <span class="lbl">Showing ${Math.min(cur.ledgerShown||LEDGER_PAGE,bets.length)} of ${bets.length}</span></div>`
   : `<div style="display:flex;justify-content:center;padding-top:13px">
      <span class="lbl">All ${bets.length} shown</span></div>`}</div>
 <button class="btn ghost full" data-go="history" style="margin-top:2px">View imported history</button></div>`}};
V.history={nav:'dash',tab:'LEDGER',run:1,html:()=>`<div class="pane">
 <div class="hd"><span class="lbl">${PERIODS[cur.per].lab}</span><button class="pill" data-sheet="period">${PERLIST.find(x=>x[0]===cur.per)[1]} ▾</button></div>
 <div style="display:flex;gap:9px;align-items:center;margin-bottom:11px">
  ${segHTML(['Bets','History'],'History',x=>`data-go="${x==='Bets'?'ledger':'history'}"`)}</div>
 <div class="card"><div class="hd" style="margin-bottom:6px"><b style="font-size:15px">Net for the period</b><b class="mono" style="font-size:19px;color:var(--pos)">+£1,694.50</b></div>
  <div class="setrow" style="border-top:1px solid var(--line)"><div><div class="k">Logged in Slippery</div><div class="dd">96 bets with a slip behind them</div></div><b class="mono" style="color:var(--pos)">+£1,284.50</b></div>
  <details class="disc"><summary><div><div class="k">Imported from history</div><div class="dd">3 entries, figures only</div></div>
   <div style="display:flex;align-items:center;gap:9px"><b class="mono" style="color:var(--pos)">+£410.00</b><span class="caret">▾</span></div></summary>
   ${[['4 Aug','+£180.00'],['11 Aug','−£45.00'],['16 Aug','+£275.00']].map(x=>`<div class="setrow" style="padding:10px 0 10px 14px"><div class="k" style="font-size:13px;color:var(--t2)">${x[0]}</div><b class="mono" style="font-size:13px">${x[1]}</b></div>`).join('')}
   <button class="btn ghost full sm" style="margin:8px 0 4px" data-go="imphist">Edit imported figures</button></details>
  <p class="note">Imported figures count toward the total and turnover. They never touch win rate, streaks, or best and worst day.</p></div></div>`};
const posc=n=>n===1?'pos1':n===2?'pos2':n===3?'pos3':'';
V.discover={narrow:1,nav:'soc',back:'social',title:'Discover groups',html:()=>`<div class="pane">
 <input class="field" autocomplete="off" aria-label="Search groups" placeholder="Search by name, or paste a code" style="margin:0 0 10px">
 <div style="margin-bottom:13px">${segHTML(['Popular','Newest','A\u2013Z'],'Popular',null,'full')}</div>
 ${[['Ultras','U',12,'+41.2u','+6.1%','joined'],
    ['HB Value','HB',38,'+22.8u','+3.4%','request'],
    ['Irish Racing','IR',21,'+15.9u','+2.8%','code'],
    ['Weekend Multis','WM',54,'\u22128.7u','\u22122.1%','open'],
    ['Value Vault','VV',16,'+31.0u','+5.2%','request']].map(g=>{
  const J={open:['Join','Anyone can join, straight away',''],
   code:['Enter code','A code lets you in instantly','ghost'],
   request:['Request','An admin approves you','ghost'],
   joined:['','You are a member','']}[g[5]];
  return `<div class="card t"><div class="hd" style="margin:0">
   <div style="display:flex;gap:10px;align-items:center"><span class="gpic" style="width:30px;height:30px;font-size:11px;border-radius:9px">${g[1]}</span>
    <div style="text-align:left"><b style="font-size:14px">${g[0]}</b>
     <div class="dd" style="font-size:11px;color:var(--t3)">${g[2]} members \u00b7 avg ROI ${g[4]}</div></div></div>
   <b class="mono" style="font-size:12.5px;color:var(--${g[3].startsWith('\u2212')?'neg':'pos'})">${g[3]}</b></div>
  <div class="joinrow"><span class="joinwhy">${J[1]}</span>
   ${g[5]==='joined'?'<span class="pill g">\u2713 Joined</span>'
    :`<button class="btn ${J[2]} sm" ${g[5]==='code'?'data-sheet="joincode"':`data-toast="${J[0]==='Join'?'Joined '+g[0]:'Request sent to '+g[0]}"`}>${J[0]}</button>`}</div></div>`}).join('')}
 <p class="note">Group averages only. Individual figures need a membership.</p></div>`};

/* 17 · A PROFILE OF WHOEVER YOU CLICKED.
 *
 * This screen was entirely hardcoded to BlueSlip: two entry points led here
 * and both showed the same person whichever row you pressed, with a literal
 * `<span class="av">BS</span>` instead of the avatar helper and no form.
 * `cur.personsel` follows the `data-groupsel` pattern already used by the
 * group list.
 *
 * ROI IS THE HEADLINE, units and bet count beneath. Ranking on units rewards
 * whoever stakes biggest; ROI with the count beside it is harder to game and
 * matches the product's own line about ranking in units, not pounds.
 *
 * MONEY NEVER LEAVES. Units only, outside a shared group — which is what the
 * follows API already enforces server-side by refusing to return unitPence. */
/* ═══ 17 · THE FEED ═══════════════════════════════════════════════════════
 *
 * A SETTLED BET AUTHORS ITSELF. Subject, stake, outcome, number — zero
 * writing required, which is the only reason a feed in a product this size
 * stays full. Nobody is going to compose a post about a 1.90 shot.
 *
 * DEFAULT PUBLIC TO YOUR GROUPS, PRIVATE GLOBALLY, with a per-bet override.
 * Units shown, money hidden: the same rule the follows API already enforces
 * server-side by refusing to return a stake outside a shared group.
 *
 * WHAT IS DELIBERATELY NOT HERE. There is no tail control. Tailing exists to
 * make somebody place a bet they otherwise would not, and CLAUDE.md locks the
 * line that nothing may nudge toward more volume — so it is declared in
 * actions.js as not built, with the reason, rather than shipped quietly.
 * ═══════════════════════════════════════════════════════════════════════ */
const FEED=[
 ['KerryEdge','won','Arsenal v Spurs','+1.90u','pos','2h',['🔥 3']],
 ['BlueSlip','lost','Inter v Milan','−1.00u','neg','4h',['😬 2']],
 ['NapKing','moved up to','Championship','','acc','6h',['👏 6']],
 ['You','logged','your 100th bet','','acc','1d',[]],
 ['FiveFolds','won','Köln v Augsburg','+0.88u','pos','1d',['🔥 1']],
 ['KerryEdge','placed','York 16:10, each way','','acc','2d',[]]];

function feedRow(f){
 const [who,verb,what,val,tone,when,reactions]=f;
 const me=who==='You';
 return `<div class="feedrow">
  <button class="feedwho" ${me?'':`data-personsel="${esc(who)}"`}>${avatarHTML(who,'user',26)}</button>
  <div class="feedbody">
   <div class="feedline"><b>${esc(who)}</b> <span>${esc(verb)}</span> ${esc(what)}
    ${val?`<b class="mono ${tone==='pos'?'pos2':'neg2'}">${esc(val)}</b>`:''}</div>
   <div class="feedmeta">${esc(when)} ago${reactions.length?' · '+reactions.map(esc).join(' '):''}</div>
  </div>
  <div class="feedacts">${['🔥','👏','😬'].map(r=>
    `<button class="react" data-react aria-label="React ${r}">${r}</button>`).join('')}</div>
 </div>`}

V.feed={nav:'soc',back:'social',title:'Feed',html:()=>`<div class="pane">
 <div class="hd"><span class="lbl">Your groups</span>
  <button class="chip" data-sheet="privacy">Who sees this</button></div>
 <div class="card" data-cardid="feed">${FEED.map(feedRow).join('')}</div>
 <p class="note">Bets you settle appear here automatically. Public to your groups and
  private everywhere else unless you say otherwise — units only, never stakes.</p></div>`};

const PERSONOF=n=>PEOPLELIST.find(p=>p[0]===n)||PEOPLELIST[0];
V.person={narrow:1,nav:'soc',back:'social',
 title:()=>cur.personsel||PEOPLELIST[0][0],
 html:()=>{
  const p=PERSONOF(cur.personsel);
  const [name,roi,units,bets]=p;
  const following=(cur.following||[]).includes(name);
  const form=(LEAGUE_TABLE.find(r=>r[0]===name)||[,,,,,, 'WWLVW'])[6];
  return `<div class="pane">
 <div class="card" style="text-align:center">
  <div style="display:flex;justify-content:center;margin-bottom:10px">${avatarHTML(name,'user',58)}</div>
  <b style="font-size:17px;display:block">${esc(name)}</b>
  <div class="dd" style="color:var(--t3)">@${esc(name.toLowerCase())}</div>
  <div style="margin:10px 0 0">${formDots(form)}</div>
  <div class="g3" style="margin-top:13px">
   <div class="stat"><div class="k">ROI</div><div class="v mono" style="color:var(--${roi.startsWith('−')?'neg':'pos'})">${esc(roi)}</div></div>
   <div class="stat"><div class="k">Units</div><div class="v mono" style="color:var(--${units.startsWith('−')?'neg':'pos'})">${esc(units)}</div></div>
   <div class="stat"><div class="k">Bets</div><div class="v mono">${bets}</div></div></div>
  <!-- 17 · The Follow button is back, and it is real: /api/follows has done
       GET, POST and DELETE against a follows table since before this screen
       was drawn. It was removed in item 07 because following is meaningless
       without a feed to follow into. There is one now. -->
  <button class="btn ${following?'ghost':''} full" style="margin-top:13px"
   data-follow="${esc(name)}" aria-pressed="${following}">${following?'Following':'Follow'}</button>
  <p class="note" style="margin:9px 0 0">Public profile at
   <span class="mono">slippery.app/r/${esc(name.toLowerCase())}</span> · units only, never money.</p></div>
 <div class="card"><div class="hd"><b>Groups</b><span class="lbl">3</span></div>
  ${[['Ultras',12],['HB Value',38],['Value Vault',16]].map(g=>`
   <div class="bet" style="align-items:center">${avatarHTML(g[0],'group',28)}
    <div class="m"><div class="n">${esc(g[0])}</div><div class="d">${g[1]} Slippers</div></div></div>`).join('')}</div>
 <p class="note">Stake sizes are only visible inside a group you both belong to.</p></div>`}};
V.social={nav:'soc',tab:'GROUPS',html:()=>{
 const people=(cur.socTab||'groups')==='people';
 return `<div class="pane soc${people?' pe':' gr'}">
 <div class="hd"><span class="lbl ${people?'pe':'gr'}">${people?'Slippers you follow':'Your groups'}</span>
  <button class="chip" data-sheet="${people?'tipsters':'creategroup'}">${people?'Find Slippers':'+ New group'}</button></div>
 ${people
  ? `<div style="max-width:300px;margin-bottom:12px">${segHTML(['Connected','Following'],cur.peopleTab||'Connected')}</div>
     ${PEOPLEROWS()}`
  : `<div class="soclist">${GROUPROWS()}
      <div style="display:flex;gap:9px;margin-top:4px">
       <button class="btn ghost full sm" data-sheet="challenge">Challenges<span class="nbadge a" style="margin-left:7px">3</span></button>
       <button class="btn ghost full sm" data-go="feed">Feed</button>
       <button class="btn ghost full sm" data-go="discover">Discover</button></div></div>
     <div class="socdetail">${groupDetailCard(cur.groupSel||GROUPLIST[0][0])}</div>`}</div>`}};
/* 22 · SOCIAL WAS 57% EMPTY ON A DESKTOP.
 *
 * Two group rows and two buttons, then 500px of nothing, because the page
 * was designed as a phone list and then given a 1154px column. A list is a
 * list; what fills the rest is the thing the list selects. So the member
 * table moves out of the detail *route* and into a function, and the same
 * markup renders in both places: beside the list above 1000px, and on its
 * own page below it, where there is no room for two columns.
 *
 * The route stays real. Deep links, back and share all still work, which is
 * the whole reason these are routes and not tabs. */
const GROUPMEMBERS={
 'Ultras':[[1,'BlueSlip','+18.2u','1u = £100','100%',0],[2,'KerryEdge','+11.7u','1u = £50','96%',1],
  [3,'FiveFolds','+8.4u','1u = £25','100%',0],[4,'You','+6.3u','1u = £25','94%',0],
  [5,'NapKing','+2.1u','1u = £10','88%',2]],
 'Sunday League':[[1,'You','+3.2u','1u = £25','94%',0],[2,'Tom Whitfield','−1.8u','1u = £20','91%',0],
  [3,'Zainab Ali','−5.5u','1u = £15','100%',1]]};

/* ═══ 16 · MONTHLY LEAGUES ════════════════════════════════════════════════
 *
 * Points from the head to head, units as goal difference. A UK bettor reads a
 * football table with no explanation, which is exactly why this is a table
 * and not an XP bar: the format is already known and the only new idea is
 * that a unit is the goal difference.
 *
 * The table BECOMES the group page, which was sitting 42% empty.
 *
 * Three rules carry it, and all three are visible rather than implied:
 *   the ±3u cap        or one 10u punt at 12/1 is the optimal strategy
 *   resting            under five bets: greyed, held, never relegated
 *   slip-backed only   in global divisions
 * ═══════════════════════════════════════════════════════════════════════ */
const LEAGUE_UNIT_CAP=3;
const LEAGUE_REST_MIN=5;
const LEAGUE_DIVISIONS=['Premier','Championship','League One','League Two','Conference'];

/* name, W, D, L, units, points, form, settled bets */
const LEAGUE_TABLE=[
 ['KerryEdge',3,1,0,8.4,10,'WWLWW',22],
 ['BlueSlip',3,0,1,6.9,9,'WLWWW',31],
 ['NapKing',2,1,1,4.2,7,'WWLVW',14],
 ['You',2,0,2,3.1,6,'LWWLW',19],
 ['FiveFolds',1,1,2,-0.8,4,'LLWVL',11],
 ['ValueVault',0,1,3,-5.1,1,'LLLWL',3]];

const capUnits=u=>Math.max(-LEAGUE_UNIT_CAP,Math.min(LEAGUE_UNIT_CAP,u));
const uFmt=u=>(u>0?'+':u<0?'−':'')+Math.abs(u).toFixed(1)+'u';

/* Five marks, and a void is grey. A non-runner is not a loss, so it must not
   look like one and must not break a run. */
function formDots(str){
 return `<span class="form" aria-label="Form, most recent last: ${
  [...str].map(c=>c==='W'?'won':c==='L'?'lost':'void').join(', ')}">${
  [...str].map(c=>`<i class="f${c.toLowerCase()}"></i>`).join('')}</span>`}

function leagueTable(){
 const size=LEAGUE_TABLE.length;
 return `<div class="card" data-cardid="league">
  <div class="hd"><b>League One</b>
   <span class="hdctl"><span class="lbl">Week 3 of 4</span></span></div>
  <table class="ltab">
   <caption class="sronly">League One table, week 3 of 4. Three points for a
    head to head win, one for a draw. Units are the goal difference.</caption>
   <thead><tr><th scope="col" class="lpos"><span class="sronly">Position</span></th>
    <th scope="col">Slipper</th><th scope="col" class="n">W</th><th scope="col" class="n">D</th>
    <th scope="col" class="n">L</th><th scope="col" class="n">Units</th>
    <th scope="col" class="n">Pts</th><th scope="col" class="fm">Form</th></tr></thead>
   <tbody>${LEAGUE_TABLE.map((r,i)=>{
    const pos=i+1, you=r[0]==='You', resting=r[7]<LEAGUE_REST_MIN;
    /* Resting is protected both ways, so it takes neither edge. */
    const zone=resting?'':pos<=3?'zup':pos>size-3?'zdn':'';
    return `<tr class="${zone}${you?' you':''}${resting?' resting':''}"${you?' aria-current="true"':''}>
     <td class="lpos">${pos}</td>
     <td class="lname">${avatarHTML(r[0],'user',20,1)}<b>${esc(r[0])}</b>${
       resting?`<span class="restpill" title="${esc(LEAGUE_REST_COPY)}">Resting</span>`:''}</td>
     <td class="n">${r[1]}</td><td class="n">${r[2]}</td><td class="n">${r[3]}</td>
     <td class="n ${r[4]>0?'pos2':r[4]<0?'neg2':''}">${uFmt(r[4])}</td>
     <td class="n pts">${r[5]}</td>
     <td class="fm">${formDots(r[6])}</td></tr>`}).join('')}</tbody></table>
  <div class="lkey">
   <span><i class="kup"></i>Top 3 promoted</span>
   <span><i class="kdn"></i>Bottom 3 relegated</span>
   <span>Units are capped at ±${LEAGUE_UNIT_CAP}u per bet</span></div></div>`}

const LEAGUE_REST_COPY='Resting this month. Your place is held.';

/* THE WEEK'S HEAD TO HEAD. Swiss, so by the last week the top of the table is
   playing itself — which is the reason to use it rather than a round robin. */
function fixtureCard(){
 return `<div class="card" data-cardid="fixture">
  <div class="hd"><b>Your week</b><span class="lbl">Ends Sunday</span></div>
  <div class="h2h">
   <div class="h2hside"><b>You</b><span class="mono pos2">+3.1u</span>
    <span class="lbl">19 bets</span></div>
   <div class="h2hvs">VS</div>
   <div class="h2hside"><b>KerryEdge</b><span class="mono">+1.8u</span>
    <span class="lbl">22 bets</span></div></div>
  <div class="capline"><span>Your best bet this week</span>
   <b class="mono">+8.4u · counts as +3.0u</b></div>
  <p class="note">Three points for the win, one for a draw. A draw is anything
   inside a tenth of a unit.</p></div>`}

/* Premier at the top, and nobody starts there: month one is a placement
   season and imported history does not count toward it, or a CSV would be a
   promotion. */
function ladderCard(){
 const mine='League One';
 return `<div class="card" data-cardid="ladder">
  <div class="hd"><b>Divisions</b></div>
  <ol class="ladder">${LEAGUE_DIVISIONS.map(d=>`<li class="${d===mine?'on':''}">
   <span>${d}</span>${d===mine?'<span class="lbl">You, 4th of 24</span>':''}</li>`).join('')}</ol>
  <p class="note">A division is a skill tier; a table is the 24 Slippers inside
   it. Under 12 active and a tier merges upward, and we say so. Global
   divisions count slip-backed bets only.</p></div>`}

function groupDetailCard(name){
 const g=GROUPLIST.find(x=>x[0]===name)||GROUPLIST[0];
 const rows=GROUPMEMBERS[g[0]]||[];
 return `<div class="card"><div class="hd"><div style="display:flex;gap:11px;align-items:center">${avatarHTML(g[0],'group',34)}
   <div><b>${esc(g[0])}</b><div class="dd"><span class="pos2">${esc(g[1].split(' ')[0])}</span> of ${esc(g[1].replace(/^\S+ of /,''))}</div></div></div>
  <div style="display:flex;gap:7px"><button class="chip" data-sheet="challenge">Challenge</button>
   <button class="chip" data-sheet="groupadmin">Manage</button></div></div>
  ${rows.map(m=>`
   <button class="bet" style="align-items:center" data-go="person"><span class="mono ${posc(m[0])}" style="width:18px;text-align:center;flex:0 0 auto">${m[0]}</span>
   <div class="m"><div class="n">${esc(m[1])}</div><div class="d">${m[3]} · ${m[4]} slip-backed${m[5]?` · <span style="color:var(--a)">${m[5]} edited late</span>`:''}</div></div>
   <div class="v" style="color:${String(m[2]).startsWith('−')?'var(--neg)':'var(--pos)'}">${m[2]}</div></button>`).join('')}
  <p class="note">Every figure here has a bookmaker slip behind it. Group members see each other's unit size; outside a group only units are shown.</p></div>`}

/* 16 · THE TABLE IS THE GROUP PAGE. It was 42% empty with a member list on
   it; the league is the thing a group is for, so it leads and the members
   follow. */
V.groupdetail={nav:'soc',back:'social',
 title:()=>cur.groupSel||'Ultras',
 html:()=>`<div class="pane">
  ${leagueTable()}
  ${fixtureCard()}
  ${ladderCard()}
  ${groupDetailCard(cur.groupSel||'Ultras')}</div>`};

/* ═══ IMPORT ═══ */
/* ═══ 14 · THE SLIP GALLERY ════════════════════════════════════════════════
 *
 * Uniform cards in a horizontal scroller: swipe on a phone, drag or arrow
 * keys on a laptop. Each carries an 8% wash of its bookmaker colour with a
 * 2px top edge in the full colour, so the tint identifies without shouting
 * and the row still reads as one thing.
 *
 * A card needing a fix breaks the uniformity on purpose. That is what makes
 * it findable in a row of identical tiles, and it gives the seven items
 * behind "Fix problem bets" somewhere to live.
 *
 * THE ROW NEEDS A HORIZON. Settings promises slip images are deleted after
 * ninety days, so without a final tile saying so the gallery just looks
 * broken as it ages.
 * ═══════════════════════════════════════════════════════════════════════ */
const SLIP_TILES=[['bet365','2d',0],['Sky Bet','5d',0],['Coral','11d',1],['Betfred','23d',0],
 ['bet365','41d',0],['Ladbrokes','58d',0],['Sky Bet','77d',0],['','94d',2]];

function slipGallery(){
 return `<div class="scroller" role="list" aria-label="Recent slips">
  ${SLIP_TILES.map(([b,age,flag])=>{
   if(flag===2)return `<div class="sliptile gone" role="listitem">
    <p>Image removed after 90 days. The bet is kept.</p></div>`;
   const c=bookColour(b);
   return `<button class="sliptile${flag===1?' fix':''}" role="listitem" data-sheet="slipimg">
    <i class="stop" style="background:${c}"></i>
    <span class="simg" style="background:color-mix(in srgb,${c} 8%,transparent)">
     <span class="sfake"><i></i><i></i><i></i><i></i></span>
     ${flag===1?'<em class="sbadge">Fix</em>':''}</span>
    <span class="scap"><b>${esc(b)}</b><span>${esc(age)} ago</span></span></button>`}).join('')}
 </div>`}

/* ═══ 13 · ADD A BET ═══════════════════════════════════════════════════════
 *
 * ORDERING. Dropzone, then Telegram, then a dashed OR, then type it in, then
 * a hard division with import history under it. The OR sits between the two
 * automated routes and the manual one, because dropping a file and
 * forwarding to the bot are both "give it a picture" and typing is not.
 *
 * TWO TELEGRAM STATES, and the colour carries the difference. Not linked is
 * amber, because it is the one thing on the screen asking for an action.
 * Linked is the primary blue, because a working integration is a normal
 * condition rather than a success to celebrate every time you visit.
 * Nothing here is green: green means money.
 *
 * The dropzone icon was rendering as a small black triangle — a `use` that
 * resolved to nothing. It is a literal path now, so it cannot depend on
 * whether the sprite has painted yet.
 * ═══════════════════════════════════════════════════════════════════════ */
const UPICON=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
 <path d="M12 16V5M7 10l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;

function tgCard(linked){
 return `<div class="tgcard ${linked?'on':'off'}">
  <span class="tgi">${TG}</span>
  <span class="tgtxt"><b>Forward slips through Telegram</b>
   <span>${linked?'Linked. Last slip 12 minutes ago.':'Not linked'}</span></span>
  ${linked?'<button class="btn ghost sm" data-sheet="botlinked">Open the bot</button>'
          :'<button class="btn sm tgset" data-sheet="bot">Set up</button>'}</div>`}

V.import={narrow:1,nav:'imp',html:()=>`<div class="pane">
 <h2 style="font-size:22px;margin:0 0 12px">Add a bet</h2>
 <button class="drop" data-pick>
  <span class="dropi">${UPICON}</span>
  <b>Screenshot, PDF or CSV</b>
  <span class="dropsub">Drop here or tap to choose</span></button>
 <input type="file" data-slipinput hidden multiple aria-label="Choose slip images or a CSV" accept="image/*,application/pdf,.csv,.heic,.heif">
 ${tgCard(false)}
 <div class="ordiv">OR</div>
 <button class="btn ghost full" data-go="manual">Type it in</button>
 <div class="bigdiv"></div>
 <div class="hd" style="margin-bottom:10px"><b style="font-size:14px">Import history</b>
  <button class="btn txt" data-go="imphist">Bring history from elsewhere</button></div>
 ${slipGallery()}</div>`};
V.importlinked={narrow:1,nav:'imp',html:()=>V.import.html()
 .replace(tgCard(false),tgCard(true))};
V.crop={narrow:1,nav:'imp',html:()=>`<div class="pane">
 <div class="hd"><h2 style="font-size:20px;margin:0">Crop to the slip</h2><button class="chip" data-go="reading">Skip</button></div>
 <p class="note" style="margin:0 0 12px">Trim the navigation bars and ads. It reads better and uses one slip either way.</p>
 <div style="position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line);background:var(--elev);padding:26px 14px">
  <div style="position:absolute;inset:0;background:color-mix(in srgb,var(--t1) 8%,transparent)"></div>
  <div class="slip" style="position:relative;border-style:solid;margin:0;box-shadow:0 0 0 2px var(--s),0 0 0 9999px color-mix(in srgb,var(--bg) 74%,#000)">
   ${[0,1,2].map(i=>`<span style="position:absolute;width:12px;height:12px;border:2px solid var(--s);${i===0?'top:-2px;left:-2px;border-right:0;border-bottom:0':i===1?'top:-2px;right:-2px;border-left:0;border-bottom:0':'bottom:-2px;left:-2px;border-right:0;border-top:0'}"></span>`).join('')}
   <div class="hd" style="margin-bottom:6px"><b style="font-size:12px">bet365</b><span class="tag" style="font-size:8px">SLIP</span></div>
   ${['Under 4 Cards','Under 4.5 Shots on Target','Juventus to win'].map(l=>`<div class="leg" style="padding:6px 0"><div class="dotl" style="width:11px;height:11px"></div><div><div class="nm" style="font-size:11px">${l}</div></div></div>`).join('')}
   <div class="slipfoot" style="font-size:11px"><div>Stake<b class="mono" style="font-size:13px">£100.00</b></div>
    <div style="text-align:right">Returns<b class="mono" style="font-size:13px">£180.00</b></div></div></div></div>
 <div style="display:flex;gap:8px;margin-top:12px">${['Auto','Rotate','Reset'].map((x,i)=>`<button class="btn ghost full sm" data-toast="${x}">${x}</button>`).join('')}</div>
 <button class="btn full" style="margin-top:10px" data-go="reading">Read this</button>
 <div class="setrow" style="margin-top:6px"><div><div class="k">Always ask me to crop</div><div class="dd">Off means it reads the whole image</div></div><button class="tog" data-tog aria-pressed="true"></button></div></div>`};
/* WHAT IS BEING READ, NOT AN INVENTED SLIP.
 *
 * The prototype drew a bet365 slip with four named legs here. Drawing
 * somebody else's bets on a screen that is reading yours is the demo data
 * the house rules forbid, and it is worse than useless: it is four
 * selections you never placed, in a product whose whole claim is an honest
 * record. The plate keeps its scanning animation and names the file. */
V.reading={narrow:1,centre:1,nav:'imp',html:()=>`<div class="pane" style="padding-top:44px;text-align:center">
 <div class="slip scanning" style="max-width:230px;margin:0 auto 20px;padding:11px;border-style:solid" id="rdslip">
  <div class="scanbar"></div>
  <div class="hd" style="margin-bottom:6px"><b style="font-size:11.5px">${esc(cur.readName||'Slip')}</b><span class="tag" style="font-size:8px">SLIP</span></div>
  ${[0,1,2].map(()=>`<div class="leg" style="padding:6px 0"><div class="dotl" style="width:11px;height:11px"></div><div><div class="nm sk" style="font-size:11px">&nbsp;</div></div></div>`).join('')}
  <div class="slipfoot" style="font-size:11px"><div>Stake<b class="mono sk" style="font-size:13px">&nbsp;</b></div>
   <div style="text-align:right">Returns<b class="mono sk" style="font-size:13px">&nbsp;</b></div></div></div>
 <h2 style="font-size:19px;margin:0 0 5px">Analysing slip</h2>
 <p class="note" style="margin:0 0 18px" id="readmsg">Selections</p>
 <div class="dots" id="rddots">${[0,1,2].map(()=>'<i></i>').join('')}</div>
 <p class="note" style="margin-top:22px;font-size:12px">Nothing is saved until you have checked it.</p></div>`};
/* THE BETS THE READER ACTUALLY RETURNED.
 *
 * Three named bets were hard coded here. Every figure on this screen now
 * comes from cur.readBets, which only the extract route fills. Nothing is
 * written until Save all, and a bet the reader was not sure about is marked
 * rather than quietly accepted: a wrong bet saved silently is the same
 * failure as a wrong grade. */
V.review={narrow:1,nav:'imp',html:()=>{
 const bets=cur.readBets||[];
 if(!bets.length)return `<div class="pane" style="padding-top:40px;text-align:center">
  <h2 style="font-size:20px;margin:0 0 16px">No slip has been read yet.</h2>
  <button class="btn full sm" style="max-width:220px;margin:0 auto" data-go="import">Add a bet</button></div>`;
 return `<div class="pane">
 <div class="hd"><h2 style="font-size:20px;margin:0">${bets.length} bet${bets.length===1?'':'s'} found</h2><button class="pill" data-sheet="tipsterpick">${esc(cur.tipster||'Own picks')} ▾</button></div>
 ${bets.map((b,i)=>`
  <button class="card t" style="width:100%" data-sheet="editbet" data-reviewi="${i}"><div class="hd" style="margin:0">
   <div style="text-align:left"><b style="font-size:13.5px">${esc(b.eventName||b.selection||'Unnamed bet')}</b><div class="dd" style="font-size:11px;color:var(--t3)">${esc(reviewLine(b))}</div></div>
   <span class="pill ${b.needsCheck?'a':'g'}">${b.needsCheck?'Fixture?':'✓'}</span></div></button>`).join('')}
 <button class="btn full" style="margin-top:4px" data-saveall>Save all</button>
 <p style="text-align:center;margin-top:10px"><button style="font-size:13px;color:var(--t3)" data-discard>Discard</button></p></div>`}};

/* One line under a bet's name: how many legs, the price, the stake and who
   took it. Anything the reader could not see is left out rather than
   guessed at, so a thin line means a thin slip. */
function reviewLine(b){
 const bits=[];
 const legs=Array.isArray(b.legs)?b.legs.length:0;
 bits.push(legs>1?legs+' legs':'Single');
 if(b.odds)bits.push(String(b.odds));
 if(b.stakePence!=null)bits.push(amount(b.stakePence/100));
 if(b.bookmaker)bits.push(b.bookmaker);
 return bits.join(' · ');
}
/* 07 · MANUAL ENTRY COULD NOT RECORD A MULTIPLE.
 *
 * "+ Add another leg" was a toast that said "Leg added" and added nothing, on
 * the one screen that exists for people who cannot forward a slip — and a
 * multiple is the bet type the landing page opens with. Somebody who cannot
 * forward a slip cannot type one either, so this was the largest hole in the
 * product and it is the first of the dead controls to go.
 *
 * The legs live in `cur.legs`, one row each, with the combined price derived
 * rather than typed: multiplying four decimal prices by hand is exactly the
 * arithmetic a tracker should be doing for you, and it is where people get
 * their own accumulator odds wrong.
 */
const emptyLeg=()=>({sel:'',market:'',odds:''});
function legRows(){
 const legs=cur.legs||(cur.legs=[emptyLeg()]);
 return legs.map((l,i)=>`<div class="legrow" data-legidx="${i}">
  <span class="legn">${legs.length>1?i+1:''}</span>
  <div class="legf">
   <input class="field" data-legsel="${i}" value="${esc(l.sel)}" autocomplete="off"
     spellcheck="false" aria-label="Selection for leg ${i+1}"
     placeholder="${i?'Another selection':'Arsenal to win'}" list="mkList">
   <input class="field mono legodds" data-legodds="${i}" value="${esc(l.odds)}"
     inputmode="decimal" autocomplete="off" aria-label="Price for leg ${i+1}" placeholder="1.90">
  </div>
  ${legs.length>1?`<button type="button" class="iconb legdel" data-legdel="${i}"
    aria-label="Remove leg ${i+1}">\u00d7</button>`:'<span class="legpad"></span>'}
 </div>`).join('')}

/** The accumulated price. Rounded once, at the end, not per leg. */
function combinedOdds(){
 const legs=(cur.legs||[]).map(l=>parseFloat(l.odds)).filter(n=>n>1);
 if(legs.length<2)return null;
 return Math.round(legs.reduce((t,o)=>t*o,1)*100)/100;
}

V.manual={narrow:1,nav:'imp',html:()=>{
 const legs=cur.legs||(cur.legs=[emptyLeg()]);
 const comb=combinedOdds();
 const stake=parseFloat(cur.manualStake||'')||0;
 return `<div class="pane"><h2 style="font-size:20px;margin:0 0 10px">Type it in</h2>
 <label class="flabel" for="evIn">Event</label>
 <div class="acwrap"><input class="field" id="evIn" autocomplete="off" spellcheck="false" aria-label="Event" placeholder="Start typing, for example Ars" data-ac>
  <div class="aclist" id="acList" hidden></div></div>
 <datalist id="mkList"></datalist>

 <div class="flabel" id="legsLbl">${legs.length>1?legs.length+' legs':'Selection'}</div>
 <div class="legs" role="group" aria-labelledby="legsLbl">${legRows()}</div>
 <button type="button" class="btn ghost full sm" style="margin-top:9px" data-legadd>+ Add another leg</button>
 ${comb?`<p class="note combodds">Combined price
   <b class="mono" style="color:var(--t1)">${comb.toFixed(2)}</b>
   ${stake>0?`\u00b7 returns <b class="mono" style="color:var(--pos)">${amount(stake*comb)}</b>`:''}
   <span style="display:block;color:var(--t3)">All ${legs.length} legs must win.</span></p>`:''}

 <div style="display:flex;gap:9px"><div style="flex:1"><label class="flabel" for="mStake">Stake</label>
   <input class="field mono" id="mStake" data-mstake value="${esc(cur.manualStake||'')}" placeholder="£25.00" inputmode="decimal" autocomplete="off"></div>
  <div style="flex:1"><label class="flabel" for="mOdds">${comb?'Price':'Odds'}</label>
   <input class="field mono" id="mOdds" ${comb?`value="${comb.toFixed(2)}" readonly aria-describedby="legsLbl"`:''} placeholder="1.90" inputmode="decimal" autocomplete="off"></div></div>
 <label class="flabel">Bookmaker</label><button type="button" class="field" style="text-align:left;display:flex;justify-content:space-between" data-sheet="bookpick">bet365 <span class="caret">\u25be</span></button>
 <label class="flabel">Tipster</label><button type="button" class="field" style="text-align:left;display:flex;justify-content:space-between" data-sheet="tipsterpick">Own picks <span class="caret">\u25be</span></button>
 <label class="flabel">Placed on</label><button type="button" class="field" style="text-align:left;display:flex;justify-content:space-between" data-toast="Date picker">Today, 19 Aug 2026 <span class="caret">\u25be</span></button>
 <details class="disc"><summary style="margin-top:8px"><span style="font-size:13.5px;color:var(--s)">More options</span><span class="caret">\u25be</span></summary>
  <div class="setrow"><div><div class="k">Each way</div><div class="dd">Splits into a win part and a place part, settled separately</div></div><button type="button" class="tog" data-tog aria-pressed="false"></button></div>
  <div class="setrow"><div><div class="k">Free bet or bonus</div><div class="dd">Stake is not returned on a win</div></div><button type="button" class="tog" data-tog aria-pressed="false"></button></div></details>
 <button class="btn full" style="margin-top:14px" data-go="overview">Save</button></div>`}};

/* ═══ 15 · BRINGING HISTORY IN ═════════════════════════════════════════════
 *
 * SOURCE FIRST, NOT FILE FIRST. The opening question is where it came from,
 * because knowing the source means knowing the columns — and the landing
 * page promises "no column mapping to learn", which only holds if presets
 * ship.
 *
 * Sources are ordered by how many people actually have them, and MERGED
 * where they are the same job on the owner's instruction: every CSV-shaped
 * export is one door with the preset chosen inside it, rather than four
 * doors that all end at the same parser. Batch screenshots stays separate
 * because it is a genuinely different route — it is the OCR, not a parser —
 * and it is the only one that covers the books which do not export at all.
 *
 * Five steps, and nothing is written before step five. The dry run is the
 * whole trust proposition: it says what will happen before it happens.
 * ═══════════════════════════════════════════════════════════════════════ */
const IMPORT_STEPS=[['Source','Where is it from'],['File','Parsed with the preset'],
 ['Dry run','Nothing written yet'],['Resolve','Same screen as Fix problem bets'],
 ['Commit','With an undo window']];

const IMPORT_SOURCES=[
 ['A spreadsheet or CSV','Excel, Numbers, Sheets, or any tracker export. Pick the shape inside.','Most common'],
 ['A matched betting tracker','OddsMonkey or Profit Accumulator.','Large UK cohort'],
 ['A bookmaker export','Betfair P&L, or a statement where the book offers one.',''],
 ['Screenshots of settled bets','Batch, for the books that do not export at all.','Uses the slip reader']];

V.imphist={narrow:1,nav:'imp',back:'import',title:'Import history',html:()=>`<div class="pane">
 <ol class="wsteps">${IMPORT_STEPS.map((st,i)=>`
  <li class="${i===0?'on':''}"><b>${i+1} · ${esc(st[0])}</b><span>${esc(st[1])}</span></li>`).join('')}</ol>
 <h3 class="wq">Where is it coming from</h3>
 <div class="srcgrid">${IMPORT_SOURCES.map((o,i)=>`
  <button class="src${i===0?' on':''}" data-go="imphistreview">
   <b>${esc(o[0])}</b><span>${esc(o[1])}</span>${o[2]?`<em>${esc(o[2])}</em>`:''}</button>`).join('')}</div>
 <div class="factlist" style="margin-top:16px"><b style="font-size:13px">What imported history can and cannot do</b>
  ${[['Counts toward net and turnover','g','Yes'],['Shows on the calendar','g','Yes'],
     ['Affects win rate','r','No'],['Affects streaks','r','No'],
     ['Affects best and worst day','r','No'],['Carries a closing price','r','No']]
   .map(x=>`<div class="setrow" style="padding:9px 0"><div class="k" style="font-size:13px">${x[0]}</div><span class="pill ${x[1]}">${x[2]}</span></div>`).join('')}</div>
 <p class="note" style="margin-top:12px">Imported bets stay quarantined from your process
  statistics, which is what makes the rest of the numbers mean anything.</p></div>`};
V.imphistreview={narrow:1,nav:'imp',back:'imphist',title:'Check before saving',html:()=>`<div class="pane">
 <div class="card t"><div class="hd" style="margin:0"><div><b style="font-size:13.5px">18 rows read</b><div class="dd">Full bets · 2 look like duplicates</div></div>
  <span class="pill g">CSV</span></div></div>
 <div class="card"><div class="hd"><b>16 ticked</b><button class="chip" data-toast="All toggled">Toggle all</button></div>
  <div class="scrollbox">${[['4 Aug','Arsenal v Spurs','+£180.00',1,0],['7 Aug','Leeds v Burnley','−£45.00',1,0],['9 Aug','Kempton 19:45','+£275.00',1,0],['9 Aug','Kempton 19:45','+£275.00',0,1],['12 Aug','Inter v Milan','+£62.50',1,0],['15 Aug','York 16:10','−£90.00',1,0]].map(r=>`
   <div class="setrow"><button data-tickrow style="display:flex;gap:10px;align-items:center;flex:1">
    <span style="width:17px;height:17px;border-radius:5px;border:1.5px solid ${r[3]?'var(--pos)':'var(--line)'};background:${r[3]?'color-mix(in srgb,var(--pos) 20%,transparent)':'none'};display:grid;place-items:center;font-size:10px;color:var(--pos);flex:0 0 auto">${r[3]?'✓':''}</span>
    <span style="text-align:left"><span class="k" style="font-size:13px;display:block">${r[1]}</span><span class="dd" style="display:block">${r[0]}${r[4]?' · duplicate':''}</span></span></button>
   <div style="display:flex;gap:8px;align-items:center"><b class="mono" style="font-size:13px">${r[2]}</b>
    <button class="pill" style="padding:4px 9px;font-size:11px" data-sheet="editrow">Edit</button></div></div>`).join('')}</div></div>
 <button class="btn full" data-go="history">Import 16 rows</button></div>`};

/* ═══ SETTINGS ═══ */
V.settings={cols:1,nav:'set',html:()=>`<div class="pane"><h2 style="font-size:22px;margin:0 0 13px">Settings</h2>
 <div class="card"><div class="lbl" style="margin-bottom:4px">Account</div>
  <button class="setrow" data-sheet="profile"><div style="display:flex;gap:11px;align-items:center"><span class="av" style="width:36px;height:36px;font-size:13px">EM</span>
   <div><div class="k">EdgeMargin60</div><div class="dd">@edgemargin60</div></div></div><span class="pill">Edit</span></button>
  <button class="setrow" data-go="plan"><div><div class="k">Plan and payment</div><div class="dd">Free trial · 5 days and 12 slips left</div></div><span class="pill a">Trial ›</span></button>
  <button class="setrow" data-go="referrals"><div><div class="k">Refer a friend</div><div class="dd">They get ${TRIAL.ref}</div></div><span class="pill mono">SEUN-8QK4 ›</span></button></div>

 <div class="card"><div class="lbl" style="margin-bottom:9px">Appearance</div>
  <div class="themes">${THEMES.map(t=>`<button class="tcard" aria-current="${t[0]===cur.theme}" data-theme="${t[0]}">
   <div class="tprev" style="background:${t[3]}"><div class="l1" style="background:${t[5]}22"></div><div class="l2" style="background:${t[5]}14"></div>
    <div class="bar" style="background:${t[4]}"></div><span class="up" style="color:${t[0]==='light'?'#12925A':'#7FE3A6'}">+£48</span>
    <span class="dnn" style="color:${t[0]==='light'?'#D0364B':'#F5A3A3'}">−£12</span></div>
   <div class="tname">${t[1]}</div><div class="tdesc">${t[2]}</div></button>`).join('')}</div>
  <div class="setrow" style="margin-top:11px;border-top:1px solid var(--line)"><div><div class="k">Dates on the calendar</div><div class="dd">Show the day number in each cell</div></div><button class="tog" data-caldates aria-pressed="${cur.calDates}"></button></div>
  <button class="setrow" data-sheet="editov"><div><div class="k">Edit overview</div><div class="dd">Reorder or hide dashboard cards</div></div><span class="pill">Open ›</span></button>
  <button class="setrow" data-sheet="odds"><div class="k">Odds format</div><span class="pill">${cur.oddsFmt} ▾</span></button>
  <button class="setrow" data-sheet="currency"><div><div class="k">Currency</div><div class="dd">One per account. Figures are never summed across two.</div></div><span class="pill">${cur.currency||'GBP'} ${sym()} ▾</span></button>
  <button class="setrow" data-sheet="showin"><div class="k">Show profit in</div><span class="pill">${cur.showIn} ▾</span></button></div>

 <div class="card"><div class="lbl" style="margin-bottom:4px">Betting</div>
  <button class="setrow" data-sheet="unit"><div><div class="k">Your unit</div><div class="dd">Every group comparison uses this</div></div><span class="pill">£25 ▾</span></button>
  <button class="setrow" data-sheet="target"><div><div class="k">Target</div><div class="dd">Monthly · £2,000</div></div><span class="pill g">On ›</span></button>
  <button class="setrow" data-sheet="sources"><div><div class="k">Bookmakers, tipsters and sports</div><div class="dd">Where bets come from and what you bet on</div></div><span class="pill">9 · 4 · 4 ›</span></button>
  <button class="setrow" data-sheet="tags"><div><div class="k">Tags</div><div class="dd">Your own labels for why you took a bet</div></div><span class="pill">5 ›</span></button>
  <button class="setrow" data-sheet="markets"><div><div class="k">Market groups</div><div class="dd">Fold equivalent market names into one</div></div><span class="pill">27 ›</span></button>
  <button class="setrow" data-sheet="exposure"><div><div class="k">Open exposure</div><div class="dd">What is at risk against your bankroll</div></div><span class="pill">${exposurePct().toFixed(1)}% ›</span></button>
  <button class="setrow" data-sheet="bankroll"><div><div class="k">Starting bankroll</div><div class="dd">The figure growth is measured against. Your balance is worked out from it.</div></div><span class="pill">${money(startingBankroll()).replace('+','')} ›</span></button></div>

 <div class="card"><div class="lbl" style="margin-bottom:4px">Slips</div>
  <button class="setrow" data-sheet="bot"><div><div class="k">${TG} Telegram</div><div class="dd">Not linked</div></div><span class="pill">Set up</span></button>
  <button class="setrow" data-sheet="rules"><div><div class="k">Reading rules</div><div class="dd">What it does when a slip is unclear</div></div><span class="pill">6 ›</span></button>
  <button class="setrow" data-sheet="fix"><div><div class="k">Fix problem bets</div><div class="dd">Missing a fixture, sport, or split</div></div><span class="pill a">7 ›</span></button>
  <div class="setrow"><div><div class="k">Imported history</div><div class="dd">You chose No at setup</div></div><button class="tog" data-tog aria-pressed="false"></button></div></div>

 <div class="card"><div class="lbl" style="margin-bottom:4px">Privacy and data</div>
  <button class="setrow" data-sheet="privacy"><div><div class="k">Who can see your figures</div><div class="dd">Only Slippers you follow back</div></div><span class="pill">Friends only ▾</span></button>
  <button class="setrow" data-sheet="weekly"><div><div class="k">Weekly summary</div><div class="dd">Sunday email with the week in one card</div></div><span class="pill g">On ›</span></button>
  <button class="setrow" data-sheet="notifs"><div><div class="k">Notifications</div><div class="dd">What we message and email you about</div></div><span class="pill">4 on ›</span></button>
  <button class="setrow" data-sheet="security"><div><div class="k">Security</div><div class="dd">Password, two step sign in, devices</div></div><span class="pill">Open ›</span></button>
  <button class="setrow" data-sheet="share"><div><div class="k">Share an image</div><div class="dd">Calendar, curve or summary, money optional</div></div><span class="pill">Open ›</span></button>
  <button class="setrow" data-sheet="export"><div class="k">Export all bets</div><span class="pill">CSV · JSON · PDF ›</span></button>
  <button class="setrow" data-toast="Slip images deleted"><div><div class="k">Slip images</div><div class="dd">Kept 90 days, then deleted</div></div><span class="pill">Delete now</span></button></div>

 <div class="card"><div class="lbl" style="margin-bottom:4px">Help</div>
  <!-- 07 · The guided tour is gone. A tour describes the product from a
       modal; the three-step checklist on the dashboard walks it, and removes
       itself when it is done. -->
  <button class="setrow" data-sheet="support"><div class="k">Support</div><span class="pill">Contact ›</span></button>
  <button class="setrow" data-sheet="changelog"><div class="k">Changelog</div><span class="pill">Open ›</span></button>
  <button class="setrow" data-sheet="terms"><div class="k">Terms of use</div><span class="pill">Open ›</span></button>
  <button class="setrow" data-sheet="privacypol"><div class="k">Privacy policy</div><span class="pill">Open ›</span></button></div>

 <div class="card"><button class="setrow" data-toast="Logged out"><div class="k">Log out</div><span class="pill">›</span></button>
  <button class="setrow" data-sheet="reset"><div><div class="k">Reset account</div><div class="dd">Deletes every bet, keeps your account</div></div><span class="pill a">Reset</span></button>
  <button class="setrow" data-sheet="delacc"><div class="k">Delete account</div><span class="pill r">Delete</span></button></div></div>`};
V.plan={narrow:1,nav:'set',back:'settings',title:'Plan and payment',html:()=>`<div class="pane">
 <div class="card" style="border-color:color-mix(in srgb,var(--a) 40%,transparent)"><div class="hd"><b>Free trial</b><span class="chip a">5 days left</span></div>
  <div class="track" style="margin-bottom:11px"><div class="fill amb" data-w="64"></div></div>
  <div class="setrow"><div class="k">Slips used</div><b class="mono">8 of 20</b></div>
  <div class="setrow"><div><div class="k">First charge</div><div class="dd">2 Sep 2026 · yearly</div></div><b class="mono">£29.99</b></div>
  <p class="note">Emailed 7 days before. Cancel before then and you pay nothing.</p></div>
 <div class="card"><div class="lbl" style="margin-bottom:6px">Payment method</div>
  <button class="setrow" data-sheet="card"><div><div class="k">Visa ending 4142</div><div class="dd">Expires 09/29</div></div><span class="pill">Change</span></button></div>
 <div class="card"><div class="lbl" style="margin-bottom:6px">Change plan</div>
  <button class="setrow" data-portal><div><div class="k">Monthly</div><div class="dd">£3.49 a month</div></div><span class="pill">Choose</span></button>
  <button class="setrow" data-portal><div><div class="k">Yearly</div><div class="dd">£29.99 a year</div></div><span class="pill g">Current</span></button></div>
 <button class="btn danger full" data-sheet="cancelplan">Cancel plan</button></div>`};
V.referrals={narrow:1,nav:'set',back:'settings',title:'Refer a friend',html:()=>`<div class="pane">
 <div class="card" style="text-align:center;border-color:var(--p)"><div class="lbl">Your code</div>
  <div class="mono" style="font-size:27px;letter-spacing:.08em;margin:8px 0 6px">SEUN-8QK4</div>
  <p class="note" style="margin:0 0 12px">They get ${TRIAL.ref} instead of ${TRIAL.base}.</p>
  <button class="btn full sm" data-toast="Link copied">Share</button></div>
 <div class="card"><div class="hd"><b>Used by</b><span class="pill">3</span></div>
  ${[['NapKing','12 Aug','On trial','a'],['ValueVault','4 Aug','Paying','g'],['SlipCity','28 Jul','Lapsed','r']].map(r=>`
   <div class="setrow"><div><div class="k">${r[0]}</div><div class="dd">${r[1]}</div></div><span class="pill ${r[3]}">${r[2]}</span></div>`).join('')}
  <p class="note">No reward on your side.</p></div></div>`};

/* ═══ AUTH ═══ */
const wiz=(n,t,title,sub,body)=>`<div class="pane">
 <div style="display:flex;gap:5px;margin-bottom:15px">${Array.from({length:t},(_,i)=>`<i style="height:3px;flex:1;border-radius:9px;background:${i<n?'var(--p)':'rgba(255,255,255,.12)'};transition:background .4s var(--e)"></i>`).join('')}</div>
 <div class="lbl">Step ${n} of ${t}</div><h2 style="font-size:22px;margin:6px 0 6px">${title}</h2>
 <p class="note" style="margin:0 0 13px">${sub}</p>${body}</div>`;
/* ═══ ONE DOOR ═════════════════════════════════════════════════════════════
 *
 * Sign in and sign up were two screens with a link between them, and the
 * user was being asked to declare something the server already knows: does
 * an account with this address exist. Nobody arriving at a product wants to
 * answer that question. They want in.
 *
 * One screen, no mode toggle. Social above the divider because it is the
 * shortest path and skips the password entirely; email below it. One
 * primary action; everything else is outline weight, so there is never a
 * question of which button is the one.
 *
 * TERMS AND PRIVACY ARE BUTTONS, NOT SMALL PRINT. "By continuing you agree"
 * is a sentence that asks somebody to accept a document they have not been
 * shown. Each opens the real document, and the acknowledgement inside it
 * only becomes pressable once it has been scrolled to the end. Both are
 * required before Continue enables.
 *
 * A disabled button with nothing to explain it reads as broken, so a single
 * line underneath always states what is still outstanding.
 * ═══════════════════════════════════════════════════════════════════════ */
V.auth={bare:1,html:()=>`<div class="pane authpane">
 <div class="authhead">
  <h2 class="authh">Sign in or create an account</h2>
  <p class="note authsub">One screen either way. If the address is new, we will set it up.</p>
 </div>

 <button class="btn ghost full authsocial" data-toast="Google sign-up"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"/><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.7v3C3.6 21.4 7.5 24 12 24z"/><path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.7a12 12 0 0 0 0 10.6l3.9-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.5 0 3.6 2.6 1.7 6.4l3.9 3C6.5 6.8 9 4.8 12 4.8z"/></svg><span>Continue with Google</span></button>

 <div class="authdiv"><span>or with your email</span></div>

 <label class="flabel" for="authEmail">Email</label>
 <input class="field" id="authEmail" type="email" inputmode="email" autocomplete="email"
   spellcheck="false" placeholder="you@example.com" autocomplete="email" inputmode="email" data-authemail>
 <label class="flabel" for="authPass">Password</label>
 <input class="field" id="authPass" type="password" autocomplete="current-password"
   placeholder="At least 8 characters" data-authpass>

 <div class="authdocs">
  <button class="docbtn" data-doc="terms">
   <span class="dtick" aria-hidden="true"></span>
   <span class="dtxt"><b>Terms of use</b><i>Read and acknowledge</i></span>
   <span class="caret">›</span></button>
  <button class="docbtn" data-doc="privacypol">
   <span class="dtick" aria-hidden="true"></span>
   <span class="dtxt"><b>Privacy policy</b><i>Read and acknowledge</i></span>
   <span class="caret">›</span></button>
 </div>

 <button class="btn full authgo" id="su1go" disabled aria-disabled="true" data-authgo>Continue</button>
 <p class="note authneed whydis" id="docHint" aria-live="polite"></p>

 <p class="authalt"><button data-sheet="forgot">Forgotten your password?</button></p>
</div>`};

V.su1={bare:1,html:()=>V.auth.html()};
V.su429={bare:1,html:()=>wiz(1,6,'Create your account','',`
 <label class="flabel">Email</label><input class="field" type="email" inputmode="email" autocomplete="email" spellcheck="false" aria-label="Email address" value="seun4150@gmail.com">
 <div class="card" style="margin-top:13px;border-color:color-mix(in srgb,var(--neg) 42%,transparent);background:color-mix(in srgb,var(--neg) 8%,transparent)">
  <b style="font-size:14px;color:var(--neg)">Too many attempts</b>
  <p class="note" style="margin-top:4px;color:var(--t2)">Try again in <b class="mono" style="color:var(--t1)">4:52</b>.</p></div>
 <button class="btn full" style="margin-top:13px" disabled aria-disabled="true">Try again in 4:52</button>
 <p class="note" style="text-align:center">Signup and sign in are both paused while the timer runs.</p>`)};
V.su2={bare:1,html:()=>wiz(2,6,'Check your email','Six digits sent to seun4150@gmail.com.',`
 <div style="display:flex;gap:7px;margin-top:8px" role="group" aria-label="Six digit verification code">${[0,1,2,3,4,5].map(i=>`<input class="field mono" style="text-align:center;padding:16px 0;margin:0;font-size:20px" maxlength="1" value="${i<3?'4':''}" aria-label="Digit ${i+1} of 6" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*">`).join('')}</div>
 <button class="btn full" style="margin-top:20px" data-go="su3">Verify</button>
 <div style="display:flex;gap:9px;margin-top:10px"><button class="btn ghost full sm" data-toast="Code resent">Resend</button>
  <button class="btn ghost full sm" data-go="su1">Change email</button></div>`)};
V.su3={bare:1,html:()=>wiz(3,6,'Pick a display name','Groups and followers see this. One change a month after that.',`
 <label class="flabel" for="su3name">Display name</label>
 <input class="field" id="su3name" autocomplete="nickname" value="EdgeMargin60" style="margin-top:0">
 <p class="note">Your handle will be <b class="mono" style="color:var(--t2)">@edgemargin60</b></p>
 <details class="disc" style="margin-top:8px"><summary style="border:0"><span style="font-size:13.5px;color:var(--s)">Have a promo or referral code?</span><span class="caret">▾</span></summary>
  <label class="flabel" for="su3promo">Promo or referral code</label>
  <input class="field" id="su3promo" autocomplete="off" value="SEUN-8QK4" style="margin-top:0">
  <p class="note" style="color:var(--pos)">Referral applied · ${TRIAL.ref} instead of ${TRIAL.base}</p></details>
 <button class="btn full" style="margin-top:16px" data-go="su4">Continue</button>`)};
V.su4={bare:1,html:()=>wiz(4,6,'What is one unit?','Your normal stake. It lets you compare with people who bet bigger or smaller.',`
 <div class="chips" style="margin-top:10px">${['£5','£10','£20','£25','£50','£100','Custom'].map(x=>`<button class="chip" aria-current="${x==='£'+cur.unit}" data-setunit="${x}">${x}</button>`).join('')}</div>
 <div class="card t" style="margin-top:12px" id="unitEg">${unitExample(cur.unit)}</div>
 <div class="card t" style="margin-top:10px" id="unitPrev">${unitPreview(cur.unit)}</div>
 <p class="note">Change it later in Settings. Bets already logged keep the unit they were logged with.</p>
 <button class="btn full" style="margin-top:16px" data-go="su5">Continue</button>`)};
V.su5={bare:1,html:()=>wiz(5,6,'What do you bet on?','Tunes the reader and the breakdowns.',`
 <label class="flabel">Sports</label>
 <div class="chips" style="margin-top:6px">${['Football','Tennis','Horse racing','Other'].map((x,i)=>`<button class="chip" aria-current="${i<3}" data-multi>${x}</button>`).join('')}</div>
 <label class="flabel">Bookmakers</label>
 <div style="margin-top:4px">
 ${BOOKS.map((c,ci)=>`<details class="disc" ${ci===0?'open':''}><summary><span style="font-size:13.5px">${c[0]}</span>
  <span style="display:flex;gap:8px;align-items:center"><span class="pill" style="padding:3px 9px;font-size:11px">${c[1].length}</span><span class="caret">▾</span></span></summary>
  <div class="chips">${c[1].map((b,i)=>`<button class="chip" aria-current="${ci===0&&i<3}" data-multi>${b}</button>`).join('')}</div></details>`).join('')}</div>
 <button class="btn ghost full sm" style="margin:11px 0" data-sheet="addbook">+ Add a bookmaker</button>
 <button class="btn full" data-go="su6">Continue</button>`)};
V.su6={bare:1,html:()=>wiz(6,6,'Choose a plan','Pick one now. You can switch or cancel later.',`
 ${cur.promo?`<div class="promoline"><span>✓ Code <b>${cur.promo}</b> applied · your trial is ${TRIAL.ref}</span>
   <button class="promox" data-promoclear aria-label="Remove code">✕</button></div>`
  :`<div class="promobox"><input class="field" autocomplete="off" spellcheck="false" placeholder="Promo or referral code" data-promoinput>
   <button class="btn ghost sm" data-promoapply>Apply</button></div>`}
 ${[['Free trial','£0',TRIAL.ref+', whichever ends sooner (switches to annual subscription after).',0],
    ['Monthly','£3.49 a month','Charged today, then every month.',0],
    ['Annual','£29.99 a year','£2.50 a month. Save £11.89 against monthly.',1]].map((x,i)=>`
  <button class="plancell${x[3]?' on':''}" data-pickone data-plan="${['trial','monthly','annual'][i]}" aria-current="${x[3]}">
   ${x[3]?'<span class="badge">Most popular</span>':''}
   <div><b>${x[0]}</b><span>${x[2]}</span></div><b class="mono pr">${x[1]}</b></button>`).join('')}
 <p class="note" style="text-align:center;margin:14px 0 0">A card is needed for every plan, nothing is charged today on the Free Trial.</p>

 <!-- 18 · WHAT YOUR DASHBOARD OPENS ON.
      A new account has zero bets, so an eight-module preset renders four
      real cards and four greyed ones — which teaches somebody on their first
      minute that most of this product does not work. A preset has to match
      what exists on day one. -->
 <div class="presets">
  <div class="flabel" id="presetLbl">Your dashboard opens with</div>
  <div role="radiogroup" aria-labelledby="presetLbl">
  ${PRESETS.map(pz=>`<button type="button" class="plancell${(cur.preset||'simple')===pz[0]?' on':''}"
    role="radio" aria-checked="${(cur.preset||'simple')===pz[0]}" data-preset="${pz[0]}">
   <div><b>${esc(pz[1])}</b><span>${esc(pz[2])}</span></div>
   ${(cur.preset||'simple')===pz[0]?'<span class="pill g">✓</span>':''}</button>`).join('')}
  </div>
  <p class="note">Change it whenever you like, in Edit overview.</p></div>

 <button class="btn full" style="margin-top:12px" data-checkout>Continue to payment</button>`)};
V.login={bare:1,html:()=>V.auth.html()};
V.loginOld={bare:1,html:()=>`<div class="pane"><h2 style="font-size:22px;margin:20px 0 5px">Sign in</h2>
 <p class="note" style="margin:0 0 14px">Welcome back.</p>
 <label class="flabel" for="loginid">Username or email</label><input class="field" id="loginid" autocomplete="username" value="EdgeMargin60">
 <label class="flabel">Password</label><input class="field" autocomplete="off" type="password" autocomplete="current-password" value="••••••••••">
 <button class="btn full" style="margin-top:15px" data-signin>Sign in</button>
 <p style="text-align:center;margin-top:11px"><button style="font-size:13px;color:var(--t3)" data-sheet="forgot">Forgotten your password?</button></p>
 <p style="text-align:center"><button style="font-size:13px;color:var(--s)" data-go="su1">New here? Create an account</button></p></div>`};
V.demo={nav:'dash',tab:'OVERVIEW',run:1,demo:1,html:()=>V.overview.html()};
const WHOAMI=()=>cur.view==='demo'?{n:'Tester123',h:'@tester123',i:'T1'}:{n:'EdgeMargin60',h:'@edgemargin60',i:'EM'};
V.bs_reminder={nav:'set',back:'settings',title:'Plan',html:()=>`<div class="pane">
 <div class="card" style="border-color:color-mix(in srgb,var(--a) 45%,transparent)"><div class="hd"><b>Trial ends in 7 days</b><span class="chip a">Reminder</span></div>
  <p class="note" style="margin:0 0 12px;color:var(--t2)">On 2 Sep we charge <b class="mono" style="color:var(--t1)">£29.99</b> to your Visa ending 4142.</p>
  <button class="btn full" style="margin-bottom:9px" data-toast="Plan kept">Keep my plan</button>
  <button class="btn ghost full" style="margin-bottom:9px" data-portal>Switch to monthly, £3.49</button>
  <button class="btn danger full" data-sheet="cancelplan">Cancel, do not charge me</button></div></div>`};
/* 07 · A FAILED PAYMENT IS THE MOST VALUABLE MOMENT YOU GET WITH A PAYING
 * CUSTOMER, and this screen was a narrow column with a dead button in it.
 *
 * What somebody on it needs to know, in the order they need it: it still
 * works, here is the card that failed, here is how long you have, here is
 * what happens to your data if you do nothing, and here is the one button.
 * "Try again now" is a real retry through Stripe's portal rather than a
 * toast, and the retry is secondary to updating the card because a decline
 * usually means the card, not the moment. */
V.bs_failed={nav:'set',back:'settings',title:'Plan',html:()=>`<div class="pane">
 <div class="card" style="border-color:color-mix(in srgb,var(--neg) 40%,transparent)">
  <div class="hd"><b style="color:var(--neg);font-size:16px">Payment declined</b>
   <span class="chip a">Attempt 1 of 2</span></div>
  <p class="note" style="margin:0 0 12px;color:var(--t2)">Everything still works and nothing has
   been deleted. We try again on <b style="color:var(--t1)">2 September</b>.</p>

  <div class="card t" style="margin:0 0 12px">
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Card on file</div>
    <b class="mono" style="font-size:13px">Visa ending 4142</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Amount</div>
    <b class="mono" style="font-size:13px">£29.99</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Reason given</div>
    <b style="font-size:13px;color:var(--t2)">Insufficient funds</b></div></div>

  <div class="track" style="margin-bottom:8px"><div class="fill neg" data-w="50"></div></div>
  <p class="note" style="margin:0 0 12px">If the second attempt fails on 2 September the account
   goes <b style="color:var(--t1)">read only</b>. That means you can still read everything and
   export it; you cannot log new bets. <b style="color:var(--t1)">Nothing is ever deleted for
   non-payment.</b></p>

  <button class="btn full" style="margin-bottom:9px" data-portal>Update card</button>
  <button class="btn ghost full" style="margin-bottom:9px" data-retrypay>Try again now</button>
  <button class="btn ghost full sm" data-sheet="export">Export everything first</button></div></div>`};
V.bs_readonly={narrow:1,nav:'set',back:'settings',title:'Plan',html:()=>`<div class="pane">
 <div class="card" style="border-color:color-mix(in srgb,var(--neg) 45%,transparent)"><div class="hd"><b>Read only</b><span class="chip l">Paused</span></div>
  <p class="note" style="margin:0 0 12px;color:var(--t2)">Two payment attempts failed. Everything you logged is safe and stays here.</p>
  ${[['See your ledger','g','Yes'],['Export everything','g','Yes'],['Log new slips','r','Paused'],['Import history','r','Paused'],['Telegram bot','r','Paused']].map(x=>`<div class="setrow"><div class="k">${x[0]}</div><span class="pill ${x[1]}">${x[2]}</span></div>`).join('')}
  <button class="btn full" style="margin-top:12px" data-sheet="card">Restart my plan</button>
  <button class="btn ghost full" style="margin-top:9px" data-sheet="export">Export and close</button></div></div>`};

/* ═══ SHEETS ═══ */
Object.assign(SH,{
 day:()=>{const d=cur.dayIdx||19,v=DAYVALS[d]||0,bl=BETSFOR(d);
  return `<div class="hd"><b style="font-size:16px">${d} August 2026</b><span class="chip ${v>0?'w':'l'}">${v>0?'+':'−'}${sym()}${Math.abs(v)}</span></div>
  <div class="g3" style="margin-bottom:10px">${[['Staked',amount(bl.st)],['Returned',amount(bl.rt)],['Bets',bl.n]].map(x=>`<div class="stat"><div class="k">${x[0]}</div><div class="v mono">${x[1]}</div></div>`).join('')}</div>
  <div class="g3" style="margin-bottom:12px">${[['Win rate',bl.wr],['ROI',bl.roi],['Units',bl.u]].map(x=>`<div class="stat"><div class="k">${x[0]}</div><div class="v mono">${x[1]}</div></div>`).join('')}</div>
  <div class="card t">${bl.rows}</div>
  <button class="btn ghost full sm" data-go="ledger">See these in the ledger</button>`},
 period:()=>`<div class="hd"><b style="font-size:16px">Period</b></div>
  ${PERLIST.map(x=>`<button class="setrow" data-setper="${x[0]}"><div class="k">${x[1]}</div>${x[0]===cur.per?'<span class="pill g">✓</span>':''}</button>`).join('')}
  <div class="setrow"><div class="k">Custom range</div></div>
  <div style="display:flex;gap:9px"><div style="flex:1"><label class="flabel">From</label><input class="field mono" value="01/08/2026"></div>
   <div style="flex:1"><label class="flabel">To</label><input class="field mono" value="19/08/2026"></div></div>
  <button class="btn full" style="margin-top:12px" data-toast="Custom range applied">Apply range</button>`,
 weekstart:()=>`<div class="hd"><b style="font-size:16px">Week starts on</b></div>
  ${[['Monday',1],['Sunday',0]].map(o=>`<button class="setrow" data-ws="${o[1]}"><div class="k">${o[0]}</div>${cur.weekStart===o[1]?'<span class="pill g">✓</span>':''}</button>`).join('')}`,
 run:()=>`<div class="hd"><b style="font-size:16px">${cur.running} bets running</b><span class="chip a">${sym()}${cur.risk} at risk</span></div>
  ${[['Chelsea v Newcastle','Over 2.5 Goals · 1.91 · £25 · bet365','KO 20:00'],
     ['Leeds v Burnley','Leeds −1 · 2.40 · £25 · Sky Bet','KO 20:00'],
     ['Sinner v Alcaraz','Sinner · 1.72 · £18 · Betfred','In play'],
     ['Kempton 19:45','Selection 4 · 4.50 · £20 · Coral','Off 19:45']].map(r=>`
   <div class="card t"><div style="display:flex;gap:10px;align-items:flex-start">
    <span class="o r" style="width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:9px;flex:0 0 auto;margin-top:2px;background:color-mix(in srgb,var(--a) 16%,transparent);color:var(--a)">●</span>
    <div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:600;line-height:1.35">${r[0]}</div>
     <div style="font-size:11.5px;color:var(--t3);margin-top:3px;line-height:1.45">${r[1]}</div></div>
    <span style="font-size:11px;color:var(--a);white-space:nowrap;margin-top:2px">${r[2]}</span></div>
   <div class="mark2">${['Won','Lost','Void'].map(m=>`<button data-settle="${r[0]} · ${m.toLowerCase()}">${m}</button>`).join('')}<button data-sheet="cashout">Cash out</button></div></div>`).join('')}
  <div class="barline" style="margin-top:4px"><div class="h"><span>Open against bankroll</span><b class="mono" style="color:var(--a)">${exposurePct().toFixed(1)}%</b></div>
   <div class="track"><div class="fill amb" data-w="9"></div></div></div>
  <button class="btn full" style="margin-top:10px" data-check>Check results now</button>
  <button class="btn ghost full sm" style="margin-top:9px" data-sheet="stale">3 waiting on a result</button>`,
 profile:()=>`<div class="card" style="text-align:center;margin-bottom:12px">
   <span class="avwrap"><span class="av" style="width:58px;height:58px;font-size:20px">EM</span>
    <button class="pencil" data-toast="Choose a picture" aria-label="Change profile picture">${PENCIL}</button></span>
   <div class="namerow"><b style="font-size:17px">EdgeMargin60</b>
    <button class="pencil sm" data-editname aria-label="Edit display name">${PENCIL}</button></div>
   <div class="dd" style="color:var(--t3)">@edgemargin60</div>
   <div class="g3" style="margin-top:13px"><div class="stat"><div class="k">Units</div><div class="v mono" style="color:var(--pos)">+47.4u</div></div>
    <div class="stat"><div class="k">ROI</div><div class="v mono" style="color:var(--pos)">+38.2%</div></div>
    <div class="stat"><div class="k">Bets</div><div class="v mono">412</div></div></div>
   <p class="note" style="margin-top:11px">This is how you look to people who follow you.</p></div>
  <div class="hd" style="margin-bottom:6px"><b style="font-size:14px">Your details</b></div>
  <label class="flabel">Display name</label><input class="field" autocomplete="off" value="EdgeMargin60">
  <p class="note">One change a month. Next available 1 Sep 2026.</p>
  <label class="flabel">Handle</label><input class="field mono" value="@edgemargin60" disabled style="opacity:.6">
  <button class="btn full" style="margin-top:12px" data-toast="Profile saved">Save</button>`,
 bankrolladapt:()=>`<div class="hd"><b style="font-size:16px">Bankroll</b></div>
  <div class="setrow"><div><div class="k">Adaptive bankroll</div><div class="dd">Your bankroll moves with settled results, so exposure always reads against what you actually hold</div></div>
   <button class="tog" data-adapt aria-pressed="${cur.adaptBr!==false}"></button></div>
  <div class="brline" style="margin-top:4px"><span>Started with <b>${sym()}${BR_START.toLocaleString('en-GB')}</b></span>
   <span>Now <b>${money(bankroll()).replace('+','')}</b></span></div>
  <p class="note" style="margin-top:10px">${cur.adaptBr!==false?'Exposure is measured against '+money(bankroll()).replace('+','')+'.':'Exposure is measured against your starting £'+BR_START.toLocaleString('en-GB')+' only.'}</p>
  <button class="btn ghost full sm" style="margin-top:12px" data-resetbr>Reset to starting balance</button>`,
 calopts:()=>`<div class="hd"><b style="font-size:16px">Calendar</b></div>
  <div class="setrow"><div><div class="k">Show in units</div><div class="dd">Each day as ${cur.calUnits?'units':'money'}, matching how you compare with others</div></div>
   <button class="tog" data-calunits aria-pressed="${cur.calUnits}"></button></div>
  <div class="setrow"><div><div class="k">Dates in each cell</div><div class="dd">The day number under the figure</div></div>
   <button class="tog" data-caldates aria-pressed="${cur.calDates}"></button></div>
  <p class="note">The calendar always shows a month. The period selector above changes every other figure, not this.</p>`,
 netfigs:()=>`<div class="hd"><b style="font-size:16px">Net this month</b></div>
  <p class="note" style="margin:0 0 12px">Pick the figures that sit under the headline. Two or three reads best.</p>
  ${NETORDER().map(k=>({bets:['bets','Bets','How many settled in the period'],
     units:['units','Units','Profit in unit terms'],
     turnover:['turnover','Turnover','Total staked, voids excluded'],
     roi:['roi','ROI','Return on what you staked'],
     winrate:['winrate','Win rate','Settled winners against the total']}[k])).map(x=>`
   <div class="setrow"><div><div class="k">${x[1]}</div><div class="dd">${x[2]}</div></div>
    <span style="display:flex;gap:5px;align-items:center">
     <button class="mvbtn" data-netmv="up" data-k="${x[0]}" aria-label="Move up">↑</button>
     <button class="mvbtn" data-netmv="dn" data-k="${x[0]}" aria-label="Move down">↓</button>
     <button class="tog" data-netfig="${x[0]}" aria-pressed="${(cur.netShow.length?cur.netShow:['bets','units']).indexOf(x[0])>=0}"></button></span></div>`).join('')}
  <p class="note">At least one figure stays on. Use the arrows to change the order.</p>`,
 editov:()=>`<div class="hd"><b style="font-size:16px">Edit overview</b></div>
  <p class="note" style="margin:0 0 10px">Drag to reorder. The toggle keeps a card on the overview.</p>
  <div style="display:flex;gap:8px;margin-bottom:12px">
   <button class="btn ghost full sm" data-selall>${cur.above.length>=cur.order.length?'Turn all off':'Turn all on'}</button>
   <button class="btn ghost full sm" data-resetov>Reset to default</button></div>
  <div id="editList">${cur.order.map(k=>{const c=CARDS.find(x=>x[0]===k),on=cur.above.includes(k);
   return `<div class="editrow" draggable="true" data-ek="${k}">
    <span class="gr" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
    <span class="nm2" style="${on?'':'opacity:.5'}">${c[1]}</span>
    <button class="mvbtn" data-mv="up" data-k="${k}" aria-label="Move ${c[1]} up">↑</button>
    <button class="mvbtn" data-mv="dn" data-k="${k}" aria-label="Move ${c[1]} down">↓</button>
    ${cur.LOCKED.includes(k)?'<span class="pill">Always on</span>':`<button class="tog" data-above="${k}" aria-pressed="${on}" aria-label="Show ${c[1]} on the overview" style="transform:scale(.82)"></button>`}</div>`}).join('')}</div>
  <button class="btn full" style="margin-top:12px" data-close>Done</button>`,
 /* 17 · THE CODE IS FETCHED, NOT INVENTED. `POST /api/telegram/link` has
    existed since the bot was built and this sheet showed a hardcoded
    SLIP-4K2P beside it — so the code on screen was never the code the bot
    would accept. `data-linkcode` asks for a real one on open. */
 bot:()=>`<div class="hd"><b style="font-size:16px">${TG} Telegram</b></div>
  ${cur.signedIn?`<div class="card t" style="text-align:center;border-color:var(--p)"><div class="lbl">Your code</div>
   <div class="mono linkcode" data-linkcode style="font-size:26px;letter-spacing:.1em;margin:6px 0 3px">${
     cur.linkCode?esc(cur.linkCode):'<span class="skel" style="display:inline-block;width:150px;height:26px"></span>'}</div>
   <p class="note" style="margin:0">Expires in 15 minutes</p></div>
  <a class="btn full" style="margin-bottom:9px;display:block;text-align:center;text-decoration:none"
   href="https://t.me/SlipperyAppBot" target="_blank" rel="noopener">Open Telegram</a>
  <button class="btn ghost full" style="margin-bottom:9px" data-copycode>Copy code</button>
  <div class="status" style="justify-content:center"><span class="spin"></span><span>Waiting for the bot…</span></div>
  <button class="btn ghost full sm" style="margin-top:12px" data-sheet="botlinked">See the linked state</button>`
  :`<p class="note" style="margin:0 0 14px">Sign in first. The bot links to your account, so it needs one to link to.</p>
  <button class="btn full" data-go="su1">Create an account</button>
  <button class="btn ghost full" style="margin-top:9px" data-go="login">Sign in</button>`}`,
 botlinked:()=>`<div class="hd"><b style="font-size:16px">${TG} Linked</b><span class="pill g">Active</span></div>
  <p class="note" style="margin:0 0 12px">Connected as @edgemargin60 since 14 Aug.</p>
  <div class="setrow"><div class="k">Your code</div><span class="pill mono">SLIP-4K2P</span></div>
  <button class="btn ghost full sm" style="margin:12px 0 9px" data-sheet="resetcode">Reset code</button>
  <button class="btn danger full sm" data-sheet="unlink">Unlink Telegram</button>`,
 resetcode:()=>`<div class="hd"><b style="font-size:16px">Reset your code?</b></div>
  <p class="note" style="margin:0 0 14px">The old code stops working. Telegram stays linked and no bets change.</p>
  <button class="btn full" style="margin-bottom:9px" data-toast="New code SLIP-9M3X">Reset</button><button class="btn ghost full" data-close>Cancel</button>`,
 unlink:()=>`<div class="hd"><b style="font-size:16px">Unlink Telegram?</b></div>
  <p class="note" style="margin:0 0 14px">The bot stops accepting slips. Every bet stays exactly as it is.</p>
  <button class="btn danger full" style="margin-bottom:9px" data-unlinktg>Unlink</button><button class="btn ghost full" data-close>Cancel</button>`,
 target:()=>`<div class="hd"><b style="font-size:16px">Target</b></div>
  <div class="setrow"><div class="k">Show a target</div><button class="tog" data-tog aria-pressed="true"></button></div>
  <label class="flabel">Period</label><div style="margin-top:6px">${segHTML(['Daily','Weekly','Monthly','Yearly'],'Monthly').replace('class="seg"','class="seg full"')}</div>
  <label class="flabel">Amount</label><input class="field mono" value="2000">
  <p class="note">Amber below pace, blue on pace, green when met.</p>
  <button class="btn full" style="margin-top:12px" data-toast="Target saved">Save</button>`,
 cashout:()=>{const f=cur.cashF||4,rem=cur.cashRem||100,part=rem*f/8,price=1.42;
  return `<div class="hd"><b style="font-size:16px">Cash out</b><span class="pill a">Chelsea v Newcastle</span></div>
  <div class="card t"><div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Remaining stake</div><b class="mono" style="font-size:13px">${sym()}${rem.toFixed(2)}</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Offer</div><b class="mono" style="font-size:13px">${price.toFixed(2)} of stake</b></div></div>
  <label class="flabel">How much of what is left</label>
  <div style="text-align:center;margin:10px 0 4px"><b class="mono" style="font-size:30px;letter-spacing:-.02em">${f}/8</b>
   <div class="dd" style="text-align:center;margin-top:2px">${sym()}${part.toFixed(2)} of ${sym()}${rem.toFixed(2)}</div></div>
  <input type="range" min="1" max="8" step="1" value="${f}" data-cashslider style="width:100%;accent-color:var(--p)">
  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-top:2px">
   ${[1,2,3,4,5,6,7,8].map(i=>`<span>${i}</span>`).join('')}</div>
  <div class="card t" style="margin-top:12px">
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Cashing out now</div><b class="mono" style="font-size:13px;color:var(--a)">${sym()}${(part*price).toFixed(2)}</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Realised on this part</div><b class="mono" style="font-size:13px;color:var(--pos)">+${sym()}${(part*price-part).toFixed(2)}</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Still running</div><b class="mono" style="font-size:13px">${sym()}${(rem-part).toFixed(2)} at 1.91</b></div></div>
  <button class="btn full" style="margin-top:12px" data-cashdo>Cash out ${f}/8</button>
  <p class="note">Each pull is recorded separately. You can cash out again from what is left.</p>`},
 exposure:()=>`<div class="hd"><b style="font-size:16px">Open exposure</b><span class="chip a">£88 at risk</span></div>
  <div class="barline"><div class="h"><span>Against a ${money(bankroll()).replace('+','')} bankroll</span>
    <b class="mono" style="color:var(--a)">${exposurePct().toFixed(1)}%</b></div>
   <div class="track" style="height:9px"><div class="fill amb" data-w="${Math.round(exposurePct())}"></div></div></div>
  <div class="brline"><span>Started with <b>${sym()}${BR_START.toLocaleString('en-GB')}</b></span>
   <span>Settled since <b style="color:var(--pos)">${money(PERIODS.All.net)}</b></span></div>
  <p class="note" style="margin:8px 0 14px">Your bankroll moves with your results, so the percentage always reflects what you actually hold. Well inside your 25% cap.</p>
  ${[['Bets running',4,'run','Settle or cash out'],['Waiting on a result',3,'stale','Finished with no result back'],['Fix problem bets',7,'fix','Missing a fixture, sport or split']]
   .filter(x=>x[1]>0).map(x=>`
   <button class="setrow" data-sheet="${x[2]}"><div><div class="k">${x[0]}</div><div class="dd">${x[3]}</div></div>
    <span class="pill a">${x[1]} ›</span></button>`).join('')}
  <p class="note">Items disappear from here once there is nothing to do.</p>`,
 stale:()=>`<div class="hd"><b style="font-size:16px">Waiting on a result</b><span class="pill a">3</span></div>
  <p class="note" style="margin:0 0 11px">These finished a while ago and no result came back. Every figure depends on the ledger being clean.</p>
  ${[['Sinner v Alcaraz','Finished 4 hours ago','£18'],['Kempton 19:45','Off 2 hours ago','£20'],['Ajax v PSV','Finished yesterday','£25']].map(x=>`
   <div class="card t"><div class="hd" style="margin:0 0 8px"><div><b style="font-size:13.5px">${x[0]}</b><div class="dd">${x[1]}</div></div>
    <b class="mono" style="font-size:13px">${x[2]}</b></div>
   <div class="mark2">${['Won','Lost','Void','Cashed'].map(m=>`<button data-settle="${x[0]} · ${m.toLowerCase()}">${m}</button>`).join('')}</div></div>`).join('')}
  <div class="setrow"><div><div class="k">Nudge me</div><div class="dd">3 hours after the expected finish</div></div><button class="tog" data-tog aria-pressed="true"></button></div>
  <p class="note">Antepost bets are exempt. They sit under Long-term open until their expected date.</p>`,
 arb:()=>`<div class="hd"><b style="font-size:16px">Paired position</b><span class="pill g">Net +£2.10</span></div>
  <p class="note" style="margin:0 0 11px">Two bets held as one position. Reported net, and left out of win rate, streaks and average odds because it is not a pick.</p>
  ${[['bet365','Over 2.5 Goals','Back','2.05','£100.00','w'],['Smarkets','Under 2.5 Goals','Lay','2.02','£98.00 liability','l']].map(x=>`
   <div class="card t"><div class="hd" style="margin:0 0 6px"><b style="font-size:13.5px">${x[0]}</b><span class="pill">${x[2]}</span></div>
    <div class="dd">${x[1]} · ${x[3]} · ${x[4]}</div></div>`).join('')}
  <div class="card t"><div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Combined stake</div><b class="mono" style="font-size:13px">£198.00</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Commission on the lay</div><b class="mono" style="font-size:13px">−£0.94</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Net</div><b class="mono" style="font-size:13px;color:var(--pos)">+£2.10</b></div></div>
  <button class="btn ghost full sm" style="margin-top:10px" data-toast="Pair removed">Unpair these bets</button>`,
 /* 13 · THE WORKING, for the bet that is open. Built from the same fields
    the grader used, so it cannot describe a calculation that did not happen. */
 working:()=>{
  const b=bets[cur.betIdx||0], x=b[15]||{}, ew=x.ew, cm=x.comm;
  const stake=b[5], price=b[4], ret=b[6];
  const rows=[];
  if(ew){
   const {win,place}=ew;
   rows.push(['Total stake, split in two',`${amount(stake)} = ${amount(win.stake)} win + ${amount(place.stake)} place`]);
   rows.push(['Place terms',`${ew.frac} of the odds, places 1-${ew.places}`]);
   rows.push(['Place price',`1 + (${fmtOdds(win.price)} − 1) × ${ew.frac} = ${fmtOdds(place.price)}`]);
   rows.push(['Win part',`${win.out==='w'?'won':'lost'} · ${win.out==='w'?amount(win.ret):amount(0)} back`]);
   rows.push(['Place part',`${place.out==='w'?'won':'lost'} · ${amount(place.ret)} back`]);
   rows.push(['Returned',`${amount(win.ret)} + ${amount(place.ret)} = ${amount(ret)}`]);
  } else {
   rows.push(['Stake',amount(stake)]);
   rows.push(['Price',fmtOdds(price)]);
   rows.push(['Gross return',`${amount(stake)} × ${fmtOdds(price)} = ${amount(stake*price)}`]);
   if(cm){
    rows.push(['Gross profit',`${amount(stake*price)} − ${amount(stake)} = ${amount(cm.grossProfit)}`]);
    rows.push([`Commission at ${cm.rate.toFixed(1)}%`,`${amount(cm.grossProfit)} × ${(cm.rate/100).toFixed(3)} = −${amount(cm.charged)}`]);
   }
   rows.push(['Returned',amount(ret)]);
  }
  rows.push(['Profit or loss',b[7]]);
  return `<div class="hd"><b style="font-size:16px">How this settled</b>
   <span class="chip">${esc(b[9])}</span></div>
  <!-- The 90-minute rule is a football rule. Printing it over a horse race
       is the kind of detail that tells a racing punter this was not built
       for them. -->
  <p class="note" style="margin:0 0 11px">${esc(b[1])}${ew||/\d{2}:\d{2}$/.test(b[1])
   ?' · graded on the official result, after any stewards enquiry.'
   :' · graded on the 90 minute score. Extra time and penalties never count.'}</p>
  <ol class="working">${rows.map((r,i)=>`<li${i===rows.length-1?' class="last"':''}>
    <span>${esc(r[0])}</span><b class="mono">${r[1]}</b></li>`).join('')}</ol>
  <p class="note">Settled automatically 4 minutes after full time.
   We aim to settle within 10 minutes; if it takes longer than that you will
   see it here as waiting rather than as a result.</p>`},
 audit:()=>`<div class="hd"><b style="font-size:16px">Change history</b><span class="pill a">1 after result</span></div>
  ${[['19 Aug 19:12','Created','Read from a Telegram screenshot','',0],
     ['19 Aug 19:14','Tipster set','Own picks','',0],
     ['19 Aug 21:48','Settled','Won, +£80.00','Automatic',0],
     ['20 Aug 09:02','Odds changed','1.78 to 1.80','After the result was known',1]].map(x=>`
   <div class="setrow" style="align-items:flex-start"><div><div class="k" style="font-size:13.5px">${x[1]}</div>
    <div class="dd">${x[2]}${x[3]?' · '+x[3]:''}</div></div>
   <div style="text-align:right"><span class="lbl" style="white-space:nowrap">${x[0].split(' ')[1]}</span>
    ${x[4]?'<div class="pill a" style="margin-top:4px;font-size:10px;padding:3px 7px">Flagged</div>':''}</div></div>`).join('')}
  <p class="note">Edits made after a result is known are flagged. Groups set to slip-backed only can see the count.</p>`,
 menu:()=>`<div class="hd"><b style="font-size:16px">Menu</b></div>
  ${[['How it works','scroll','how'],['Pricing','scroll','price'],['FAQs','scroll','faq'],['See the demo','go','demo']].map(x=>`
   <button class="setrow" data-${x[1]}="${x[2]}"><div class="k">${x[0]}</div><span class="pill">›</span></button>`).join('')}
  <div style="display:flex;gap:9px;margin-top:14px">
   <button class="btn ghost full" data-go="login">Sign in</button>
   <button class="btn full" data-go="su1">Get started</button></div>`,
 share:()=>{const per=cur.sharePer||'M',mny=cur.shareMoney!==false;
  const kinds=cur.shareKinds&&cur.shareKinds.length?cur.shareKinds:['Summary'];
  const D={today:['Today','19 August',TDY,3,'+'+(TDY/25).toFixed(2)+'u'],
   W:['This week','13 to 19 August',WTD,12,'+'+(WTD/25).toFixed(2)+'u'],
   M:['This month','August 2026',MTD,96,'+'+(MTD/25).toFixed(2)+'u'],
   Y:['This year','2026 so far',3171,412,'+126.84u'],
   All:['All time','Since 2 May 2026',3171,412,'+126.84u']}[per];
  return `<div class="hd"><b style="font-size:16px">Share</b></div>
  <label class="flabel">Period</label>
  <div class="chips" style="margin-top:6px">${[['today','Day'],['W','Week'],['M','Month'],['Y','Year'],['All','All time']].map(x=>`
   <button class="chip" aria-current="${per===x[0]}" data-shareper="${x[0]}">${x[1]}</button>`).join('')}</div>
  <label class="flabel">What to include</label>
  <div class="chips" style="margin-top:6px">${['Summary','Calendar','Curve'].map(x=>`
   <button class="chip" aria-current="${kinds.includes(x)}" data-sharekind="${x}">${kinds.includes(x)?'✓ ':''}${x}</button>`).join('')}</div>
  <p class="note" style="margin:6px 0 0">Pick as many as you like. They stack into one image.</p>
  <div class="sharecard">
   <div class="shd"><span class="sbrand">${MARK}<b>Slipp<em>ery</em></b></span><span class="sper">${D[1]}</span></div>
   <div class="sbig">${mny?money(D[2]):D[4]}</div>
   <div class="ssub">${D[0]} · ${D[3]} bets${mny?' · '+D[4]:''}</div>
   ${kinds.includes('Summary')?`<div class="sgrid">${[['Won','52'],['Lost','41'],['Void','3'],['ROI','+38.2%']].map(x=>`
     <div class="sstat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div>`:''}
   ${kinds.includes('Calendar')?`<div class="sblock"><div class="cal" data-cal="month"></div></div>`:''}
   ${kinds.includes('Curve')?`<div class="sblock">${lineChart(CURVE,'a')}</div>`:''}
   <div class="sfoot">slippery.app</div></div>
  <div class="setrow"><div><div class="k">Include the money</div><div class="dd">Off shares units only</div></div>
   <button class="tog" aria-pressed="${mny}" data-sharemoney></button></div>
  <div style="display:flex;gap:9px;margin-top:10px"><button class="btn full sm" data-toast="Image saved">Save image</button>
   <button class="btn ghost full sm" data-toast="Copied to clipboard">Copy</button></div>`},
 calc:()=>`<div class="hd"><b style="font-size:16px">Calculators</b><span class="pill">Free</span></div>
  <div style="margin-bottom:12px">${segHTML(['Rule 4','Each way','Dutching','Acca'],'Rule 4',x=>`data-calctab="${x}"`,'full')}</div>
  <div id="calcBody">${SH.calcPane(cur.calcTab||'Rule 4')}</div>`,
 calcPane:(t)=>{
  if(t==='Each way')return `<label class="flabel">Stake each way</label><input class="field mono" value="10.00" data-ci>
   <label class="flabel">Odds</label><input class="field mono" value="8.00" data-ci>
   <label class="flabel">Place terms</label><div style="margin-top:6px">${segHTML(['1/4','1/5','1/2'],'1/5',null,'full')}</div>
   <div class="card t" style="margin-top:12px">${[['Total outlay','£20.00'],['Returns if it wins','£94.00'],['Returns if it places','£24.00'],['Profit if it wins','£74.00'],['Profit if it places','£4.00']].map(r=>`
    <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">${r[0]}</div><b class="mono" style="font-size:13px">${r[1]}</b></div>`).join('')}</div>`;
  if(t==='Dutching')return `<p class="note" style="margin:0 0 10px">Stake split so every outcome returns the same.</p>
   <label class="flabel">Total stake</label><input class="field mono" value="100.00" data-ci>
   ${[['Selection A','3.00','£38.30'],['Selection B','4.00','£28.72'],['Selection C','5.00','£22.98']].map(r=>`
    <div class="setrow"><div><div class="k" style="font-size:13.5px">${r[0]}</div><div class="dd mono">${r[1]}</div></div><b class="mono">${r[2]}</b></div>`).join('')}
   <div class="card t" style="margin-top:10px"><div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Return whichever wins</div><b class="mono" style="font-size:13px">£114.90</b></div>
    <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Profit</div><b class="mono" style="font-size:13px;color:var(--pos)">+£14.90</b></div></div>`;
  if(t==='Acca')return `<label class="flabel">Stake</label><input class="field mono" value="10.00" data-ci>
   ${['2.00','1.80','2.50','1.60'].map((o,i)=>`<div class="setrow"><div class="k" style="font-size:13.5px">Leg ${i+1}</div><b class="mono">${o}</b></div>`).join('')}
   <div class="card t" style="margin-top:10px">${[['Combined odds','14.40'],['Returns','£144.00'],['Profit','+£134.00']].map(r=>`
    <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">${r[0]}</div><b class="mono" style="font-size:13px">${r[1]}</b></div>`).join('')}</div>
   <p class="note">A void leg drops out and the rest reprice. A leg on the same fixture does not.</p>`;
  return `<p class="note" style="margin:0 0 10px">When a runner is withdrawn, winnings are cut by a deduction based on its price.</p>
   <label class="flabel">Your odds</label><input class="field mono" value="5.00" data-ci>
   <label class="flabel">Stake</label><input class="field mono" value="20.00" data-ci>
   <label class="flabel">Withdrawn runner's price</label><input class="field mono" value="3.00" data-ci>
   <div class="card t" style="margin-top:12px">${[['Deduction','30p in the pound'],['Winnings before','£80.00'],['Winnings after','£56.00'],['Total returned','£76.00']].map(r=>`
    <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">${r[0]}</div><b class="mono" style="font-size:13px">${r[1]}</b></div>`).join('')}</div>
   <p class="note">Applied to winnings only, never to your stake.</p>`},
 tags:()=>`<div class="hd"><b style="font-size:16px">Tags</b><button class="chip" data-toast="Tag created">+ New</button></div>
  <p class="note" style="margin:0 0 10px">Your own labels for why you took a bet. The market field cannot capture this.</p>
  ${[['Team news edge',34,'+£268'],['Live in-play',21,'+£142'],['Tipster fade',12,'+£88'],['Chasing',9,'−£174'],['Arb leg',6,'+£11']].map(t=>`
   <div class="setrow"><div><div class="k" style="font-size:13.5px">${t[0]}</div><div class="dd">${t[1]} bets</div></div>
    <div style="display:flex;gap:8px;align-items:center"><b class="mono" style="font-size:13px;color:var(--${t[2].startsWith('−')?'neg':'pos'})">${t[2]}</b>
     <button class="pill" style="padding:4px 9px;font-size:11px" data-toast="Rename ${t[0]}">Edit</button></div></div>`).join('')}
  <p class="note">Chasing is costing you £174. That is the sort of thing a tag finds and a market field never will.</p>`,
 wrong:()=>`<div class="hd"><b style="font-size:16px">This figure looks wrong</b></div>
  <p class="note" style="margin:0 0 11px">Tell us which number and we will check the bets behind it. Faster than describing it from scratch.</p>
  <div class="card t"><div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Card</div><b style="font-size:13px">Staking discipline</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Period</div><b style="font-size:13px">This month</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Account</div><b class="mono" style="font-size:13px">@edgemargin60</b></div></div>
  <label class="flabel">What looks off</label><textarea class="field" rows="3" placeholder="The average stake seems too high"></textarea>
  <button class="btn full" style="margin-top:11px" data-toast="Sent with the figures attached">Send</button>`,
 weekly:()=>`<div class="hd"><b style="font-size:16px">Weekly summary</b><span class="pill g">On</span></div>
  <p class="note" style="margin:0 0 11px">Sunday, 8pm. What it looks like:</p>
  <div class="wkcard">
   <div class="wkhd"><span class="lbl">Your week · 13 to 19 August</span><span class="pill g">+11.4u</span></div>
   <div class="wknet">+${sym()}${WTD.toFixed(2)}</div>
   <div class="wkgrid">${[['Bets','19','t2'],['Won','8','pos'],['Lost','11','neg'],['ROI','+8.4%','pos']].map(x=>`
    <div class="wkstat"><span>${x[0]}</span><b class="${x[2]}">${x[1]}</b></div>`).join('')}</div>
   <div class="wkbars">${[['Mon',18],['Tue',-9],['Wed',34],['Thu',6],['Fri',-31],['Sat',96],['Sun',12]].map(d=>`
    <div class="wkbar"><i class="${d[1]>0?'p':'n'}" style="--h:${Math.min(100,Math.abs(d[1]))}%"></i><span>${d[0][0]}</span></div>`).join('')}</div>
   <p class="wkfoot">Best day Saturday, +£96. Your average stake was £34 against a £25 unit.</p></div>
  <div class="setrow" style="margin-top:10px"><div class="k">Send it weekly</div><button class="tog" data-tog aria-pressed="true"></button></div>
  <div class="setrow"><div><div class="k">Skip weeks with no bets</div><div class="dd">No email if nothing happened</div></div><button class="tog" data-tog aria-pressed="true"></button></div>`,
 weeklyOld:()=>`<div class="hd"><b style="font-size:16px">Weekly summary</b><span class="pill g">On</span></div>
  <p class="note" style="margin:0 0 11px">Sunday, 8pm. What it looks like:</p>
  <div class="card t" style="background:var(--bg)">
   <div class="lbl" style="margin-bottom:7px">Your week, 13 to 19 August</div>
   <div class="mono" style="font-size:24px;font-weight:700;color:var(--pos);letter-spacing:-.03em">+${sym()}${WTD.toFixed(2)}</div>
   <div class="row" style="font-size:11.5px;margin-top:7px"><span>19 bets</span><span>W 8 · L 11</span><span>+11.4u</span></div>
   <div class="callegend" style="justify-content:flex-start;margin-top:10px"><span>Best day <b class="mono" style="color:var(--pos)">Sat +£96</b></span>
    <span>Worst <b class="mono" style="color:var(--neg)">Fri −£31</b></span></div>
   <p class="note" style="margin-top:9px">Your average stake was £34 against a £25 unit.</p></div>
  <div class="setrow" style="margin-top:8px"><div class="k">Send it weekly</div><button class="tog" data-tog aria-pressed="true"></button></div>
  <div class="setrow"><div><div class="k">Skip weeks with no bets</div><div class="dd">No email if nothing happened</div></div><button class="tog" data-tog aria-pressed="true"></button></div>`,
 challenge:()=>{const g=cur.chalGroup||'All';
  const ALLC=[
   ['Ultras','First to +20u','Ends in 9 days',[['BlueSlip','+18.2u',91],['You','+6.3u',32],['KerryEdge','+11.7u',59]],'2nd of 12'],
   ['Ultras','Best ROI over 50 bets','Ends in 23 days',[['KerryEdge','+9.1%',74],['You','+7.8%',63],['FiveFolds','+4.4%',36]],'2nd of 12'],
   ['Sunday League','Most profitable week','Ends in 4 days',[['You','+£212',88],['NapKing','+£140',58],['DoubleDrop','+£96',40]],'1st of 7']];
  const list=g==='All'?ALLC:ALLC.filter(c=>c[0]===g);
  const HOF=[['Ultras','Longest winning streak','BlueSlip','July'],['Ultras','First to +20u','NapKing','May'],
   ['Sunday League','Most profitable week','You','June']];
  const hof=g==='All'?HOF:HOF.filter(h=>h[0]===g);
  return `<div class="hd"><b style="font-size:16px">Challenges</b><span class="pill a">${list.length} running</span></div>
  <div class="chips" style="margin-bottom:12px">${['All','Ultras','Sunday League'].map(x=>`
   <button class="chip" aria-current="${g===x}" data-chalgroup="${x}">${x==='All'?'All groups':x}</button>`).join('')}</div>
  <div style="max-width:340px;margin-bottom:12px">${segHTML(['Running','Hall of fame'],cur.chalTab||'Running',null,'full')}</div>
  ${(cur.chalTab||'Running')==='Running'?
   (list.length?list.map(c=>`<div class="chal">
    <div class="chalhd"><div><b>${c[1]}</b>${g==='All'?`<div class="dd" style="font-size:11px;color:var(--t3)">${c[0]}</div>`:''}</div>
     <span class="pill">${c[2]}</span></div>
    ${c[3].map((r,i)=>`<div class="chalrow"><span class="rk ${i===0?'gold':''}">${i+1}</span>
      <span class="nm"${r[0]==='You'?' style="color:var(--s);font-weight:600"':''}>${r[0]}</span>
      <span class="chalbar"><i style="width:${r[2]}%"></i></span><b class="mono">${r[1]}</b></div>`).join('')}
    <div class="chalfoot">You are ${c[4]}</div></div>`).join('')
    :`<p class="note">No challenges running in this group yet.</p>`)
   :(hof.length?hof.map(h=>`<div class="setrow"><div><div class="k">${h[1]}</div>
     <div class="dd">${g==='All'?h[0]+' · ':''}${h[3]}</div></div>
     <span class="pill ${h[2]==='You'?'g':''}">${h[2]}</span></div>`).join('')
    :`<p class="note">Nothing finished in this group yet.</p>`)}
  <div class="brline" style="margin-top:12px"><span>Entered <b>6</b></span><span>Won <b>1</b></span><span>Top three <b>4</b></span></div>
  <button class="btn ghost full sm" style="margin-top:11px" data-sheet="newchal">Set a challenge</button>`},
 newchal:()=>`<div class="hd"><b style="font-size:16px">Set a challenge</b><span class="pill">Admin</span></div>
  <label class="flabel">What are you racing for</label>
  <div class="chips" style="margin-top:6px">${['First to +20u','Best ROI','Most profitable week','Longest streak'].map((x,i)=>`
   <button class="chip" aria-current="${!i}" data-pickone>${x}</button>`).join('')}</div>
  <label class="flabel">How long</label>
  <div class="chips" style="margin-top:6px">${['1 week','2 weeks','A month','A season'].map((x,i)=>`
   <button class="chip" aria-current="${i===2}" data-pickone>${x}</button>`).join('')}</div>
  <div class="setrow" style="margin-top:10px"><div><div class="k">Minimum bets to qualify</div><div class="dd">Stops a single lucky bet winning it</div></div>
   <span class="pill">25</span></div>
  <p class="note">You can run several at once. Finished ones move to the hall of fame.</p>
  <button class="btn full" style="margin-top:12px" data-toast="Challenge set">Start it</button>`,
 slipimg:()=>`<div class="hd"><b style="font-size:16px">Original slip</b><span class="pill">19 Aug 19:12</span></div>
  <div class="card t" style="background:var(--bg)">
   <div class="slip" style="border-style:solid;margin:0"><div class="hd" style="margin-bottom:6px"><b style="font-size:12px">4 legs · bet365</b><span class="tag">AS RECEIVED</span></div>
   ${[['Under 4 Cards','Total cards'],['Under 4.5 Shots on Target','Cremonese'],['Under 11.5 Shots','Cremonese'],['Juventus to win','Match result']].map(l=>`<div class="leg" style="padding:6px 0"><div class="dotl" style="width:11px;height:11px"></div><div><div class="nm" style="font-size:11px">${l[0]}</div><div class="sb" style="font-size:9.5px">${l[1]}</div></div></div>`).join('')}
   <div class="slipfoot" style="font-size:11px"><div>Stake<b class="mono" style="font-size:13px">£100.00</b></div>
    <div style="text-align:right">Returns<b class="mono" style="font-size:13px">£180.00</b></div></div></div></div>
  <p class="note">Kept 90 days so you have evidence if a bookmaker disputes a settlement. Deleted after that, or now from Settings.</p>
  <button class="btn ghost full sm" style="margin-top:10px" data-toast="Downloaded">Download image</button>`,
 golden:()=>`<div class="hd"><b style="font-size:16px">Reader accuracy</b><span class="pill a">Owner</span></div>
  <p class="note" style="margin:0 0 11px">A reference set of real slips with the correct answer typed in by hand. Every reader change is scored against it before it ships.</p>
  <div class="g3" style="margin-bottom:11px">${[['Slips','0'],['Bookmakers','0 of 26'],['Accuracy','—']].map(x=>`<div class="stat"><div class="k">${x[0]}</div><div class="v mono">${x[1]}</div></div>`).join('')}</div>
  <div class="empty" style="padding:16px 10px"><div class="ic">📷</div><b>No reference slips yet</b>
   <p>Import 50 to 100 real screenshots across the bookmakers you use. Aim for at least two per bookmaker, and include the awkward ones: each way, cash out, void, and several bets in one image.</p>
   <button class="btn sm" data-toast="Choose screenshots to import">Import reference slips</button></div>
  <div class="lbl" style="margin:14px 0 6px">What gets scored</div>
  ${[['Bookmaker detected'],['Stake'],['Odds'],['Every selection'],['Bet shape, single or multi-leg'],['Result where the slip shows one'],['Several bets split correctly']].map(x=>`<div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">${x[0]}</div><span class="pill">—</span></div>`).join('')}
  <p class="note">Until this set exists, bet shape detection, multi settlement and profile verification are all unmeasurable.</p>`,
 lsort:()=>`<div class="hd"><b style="font-size:16px">Sort by</b></div>
  ${['Newest','Oldest','Biggest win','Biggest loss','Highest odds','Largest stake'].map((o,i)=>`
   <button class="setrow" data-toast="Sorted by ${o.toLowerCase()}"><div class="k">${o}</div>${!i?'<span class="pill g">✓</span>':''}</button>`).join('')}`,
 lsort:()=>`<div class="hd"><b style="font-size:16px">Sort by</b></div>
  ${['Newest','Oldest','Biggest win','Biggest loss','Highest odds','Largest stake'].map((o,i)=>`
   <button class="setrow" data-toast="Sorted by ${o.toLowerCase()}"><div class="k">${o}</div>${!i?'<span class="pill g">✓</span>':''}</button>`).join('')}`,
 filters:()=>`<div class="hd"><b style="font-size:16px">Filter and sort</b><button class="chip" data-toast="Filters cleared">Clear</button></div>
  <button class="setrow" data-bulk data-close><div><div class="k">Select several bets</div><div class="dd">Tag, move or delete them together</div></div><span class="pill">Start ›</span></button>
  ${[['Sport',['All','Football','Tennis','Horse racing']],['Bookmaker',['All','bet365','Sky Bet','Coral','Betfred']],
     ['Tipster',['All','Own picks','BlueSlip','KerryEdge']],['Odds',['All','Under 2.00','2.00 – 3.00','Over 3.00']],
     ['Bet shape',['All','Single','Multi-leg']]].map(f=>`<label class="flabel">${f[0]}</label>
   <div class="chips" style="margin-top:5px">${f[1].map((x,i)=>`<button class="chip" aria-current="${!i}" data-pickone>${x}</button>`).join('')}</div>`).join('')}
  <button class="btn full" style="margin-top:12px" data-toast="Filters applied">Apply</button>`,
 bankroll:()=>{
  const st=startingBankroll(),bal=balance(),adj=adjustmentsTotal(),g=growthPct();
  return `<div class="hd"><b style="font-size:16px">Bankroll</b></div>
  <p class="note" style="margin:0 0 11px">Two numbers, and they are not the same one.
   <b>Starting bankroll</b> is what you set. <b>Balance</b> is what you hold now, worked out
   from it. Growth is measured against the first; exposure against the second.</p>
  <label class="flabel" for="brstart">Starting bankroll</label>
  <input class="field mono" id="brstart" inputmode="decimal" autocomplete="off" value="${(st/1).toFixed(2)}">
  <div class="card t" style="margin-top:12px">
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Starting bankroll</div>
    <b class="mono" style="font-size:13px">${amount(st)}</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">All-time net</div>
    <b class="mono" style="font-size:13px;color:var(--${PERIODS.All.net<0?'neg':'pos'})">${money(PERIODS.All.net)}</b></div>
   ${adj?`<div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Deposits and withdrawals</div>
    <b class="mono" style="font-size:13px">${money(adj)}</b></div>`:''}
   <div class="setrow" style="padding:8px 0;border-top:1px solid var(--line)">
    <div class="k" style="font-size:13px">Balance</div>
    <b class="mono" style="font-size:13px">${amount(bal)}</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Growth</div>
    <b class="mono" style="font-size:13px;color:var(--${(g||0)<0?'neg':'pos'})">${g==null?'—':(g>0?'+':'')+g.toFixed(1)+'%'}</b></div></div>
  <button class="btn full" style="margin-top:12px" data-toast="Starting bankroll saved">Save</button>

  <!-- 57 · Without these, anyone who tops up has a balance that is
       permanently wrong, and "% of bankroll" is measured against a figure
       that stopped being true the day they added to it. -->
  <div class="setrow" style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
   <div><div class="k">Deposits and withdrawals</div>
    <div class="dd">Money in or out that is not a bet. Keeps your balance honest.</div></div>
   <button class="chip" data-sheet="adjust">Add</button></div>
  ${BR_ADJUSTMENTS.length?BR_ADJUSTMENTS.map(a=>`<div class="setrow" style="padding:7px 0">
    <div><div class="k" style="font-size:13px">${esc(a.note||(a.amount>0?'Deposit':'Withdrawal'))}</div>
     <div class="dd">${esc(a.when||'')}</div></div>
    <b class="mono" style="font-size:13px;color:var(--${a.amount<0?'neg':'pos'})">${money(a.amount)}</b></div>`).join('')
   :`<p class="note" style="margin-top:8px">None recorded. Your balance is your starting bankroll plus results.</p>`}

  <div class="setrow" style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
   <div><div class="k">Exposure follows your balance</div>
    <div class="dd">What is at risk, measured against what you actually hold rather than what you started with</div></div>
   <button class="tog" data-adapt aria-pressed="${cur.adaptBr!==false}"></button></div>
  <p class="note" style="margin-top:8px">${cur.adaptBr!==false
    ?'Exposure is measured against your balance, '+amount(bal)+'.'
    :'Exposure is measured against your starting bankroll only, '+amount(st)+'.'}</p>
  <button class="btn ghost full sm" style="margin-top:11px" data-resetbr>Reset to starting bankroll</button>`},
 adjust:()=>`<div class="hd"><b style="font-size:16px">Money in or out</b></div>
  <p class="note" style="margin:0 0 11px">A deposit or a withdrawal that is not a bet. It moves your
   balance and never your net, because it is not a result.</p>
  <label class="flabel" for="adjamt">Amount</label>
  <input class="field mono" id="adjamt" inputmode="decimal" autocomplete="off" placeholder="0.00">
  <!-- segHTML's third argument is a function of the item, not an attribute
       name. Passing a string threw "a is not a function" and the sheet failed
       to open at all — and the button sweep missed it, because this sheet is
       only reachable from inside another one. -->
  <div style="margin:11px 0">${segHTML(['Deposit','Withdrawal'],cur.adjKind||'Deposit',
    x=>`data-adjkind="${x}"`)}</div>
  <label class="flabel" for="adjnote">Note</label>
  <input class="field" id="adjnote" placeholder="Optional">
  <button class="btn full" style="margin-top:12px" data-toast="Recorded">Record it</button>`,
 /* 17 · SEVEN SWITCHES THAT PERSISTED NOTHING. Every one was the generic
    `data-tog`, which flips aria-pressed and forgets — so the product asked
    what somebody wanted and then did not record it. These are the spec's six,
    they carry their own action, and they save.

    Off by default except the first two: a bet finishing is the whole point of
    the bot, and being overtaken is the only league event that is
    time-sensitive. */
 notifs:()=>`<div class="hd"><b style="font-size:16px">Notifications</b></div>
  ${NOTIFS.map(n=>`
   <div class="setrow"><div><div class="k" style="font-size:13.5px">${esc(n[1])}</div>
    <div class="dd">${esc(n[2])}</div></div>
   <button class="tog" data-notiftog="${n[0]}"
    aria-label="${esc(n[1])}" aria-pressed="${wantsNotif(n[0])}"></button></div>`).join('')}
  <div class="setrow"><div><div class="k" style="font-size:13.5px">Trial and billing</div>
   <div class="dd">Payment notices and receipts</div></div>
   <span class="pill">Always</span></div>
  <p class="note">Billing notices cannot be turned off. They are part of the contract.</p>
  <p class="note">Nothing is sent between 22:00 and 08:00; it waits for the morning.
   Slippery never messages you about <b>not</b> having bet, and never frames anything
   as losing your place.</p>`,
 security:()=>`<div class="hd"><b style="font-size:16px">Security</b></div>
  <button class="setrow" data-toast="Password change email sent"><div><div class="k">Change password</div><div class="dd">We email a confirmation link</div></div><span class="pill">Change</span></button>
  <div class="setrow"><div><div class="k">Two step sign in</div><div class="dd">A six digit code by email on a new device</div></div><button class="tog" data-tog aria-pressed="false"></button></div>
  <div class="lbl" style="margin:14px 0 6px">Signed in devices</div>
  ${[['iPhone 15 · Safari','London · now',1],['MacBook · Chrome','London · 2 hours ago',0],['Android · Chrome','Manchester · 6 Aug',0]].map(d=>`
   <div class="setrow"><div><div class="k" style="font-size:13.5px">${d[0]}</div><div class="dd">${d[1]}${d[2]?' · this device':''}</div></div>
   ${d[2]?'<span class="pill g">Current</span>':`<button class="pill r" data-toast="Signed out">Sign out</button>`}</div>`).join('')}
  <button class="btn ghost full sm" style="margin-top:12px" data-toast="Signed out everywhere else">Sign out everywhere else</button>`,
 markets:()=>`<div class="hd"><b style="font-size:16px">Market groups</b><span class="pill">${MARKETGROUPS.length}</span></div>
  <div class="setrow"><div><div class="k">Consolidate markets</div><div class="dd">Treat equivalent markets as one when reporting</div></div><button class="tog" data-tog aria-pressed="true"></button></div>
  <p class="note" style="margin:0 0 8px">Bookmakers name the same bet many ways. These groups fold them together so By market means something.</p>
  <div class="scrollbox" style="max-height:340px">
  ${MARKETGROUPS.map(g=>`<details class="disc"><summary><span style="font-size:13.5px">${g[0]}</span>
   <span style="display:flex;gap:8px;align-items:center"><span class="pill" style="padding:3px 9px;font-size:11px">${g[1].length}</span><span class="caret">▾</span></span></summary>
   <div style="padding:2px 0 8px 10px">${g[1].map(v=>`<div class="setrow" style="padding:7px 0;border-top:0"><div class="k" style="font-size:12.5px;color:var(--t2)">${v}</div>
    <button class="pill r" style="padding:3px 8px;font-size:10.5px" data-toast="Removed from ${g[0]}">Remove</button></div>`).join('')}
   <button class="btn ghost full sm" style="margin-top:4px" data-toast="Add a market to ${g[0]}">+ Add a market</button></div></details>`).join('')}</div>
  <button class="btn ghost full sm" style="margin-top:11px" data-toast="New group created">+ New group</button>`,
 markets:()=>`<div class="hd"><b style="font-size:16px">Market groups</b><span class="pill">${MARKETGROUPS.length}</span></div>
  <div class="setrow"><div><div class="k">Consolidate markets</div><div class="dd">Treat equivalent markets as one when reporting</div></div><button class="tog" data-tog aria-pressed="true"></button></div>
  <p class="note" style="margin:0 0 8px">Bookmakers name the same bet many ways. These groups fold them together so By market means something.</p>
  <div class="scrollbox" style="max-height:330px">
  ${MARKETGROUPS.map(g=>`<details class="disc"><summary><span style="font-size:13.5px">${g[0]}</span>
   <span style="display:flex;gap:8px;align-items:center"><span class="pill" style="padding:3px 9px;font-size:11px">${g[1].length}</span><span class="caret">▾</span></span></summary>
   <div style="padding:2px 0 8px 10px">${g[1].map(v=>`<div class="setrow" style="padding:7px 0;border-top:0"><div class="k" style="font-size:12.5px;color:var(--t2)">${v}</div>
    <button class="pill r" style="padding:3px 8px;font-size:10.5px" data-toast="Removed from ${g[0]}">Remove</button></div>`).join('')}
   <button class="btn ghost full sm" style="margin-top:4px" data-toast="Add a market">+ Add a market</button></div></details>`).join('')}</div>
  <button class="btn ghost full sm" style="margin-top:11px" data-toast="New group created">+ New group</button>`,
 rules:()=>`<div class="hd"><b style="font-size:16px">Reading rules</b></div>
  ${[['Several bets in one image','Split them',''],['Unreadable bookmaker','Ask me',''],['Unreadable odds','Ask me',''],
     ['Default tipster','Own picks','Applied to bot slips'],['Each way','Two bets',''],['Kick off times','Europe/London','']].map(r=>`
   <button class="setrow" data-toast="${r[0]}"><div><div class="k" style="font-size:13.5px">${r[0]}</div>${r[2]?`<div class="dd">${r[2]}</div>`:''}</div><span class="pill">${r[1]} ▾</span></button>`).join('')}`,
 sources:()=>`<div class="hd"><b style="font-size:16px">Where bets come from</b></div>
  ${[['Bookmakers','books','9 enabled','Which books show in dropdowns and breakdowns'],
     ['Tipsters','tipsters','4','Who you follow, and their unit sizes'],
     ['Sports','sports','4','Tunes the reader and the breakdowns']].map(x=>`
   <button class="setrow" data-sheet="${x[1]}"><div><div class="k">${x[0]}</div><div class="dd">${x[3]}</div></div>
    <span class="pill">${x[2]} ›</span></button>`).join('')}`,
 books:()=>`<div class="hd"><b style="font-size:16px">Bookmakers</b><button class="chip" data-toast="Add a custom bookmaker">+ Add</button></div>
  ${BOOKS.map((c,ci)=>`<details class="disc" ${ci===0?'open':''}><summary><span style="font-size:13.5px">${c[0]}</span>
   <span style="display:flex;gap:8px;align-items:center"><span class="pill" style="padding:3px 9px;font-size:11px">${c[1].length}</span><span class="caret">▾</span></span></summary>
   ${c[1].slice(0,6).map((b,i)=>`<div class="setrow" style="padding:9px 0 9px 8px"><div class="k" style="font-size:13.5px">${b}</div>
    <div style="display:flex;gap:7px;align-items:center"><button class="tog" data-tog aria-pressed="${i<2}" style="transform:scale(.78)"></button>
    <button class="pill r" style="padding:4px 9px;font-size:11px" data-toast="${b} removed">Remove</button></div></div>`).join('')}</details>`).join('')}`,
 tipsters:()=>`<div class="hd"><b style="font-size:16px">Tipsters</b><button class="chip" data-sheet="tipsteredit">+ Add</button></div>
  ${[[1,'Own picks',62,'28-30-2-2','47%','+9.1%','£25','+£552'],[2,'BlueSlip',21,'11-9-1-0','55%','+12.4%','£50','+£404'],
     [3,'FiveFolds',4,'2-2-0-0','50%','+4.2%','£25','+£18'],[4,'KerryEdge',9,'3-6-0-0','33%','−9.8%','£10','−£61']].map(t=>`
   <button class="card t" style="width:100%" data-sheet="tipsteredit">
    <div class="hd" style="margin:0 0 7px"><div style="display:flex;gap:9px;align-items:center">
     <span class="mono ${posc(t[0])}" style="width:16px;text-align:center">${t[0]}</span><b style="font-size:14px">${t[1]}</b></div>
     <div style="display:flex;gap:8px;align-items:center"><b class="mono" style="color:var(--${t[7].startsWith('−')?'neg':'pos'})">${t[7]}</b>
      <span class="pill" style="padding:4px 9px;font-size:11px">Edit</span></div></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--t3)">
     <span>${t[2]} bets</span><span class="mono">${t[3]}</span><span>Win ${t[4]}</span>
     <span>ROI <b class="mono" style="color:var(--${t[5].startsWith('−')?'neg':'pos'})">${t[5]}</b></span>
     <span>Unit ${t[6]}</span></div></button>`).join('')}
  <p class="note">W-L-V-P is won, lost, void, pending. A tipster can have its own unit if you stake them differently.</p>`,
 tipsteredit:()=>`<div class="hd"><b style="font-size:16px">Edit tipster</b></div>
  <label class="flabel">Name</label><input class="field" autocomplete="off" value="BlueSlip">
  <label class="flabel">Their unit</label>
  <div class="chips" style="margin-top:6px">${['Use mine','£10','£25','£50','£100'].map((x,i)=>`<button class="chip" aria-current="${i===3}" data-pickone>${x}</button>`).join('')}</div>
  <p class="note" style="margin-top:2px">Overrides your own unit for their bets only, so their ROI is measured against what you actually stake on them.</p>
  <label class="flabel">Where they post</label><input class="field" autocomplete="off" placeholder="Telegram channel, X handle, or a note">
  <div class="setrow" style="margin-top:8px"><div><div class="k">Show in dropdowns</div><div class="dd">Hide old tipsters without deleting their record</div></div><button class="tog" data-tog aria-pressed="true"></button></div>
  <div class="setrow"><div><div class="k">Default for bot slips</div><div class="dd">Applied when a slip has no tipster</div></div><button class="tog" data-tog aria-pressed="false"></button></div>
  <div style="display:flex;gap:9px;margin-top:12px"><button class="btn full sm" data-toast="Tipster saved">Save</button>
   <button class="btn ghost full sm" data-toast="Merged">Merge into another</button></div>
  <button class="btn danger full sm" style="margin-top:9px" data-sheet="tipsterdel">Delete tipster</button>`,
 tipsterdel:()=>`<div class="hd"><b style="font-size:16px">Delete BlueSlip?</b></div>
  <p class="note" style="margin:0 0 14px">21 bets are attributed to them. Deleting the tipster does not delete the bets, they move to Own picks.</p>
  <button class="btn danger full" style="margin-bottom:9px" data-toast="Tipster deleted, 21 bets moved">Delete and move bets</button>
  <button class="btn ghost full" data-close>Cancel</button>`,
 sports:()=>`<div class="hd"><b style="font-size:16px">Sports</b><button class="chip" data-toast="Add a sport">+ Add</button></div>
  ${[['Football','214 bets','+£812'],['Tennis','41 bets','−£58'],['Horse racing','96 bets','+£262']].map(t=>`
   <button class="setrow" data-toast="${t[0]}"><div><div class="k" style="font-size:13.5px">${t[0]}</div><div class="dd">${t[1]}</div></div>
   <b class="mono" style="color:var(--${t[2].startsWith('−')?'neg':'pos'})">${t[2]}</b></button>`).join('')}`,
 tipsterpick:()=>`<div class="hd"><b style="font-size:16px">Tipster</b></div>
  ${['Own picks','BlueSlip','KerryEdge','FiveFolds','None'].map((t,i)=>`<button class="setrow" data-toast="${t}"><div class="k">${t}</div>${!i?'<span class="pill g">✓</span>':''}</button>`).join('')}`,
 addbook:()=>`<div class="hd"><b style="font-size:16px">Add a bookmaker</b></div>
  <p class="note" style="margin:0 0 12px">For anything not on the list, including shops and overseas books.</p>
  <label class="flabel">Name</label>
  <input class="field" autocomplete="off" spellcheck="false" placeholder="For example, Star Sports">
  <p class="note" style="margin:2px 0 12px">Checked against the ones you already have, so you do not end up with two.</p>
  <div class="setrow"><div><div class="k">It is an exchange</div><div class="dd">Betfair, Smarkets and the like</div></div>
   <button class="tog" data-exch aria-pressed="false"></button></div>
  <div id="commRow" hidden><label class="flabel">Commission on winnings</label>
   <div class="chips">${['2%','3%','5%','Custom'].map((x,i)=>`<button class="chip" aria-current="${i===0}" data-pickone>${x}</button>`).join('')}</div>
   <p class="note">Applied to net winnings only, never to your stake.</p></div>
  <button class="btn full" style="margin-top:14px" data-toast="Bookmaker added">Add it</button>`,
 bookpick:()=>`<div class="hd"><b style="font-size:16px">Bookmaker</b></div>
  ${['bet365','Sky Bet','Paddy Power','Ladbrokes','Coral','Betfred'].map((b,i)=>`<button class="setrow" data-toast="${b}"><div class="k">${b}</div>${!i?'<span class="pill g">✓</span>':''}</button>`).join('')}`,
 export:()=>`<div class="hd"><b style="font-size:16px">Export all bets</b></div>
  <label class="flabel">Format</label><div style="margin-top:6px">${segHTML(['CSV','JSON','PDF'],'CSV').replace('class="seg"','class="seg full"')}</div>
  <label class="flabel">Period</label><div style="margin-top:6px">${segHTML(['Month','Year','All','Custom'],'All').replace('class="seg"','class="seg full"')}</div>
  <div style="display:flex;gap:9px"><div style="flex:1"><label class="flabel">From</label><input class="field mono" value="01/01/2026"></div>
   <div style="flex:1"><label class="flabel">To</label><input class="field mono" value="19/08/2026"></div></div>
  <p class="note">PDF carries the Slippery mark and a verification reference.</p>
  <button class="btn full" style="margin-top:12px" data-toast="Downloading…">Download</button>`,
 fix:()=>`<div class="hd"><b style="font-size:16px">Fix problem bets</b><span class="pill a">7</span></div>
  ${[['Combined selections','4 bets look like several joined together'],['No fixture matched','2 bets'],['No sport','1 bet']].map(o=>`
   <button class="setrow" data-toast="${o[0]}"><div><div class="k">${o[0]}</div><div class="dd">${o[1]}</div></div><span class="caret" style="transform:rotate(-90deg)">▾</span></button>`).join('')}
  <p class="note">Each one previews before it changes anything.</p>`,
 support:()=>`<div class="hd"><b style="font-size:16px">Support</b></div>
  <p class="note" style="margin:0 0 13px">One inbox, read by a person.</p>
  <div class="card t" style="text-align:center"><div class="lbl">Email</div>
   <div class="mono" style="font-size:15px;margin:6px 0">slipperyapp@gmail.com</div></div>
  <button class="btn full" style="margin-bottom:9px" data-toast="Opening your mail app">Send an email</button>
  <button class="btn ghost full" data-toast="Copied">Copy address</button>`,
 changelog:()=>`<div class="hd"><b style="font-size:16px">Changelog</b></div>
  ${[['19 Aug','Target pace','The dashboard target shows where you should be by this point in the period.'],
     ['12 Aug','Cash out and void','Both settle properly and are excluded from win rate.'],
     ['4 Aug','Import review','Every imported row is shown and editable before it saves.'],
     ['28 Jul','Groups','Unit-based leaderboards, invite codes, admin controls.'],
     ['15 Jul','Telegram bot','Forward a slip and it lands in your ledger.']].map(c=>`
   <div class="setrow" style="align-items:flex-start"><div><div class="k" style="font-size:13.5px">${c[1]}</div>
    <div class="dd" style="margin-top:4px">${c[2]}</div></div><span class="lbl" style="white-space:nowrap">${c[0]}</span></div>`).join('')}`,
 legalDoc:(t)=>{const isT=(t==='terms'),D=isT?TERMSDOC:PRIVDOC;
  return `<div class="hd"><b style="font-size:16px">${isT?'Terms of use':'Privacy policy'}</b><span class="pill">v1.0</span></div>
  <p class="note" style="margin:0 0 10px">Last updated 19 August 2026. Slippery is operated from England and Wales.</p>
  <div class="scrollbox" style="max-height:420px">${D.map((sec,i)=>`
   <details class="disc" ${i===0?'open':''}><summary><span style="font-size:13.5px">${i+1}. ${sec[0]}</span><span class="caret">▾</span></summary>
    <div style="padding:2px 0 10px">${sec[1].map(pp=>`<p class="note" style="color:var(--t2);margin:0 0 8px">${pp}</p>`).join('')}</div></details>`).join('')}</div>
  <div class="ackbar"><p class="note ackhint" style="margin:0 0 9px">Scroll to the end, then confirm.</p>
   <button class="btn full sm" data-ack="${isT?'terms':'privacypol'}" disabled aria-disabled="true">I acknowledge</button></div>
  <button class="btn ghost full sm" style="margin-top:11px" data-toast="Copy sent to your email">Email me a copy</button>`},
 terms:()=>SH.legalDoc('terms'),
 privacypol:()=>SH.legalDoc('privacypol'),
 betdetail:()=>{const b=bets[cur.betIdx||0],o=outc(b[0]),x=b[15]||{},ew=x.ew,cm=x.comm;
  /* 55/56 · Both of these are lines the sheet could not previously show, and
     both of them change the number a person reads. The each-way parts explain
     why a bet that lost its win part is not down its whole stake; the
     commission line explains why an exchange return is not stake x price.
     Netting either silently makes the price look wrong against the slip,
     which is the fastest way to lose trust in the reader. */
  const rows=[['Selection',b[2]],['Market',b[3]],['Bookmaker',b[9]],['Odds',fmtOdds(b[4])],
   ['Stake',amount(b[5])]];
  if(cm)rows.push(['Gross profit',amount(cm.grossProfit)],
   ['Commission','−'+amount(cm.charged)+'  '+cm.rate.toFixed(1)+'%']);
  rows.push(['Returned',amount(b[6])],['Profit or loss',b[7]],['Units',b[8]],
   ['Tipster',b[10]],['Placed',b[12]],['Source',b[11]],
   ['Each way',ew?'Yes · '+ew.frac+', places 1-'+ew.places:'No'],
   ['Rule 4 deduction','None'],['Free bet','No']);
  return `<div class="hd"><b style="font-size:16px">${esc(b[1])}</b><span class="chip ${b[0]}">${o.word}</span></div>
  ${ew?`<div class="card t ewparts"><div class="lbl" style="margin-bottom:6px">Each way · two parts, one bet</div>
   ${[['Win part',ew.win],['Place part',ew.place]].map(([lab,pt])=>`
    <div class="ewleg"><span class="mk ${pt.out}" aria-hidden="true">${outc(pt.out).mark}</span>
     <span class="ewn">${lab}<span class="ewo"> ${amount(pt.stake)} at ${fmtOdds(pt.price)}</span></span>
     <b class="mono" style="color:var(--${pt.out==='w'?'pos':'neg'})">${pt.out==='w'
       ?'+'+amount(pt.ret-pt.stake):'−'+amount(pt.stake)}</b></div>`).join('')}
   <p class="note" style="margin-top:8px">Each part settles on its own, which is how Rule 4,
    dead heats and a non-runner land on the right half. The stake above is the total,
    ${amount(b[5])}, not one half of it.</p></div>`:''}
  <div class="card t">${rows.map(r=>`
   <div class="setrow"><div class="k" style="font-size:13.5px">${r[0]}</div><b class="mono" style="font-size:13.5px">${r[1]}</b></div>`).join('')}</div>
  ${b[14]?`<div class="card t"><div class="lbl" style="margin-bottom:6px">Legs</div>
   ${b[14].map(l=>`<div class="setrow" style="padding:9px 0"><div><div class="k" style="font-size:13px">${l[0]}</div><div class="dd">${l[1]}</div></div>
    <span class="pill ${l[2]==='w'?'g':'r'}">${l[2]==='w'?'✓':'✕'}</span></div>`).join('')}</div>`:''}
  <button class="setrow" data-sheet="arb"><div><div class="k">Paired position</div><div class="dd">Held with another bet as one arb</div></div><span class="pill g">Net +£2.10 ›</span></button>
  <!-- 13 · SHOW THE WORKING. One tap on any settled bet and the arithmetic
       is there. Rule 4, dead heats, non-runners, each-way place terms and
       commission are unglamorous and are exactly why people abandon
       trackers — and a tracker that shows how it got a number is trusted on
       every other number it prints. -->
  <button class="setrow" data-sheet="working"><div><div class="k">How this settled</div><div class="dd">The arithmetic, step by step</div></div><span class="pill">Show ›</span></button>
  <button class="setrow" data-sheet="audit"><div><div class="k">Change history</div><div class="dd">Every edit, and which came after the result</div></div><span class="pill a">1 late ›</span></button>
  ${b[11]!=='Screenshot'&&b[11]!=='Telegram'?'':`<button class="setrow" data-sheet="slipimg"><div><div class="k">Original slip</div><div class="dd">The image it was read from, kept 90 days</div></div><span class="pill">View ›</span></button>`}
  <div class="card t"><div class="lbl" style="margin-bottom:6px">Tags</div>
   <div class="chips" style="margin:0"><button class="chip" aria-current="true" data-multi>Team news edge</button>
    <button class="chip" data-multi>Live in-play</button><button class="chip" data-sheet="tags">+ Add</button></div></div>
  <div class="card t"><div class="lbl" style="margin-bottom:6px">Note</div>
   <textarea class="field" rows="2" style="margin:0" placeholder="Why you took it, and what you would do again"></textarea></div>
  <div style="display:flex;gap:9px"><button class="btn ghost full sm" data-sheet="editbet">Edit</button>
   <button class="btn danger full sm" data-toast="Bet deleted">Delete</button></div>`},
 editbet:()=>`<div class="hd"><b style="font-size:16px">Edit bet</b></div>
  <label class="flabel">Event</label><input class="field" autocomplete="off" value="Juventus v Cremonese">
  <div style="display:flex;gap:9px"><div style="flex:1"><label class="flabel">Stake</label><input class="field mono" value="100.00"></div>
   <div style="flex:1"><label class="flabel">Odds</label><input class="field mono" value="1.80"></div></div>
  <label class="flabel">Bookmaker</label><button class="field" style="text-align:left;display:flex;justify-content:space-between" data-sheet="bookpick">bet365 <span class="caret">▾</span></button>
  <label class="flabel">Tipster</label><button class="field" style="text-align:left;display:flex;justify-content:space-between" data-sheet="tipsterpick">Own picks <span class="caret">▾</span></button>
  <label class="flabel">Placed on</label><button class="field" style="text-align:left;display:flex;justify-content:space-between" data-toast="Date picker">19 Aug 2026 <span class="caret">▾</span></button>
  <details class="disc"><summary style="margin-top:8px"><span style="font-size:13.5px;color:var(--s)">More options</span><span class="caret">▾</span></summary>
   <div class="setrow"><div class="k">Each way</div><button class="tog" data-tog aria-pressed="false"></button></div>
   <div class="setrow"><div class="k">Free bet or bonus</div><button class="tog" data-tog aria-pressed="false"></button></div>
   <button class="setrow" data-toast="Rule 4 applied"><div><div class="k">Rule 4 deduction</div><div class="dd">Racing, when a runner is withdrawn</div></div><span class="pill">None ▾</span></button>
   <button class="setrow" data-toast="Result set"><div><div class="k">Result</div><div class="dd">Won, lost, void, cashed out, placed or push</div></div><span class="pill">Won ▾</span></button></details>
  <label class="flabel">Note</label><textarea class="field" rows="2" placeholder="Optional"></textarea>
  <button class="btn full" style="margin-top:12px" data-toast="Saved">Save changes</button>`,
 editrow:()=>`<div class="hd"><b style="font-size:16px">Edit row</b></div>
  <label class="flabel">Date</label><input class="field mono" value="04/08/2026">
  <label class="flabel">Description</label><input class="field" autocomplete="off" value="Arsenal v Spurs">
  <div style="display:flex;gap:9px"><div style="flex:1"><label class="flabel">Stake</label><input class="field mono" value="100.00"></div>
   <div style="flex:1"><label class="flabel">Profit</label><input class="field mono" value="180.00"></div></div>
  <button class="btn full" style="margin-top:12px" data-toast="Row updated">Save</button>`,
 joincode:()=>`<div class="hd"><b style="font-size:16px">Join with a code</b></div>
  <p class="note" style="margin:0 0 12px">Anyone in a group can share its code. Some let you straight in, others still need an admin.</p>
  <label class="flabel">Group code</label>
  <input class="field mono" autocomplete="off" spellcheck="false" aria-label="Group code" placeholder="ULT-7XQ2" style="text-transform:uppercase">
  <button class="btn full" style="margin-top:12px" data-toast="Joined Irish Racing">Join</button>`,
 creategroup:()=>`<div class="hd"><b style="font-size:16px">Create a group</b></div>
  <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px"><span class="gpic" style="width:52px;height:52px;border-radius:16px;font-size:18px">SL</span>
   <button class="btn ghost sm" data-toast="Choose a picture">Add a picture</button></div>
  <label class="flabel">Name</label><input class="field" autocomplete="off" placeholder="Sunday league">
  <label class="flabel">Who can join</label><div style="margin-top:6px">${segHTML(['Invite only','Code','Request'],'Invite only').replace('class="seg"','class="seg full"')}</div>
  <p class="note">You will be admin. Members see each other's unit size.</p>
  <button class="btn full" style="margin-top:12px" data-toast="Group created">Create</button>`,
 joingroup:()=>`<div class="hd"><b style="font-size:16px">Join with a code</b></div>
  <input class="field mono" placeholder="ULT-7XQ2" style="text-align:center;font-size:20px;letter-spacing:.08em">
  <button class="btn full" style="margin-top:12px" data-toast="Joined">Join</button>`,
 groupadmin:()=>`<div class="hd"><b style="font-size:16px">Manage Ultras</b><span class="tag">ADMIN</span></div>
  <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><span class="gpic" style="width:48px;height:48px;border-radius:15px;font-size:17px">U</span>
   <button class="btn ghost sm" data-toast="Choose a picture">Change picture</button></div>
  ${[['Invite code','ULT-7XQ2'],['Who can join','Invite only'],['Ranking period','This month'],['Members','12'],['Join requests','2']].map(r=>`
   <button class="setrow" data-toast="${r[0]}"><div class="k">${r[0]}</div><span class="pill">${r[1]} ›</span></button>`).join('')}
  <div class="setrow"><div><div class="k">Slip-backed bets only</div><div class="dd">Always on. Imported figures and hand-typed bets never appear in a group table</div></div><span class="pill g">Always</span></div>
  <div class="setrow"><div><div class="k">Show edit-after-result counts</div><div class="dd">Members see who changed a bet once the result was known</div></div><button class="tog" data-tog aria-pressed="true"></button></div>
  <button class="btn ghost full sm" style="margin-top:12px" data-toast="Admin transferred">Transfer admin</button>
  <button class="btn danger full sm" style="margin-top:9px" data-toast="Group deleted">Delete group</button>`,
 unit:()=>`<div class="hd"><b style="font-size:16px">Your unit</b></div>
  <div class="chips">${['£10','£20','£25','£50','£100','Custom'].map(x=>`<button class="chip" aria-current="${x==='£25'}" data-pickone>${x}</button>`).join('')}</div>
  <button class="btn full" style="margin-top:10px" data-toast="Unit set">Save</button>`,
 odds:()=>`<div class="hd"><b style="font-size:16px">Odds format</b></div>
  ${[['Decimal','1.80'],['Fractional','4/5'],['American','−125']].map(o=>`<button class="setrow" data-setodds="${o[0]}">
   <div><div class="k">${o[0]}</div><div class="dd mono">${o[1]}</div></div>${o[0]===cur.oddsFmt?'<span class="pill g">✓</span>':''}</button>`).join('')}`,
 /* 11 · CURRENCY. Set at onboarding from the account's country, changeable
    here. One per account: a Net that adds pounds and euros together is not a
    number of anything, so there is no "both" and no conversion. */
 currency:()=>`<div class="hd"><b style="font-size:16px">Currency</b></div>
  ${[['GBP','£','Pounds sterling'],['EUR','€','Euro']].map(o=>`<button class="setrow" data-setcur="${o[0]}">
   <div><div class="k">${o[1]} ${o[2]}</div><div class="dd mono">${o[1]}1,184.00</div></div>${o[0]===(cur.currency||'GBP')?'<span class="pill g">✓</span>':''}</button>`).join('')}
  <p class="note">Slips are read in whatever currency they show, and one that does not match
   this is flagged rather than converted. Nothing is ever added across two currencies.</p>`,
 showin:()=>`<div class="hd"><b style="font-size:16px">Show profit in</b></div>
  ${[['Currency','+£80.00'],['Units','+3.20u'],['Both','+£80.00 and +3.20u']].map(o=>`<button class="setrow" data-setshow="${o[0]}">
   <div><div class="k">${o[0]}</div><div class="dd mono">${o[1]}</div></div>${o[0]===cur.showIn?'<span class="pill g">✓</span>':''}</button>`).join('')}`,
 privacy:()=>`<div class="hd"><b style="font-size:16px">Who can see your figures</b></div>
  ${[['Public','Anyone sees your units and ROI'],['Friends only','Only Slippers you follow back'],['Private','No one. Groups you join still do.']].map((o,i)=>`
   <button class="setrow" data-toast="${o[0]}"><div><div class="k">${o[0]}</div><div class="dd">${o[1]}</div></div>${i===1?'<span class="pill g">✓</span>':''}</button>`).join('')}
  <p class="note">Stake sizes are shared inside groups you join, and nowhere else.</p>`,
 /* THE FAKE CARD FORM IS GONE.
    It was three plain inputs with a test card number typed into them and a
    Save button that showed "Card updated" and did nothing. Card details must
    never touch this origin: collecting them here would put the whole
    deployment inside PCI scope for a form that was not even wired up.
    Stripe's Billing Portal handles the card, and the plan change, and the
    cancellation, with SCA and 3DS behind it. */
 card:()=>`<div class="hd"><b style="font-size:16px">Payment method</b></div>
  <p class="note" style="margin:0 0 14px">Your card is held by Stripe, never by Slippery. The billing page is where you change it, switch plan or cancel.</p>
  <button class="btn full" data-portal>Open billing</button>
  <p class="note" style="margin-top:10px">You will come straight back here afterwards.</p>`,
 cancelplan:()=>`<div class="hd"><b style="font-size:16px">Cancel your plan?</b></div>
  <p class="note" style="margin:0 0 14px">Full access until 2 Sep. After that the account is read only and you can still export.</p>
  <button class="btn danger full" style="margin-bottom:9px" data-toast="Cancelled">Cancel my plan</button><button class="btn ghost full" data-close>Keep it</button>`,
 reset:()=>`<div class="hd"><b style="font-size:16px">Reset account?</b></div>
  <p class="note" style="margin:0 0 14px">Deletes every bet and slip image. Your account, unit, groups and plan stay.</p>
  <button class="btn ghost full" style="margin-bottom:9px" data-sheet="export">Export first</button>
  <button class="btn danger full" style="margin-bottom:9px" data-toast="Account reset">Reset everything</button><button class="btn ghost full" data-close>Cancel</button>`,
 delacc:()=>`<div class="hd"><b style="font-size:16px">Delete your account?</b></div>
  <p class="note" style="margin:0 0 14px">Everything goes and cannot be recovered.</p>
  <button class="btn ghost full" style="margin-bottom:9px" data-sheet="export">Export first</button>
  <button class="btn danger full" style="margin-bottom:9px" data-toast="Deleted">Delete everything</button><button class="btn ghost full" data-close>Cancel</button>`,
 forgot:()=>`<div class="hd"><b style="font-size:16px">Reset your password</b></div>
  <input class="field" autocomplete="off" value="seun4150@gmail.com"><button class="btn full" style="margin-top:12px" data-toast="Code sent">Send a code</button>`,
 demonote:()=>`<div class="hd"><b style="font-size:16px">This is an example account</b></div>
  <p class="note" style="margin:0 0 14px">Everything here is invented so you can see how the app looks with a full record behind it. Nothing saves.</p>
  <button class="btn ghost full" style="margin-bottom:9px" data-close>Dismiss</button>
  <button class="btn full" data-go="su1">Start free</button>`});

/* ═══ router ═══ */

/* WHAT EACH SCREEN IS CALLED.
 *
 * Every page needs exactly one level-one heading and every piece of content
 * needs to sit inside a landmark, or a screen reader arrives at a wall of
 * text with no way to tell where it is or to skip past it. Most of these are
 * already visible on the screen, so the one inserted here is read, not drawn. */
const VIEWTITLE={
 landing:'Slippery, a bet tracker', demo:'Demo account',
 su1:'Create your account', su429:'Too many attempts', su2:'Confirm your email',
 su3:'Your name', su4:'Your unit', su5:'Sports and bookmakers', su6:'Choose a plan',
 login:'Sign in',
 overview:'Dashboard', ledger:'Ledger', history:'Imported history',
 social:'Social', discover:'Discover groups', groupdetail:'Group', person:'Profile',
 feed:'Feed',
 import:'Add a bet', crop:'Crop the slip', reading:'Reading the slip',
 review:'Check what was read', manual:'Type a bet in',
 importlinked:'Telegram connected', imphist:'Import your history',
 imphistreview:'Check what was imported',
 settings:'Settings', plan:'Plan and payment', referrals:'Refer a friend',
 bs_reminder:'Your trial', bs_failed:'Payment declined', bs_readonly:'Account is read only',
 fresh:'Dashboard', freshledger:'Ledger', freshsocial:'Social',
 offline:'Offline', saveerr:'That did not save', readererr:'That slip could not be read'
};
const NAVI=a=>`<nav class="navbar" aria-label="Sections">
 <button class="navcta" data-go="import"><svg viewBox="0 0 24 24"><use href="#impi"/></svg>Add a bet</button>
 ${[['dash','overview','dsh','Dashboard'],['soc','social','soci','Social']]
  .map(x=>`<button aria-current="${a===x[0]}" data-go="${x[1]}"><svg viewBox="0 0 24 24"><use href="#${x[2]}"/></svg>${x[3]}</button>`).join('')}
 <button class="mobonly" data-go="import"><svg viewBox="0 0 24 24"><use href="#impi"/></svg>Add a bet</button>
 <button aria-current="${a==='set'}" data-go="settings"><svg viewBox="0 0 24 24"><use href="#seti"/></svg>Settings</button>
 <div class="navextra">
  <div class="navsec">Your record</div>
  <button class="navsub" data-go="ledger">Ledger</button>
  <button class="navsub" data-go="history">Imported history</button>
  <button class="navsub" data-sheet="export">Export</button>
  <div class="navsec">Social</div>
  <button class="navsub" data-go="discover">Discover groups</button>
  <button class="navsub" data-sheet="challenge">Challenges<span class="nbadge a">2</span></button>
  <div class="navsec">Set up</div>
  <button class="navsub" data-sheet="bot">${TG} Telegram<span class="nbadge">Not linked</span></button>
  <button class="navsub" data-sheet="sources">Bookmakers and tipsters</button>
  <button class="navsub" data-sheet="bankroll">Balance<span class="nbadge">${money(balance()).replace('+','')}</span></button>
  <div class="navsec">Needs you</div>
  <button class="navsub" data-sheet="run">Bets running<span class="nbadge a">${cur.running}</span></button>
  <button class="navsub" data-sheet="stale">Waiting on a result<span class="nbadge a">3</span></button>
  <button class="navsub" data-sheet="fix">Fix problem bets<span class="nbadge a">7</span></button>
  <!-- 04 · 18+ belongs on the app footer as well as the landing one. This
       nav is the only chrome present on every signed-in screen. -->
  <div class="agemini"><i>18+</i><span>BeGambleAware.org</span></div>
  <div class="planbox"><b>Free trial</b><span>3 days and 9 slips left</span>
   <button class="btn sm full" style="margin-top:9px" data-go="plan">Choose a plan</button></div>
 </div></div>`;
/* 06 · GROUPS AND SLIPPERS.
   The two tabs rendered identically, so the only thing telling them apart
   was a word — and that word was "People", which says nothing this product
   means. Other Slippery users are Slippers. The underline colours differ too,
   so the tab you are on is legible before you read it. */
const SOCTABS=()=>`<div class="tabs socTabs">${[['groups','GROUPS'],['people','SLIPPERS']].map(x=>`<button aria-current="${(cur.socTab||'groups')===x[0]}" data-soctab="${x[0]}">${x[1]}</button>`).join('')}</div>`;
const TABS=t=>`<div class="tabs">${[['OVERVIEW','overview'],['LEDGER','ledger']].map(x=>`<button aria-current="${x[0]===t}" data-go="${x[1]}">${x[0]}</button>`).join('')}</div>`;
/* A title may be a function now, because the group page names whichever
   group was opened rather than always saying "Ultras". */
const titleOf=v=>typeof v.title==='function'?v.title():v.title;
const BAR=v=>v.back?`<div class="topback"><button data-go="${v.back}" style="font-size:20px">‹</button>${titleOf(v)}</div>`
 :`<div class="appbar">${BRAND}
   <div class="barright">
    ${v.run&&BR_OPEN>0?`<button class="runpill" data-sheet="exposure" aria-label="Open exposure, ${sym()}${BR_OPEN} at risk, ${exposurePct().toFixed(1)} percent of bankroll"><span class="dot"></span><span class="rplab">Open exposure</span><span class="mono">${sym()}${BR_OPEN}</span><span class="pct">${exposurePct().toFixed(1)}%</span></button>`:''}
    <button class="who" data-sheet="profile" aria-label="Your profile"><span class="av">${WHOAMI().i}</span></button></div></div>`;
const ph=host;
function go(id){const v=V[id];if(!v)return;
 cur.view=id;
 /* 02 · THE SKIP LINK.
    Zero of 173 captures had one, and the desktop sidebar puts roughly twenty
    links between the top of the document and the first thing on the page —
    so a keyboard or screen-reader user tabbed through the whole navigation
    on every screen. First focusable in the document, invisible until it has
    focus.

    THE H1, AND A CORRECTION. The brief says to delete the sr-only h1 because
    eight pages report two. Deleting it outright leaves thirty-six pages with
    none, which is worse: there is exactly one visible h1 in this product, the
    landing hero, so on every other screen the sr-only element was the only
    heading there was. The eight doubles were the landing view and the seven
    marketing paths that render it. So it is suppressed on that one view and
    kept everywhere else. */
 const ownsH1=id==='landing';
 const heading=ownsH1?'':`<h1 class="sronly">${VIEWTITLE[id]||'Slippery'}</h1>`;
 const skip=`<a class="skiplink" href="#main">Skip to content</a>`;
 ph.innerHTML=`${skip}<main class="body" id="main" tabindex="-1">${heading}${v.bare?'':BAR(v)}${v.tab?(v.nav==='soc'?SOCTABS():TABS(v.tab)):''}${v.html()}</main>${v.bare?'':NAVI(v.nav)}`;
 ph.toggleAttribute('data-narrow',!!v.narrow);
 ph.toggleAttribute('data-cols',!!v.cols);
 ph.toggleAttribute('data-centre',!!v.centre);
 const bd=ph.querySelector('.body');
 [...bd.children].forEach((c,i)=>{if(c.tagName!=='H1')c.style.animationDelay=(i*55)+'ms'});
 bd.classList.add('enter');setTimeout(()=>bd.classList.remove('enter'),700);
 revealOn();
 if(v.demo&&!cur.demoSeen){cur.demoSeen=true;setTimeout(()=>sheet('demonote'),420);}
 boot();paint();
 onView(id);}
function repaint(){const b=ph.querySelector('.body'),y=b.scrollTop;
 const v=V[cur.view],tb=b.querySelector('.tabs');
 const ab=b.querySelector('.appbar');if(ab&&!v.bare&&!v.back)ab.outerHTML=BAR(v);
 if(tb&&v.tab)tb.outerHTML=(v.nav==='soc'?SOCTABS():TABS(v.tab));
 b.querySelectorAll('.pane').forEach(p=>p.remove());
 const t=document.createElement('div');t.innerHTML=v.html();
 while(t.firstChild)b.appendChild(t.firstChild);b.scrollTop=y;boot();paint();}
/* 19 · A SHEET DECLARES ITS SIZE. On a desktop these are centred modals, and
   a confirm does not want a form's width while Challenges — three
   leaderboards — does not want a confirm's. On a phone they stay bottom
   sheets and the size is ignored, which is correct there. */
const SHEET_SIZE={
 confirm:['delacc','reset','cancelplan','unlink','forgot','resetcode','joincode','wrong',
  'demonote','stale','arb','tipsterdel','joingroup'],
 wide:['challenge','newchal','weekly','weeklyOld','audit','markets','books','tipsters',
  'legalDoc','terms','privacypol','export','calc','calcPane','golden','betdetail']};
function sheetSize(k){
 if(SHEET_SIZE.confirm.includes(k))return 'confirm';
 if(SHEET_SIZE.wide.includes(k))return 'wide';
 return 'form'}

function sheet(k){if(!SH[k])return;
 ph.querySelectorAll('.scrim,.sheet').forEach(x=>x.remove());
 ph.insertAdjacentHTML('beforeend',`<div class="scrim" data-close></div><div class="sheet" data-size="${sheetSize(k)}" role="dialog" aria-modal="true" aria-label="${k}"><div class="grab"></div>${SH[k]()}</div>`);
 lockBg(true);
 requestAnimationFrame(()=>{const sc=ph.querySelector('.scrim'),sh=ph.querySelector('.sheet');
  if(sc)sc.classList.add('on');if(sh)sh.classList.add('on');allInds();});boot();}
win.addEventListener('keydown',e=>{if(e.key!=='Escape')return;
 if(cur.openMenu){cur.openMenu=null;repaint();return}
 if(document.querySelector('.tut.on')){endTut();return}
 if(ph.querySelector('.sheet'))closeSheet()});
function lockBg(on){document.documentElement.style.overflow=on?'hidden':'';
 const b=ph.querySelector('.body');if(b)b.style.overflow=on?'hidden':''}
function closeSheet(){const s=ph.querySelector('.scrim'),t=ph.querySelector('.sheet');if(!s||!t)return;
 s.classList.remove('on');t.classList.remove('on');lockBg(false);setTimeout(()=>{s.remove();t.remove();},380);}
/* A DISABLED BUTTON MUST SAY WHY.
 *
 * Otherwise it reads as broken, and the person's next move is to press it
 * again rather than to do the thing that would enable it. This names exactly
 * what is outstanding, in the order it has to be done, and it is polite
 * about it: "still needed", not "you have not". */
function checkDocs(){
 const t=ph.querySelector('[data-doc=terms]'),p=ph.querySelector('[data-doc=privacypol]');
 const b=document.getElementById('su1go');
 if(!b)return;
 const em=ph.querySelector('[data-authemail]'),pw=ph.querySelector('[data-authpass]');
 const need=[];
 if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value.trim()))need.push('your email');
 if(pw&&pw.value.length<8)need.push('a password of at least 8 characters');
 if(t&&!t.dataset.scrolled)need.push('the Terms');
 if(p&&!p.dataset.scrolled)need.push('the Privacy policy');

 /* The tick on each document button follows its own state, so the two
    controls are the progress indicator rather than a separate one. */
 for(const el of [t,p])if(el)el.classList.toggle('done',!!el.dataset.scrolled);

 const ready=need.length===0;
 b.toggleAttribute('disabled',!ready);b.setAttribute('aria-disabled',String(!ready));
 const h=ph.querySelector('#docHint');
 if(h)h.textContent=ready?'' :'Still needed: '+listOf(need)+'.';
}

/** "a, b and c" — an Oxford-free list, because this is a British product. */
function listOf(items){
 if(items.length<=1)return items[0]||'';
 return items.slice(0,-1).join(', ')+' and '+items[items.length-1];
}
function reSheet(k){const sh=ph.querySelector('.sheet');
 if(sh){sh.innerHTML='<div class="grab"></div>'+SH[k]();allInds();boot()}}
function toast(m,undo){ph.querySelectorAll('.toast').forEach(t=>t.remove());
 ph.insertAdjacentHTML('beforeend',`<div class="toast" role="status" aria-live="polite">${undo?`<span style="display:flex;align-items:center;gap:10px"><span style="flex:1">${m}</span><button data-undo style="color:var(--s);font-weight:700;font-size:13px;white-space:nowrap">Undo</button></span>`:m}</div>`);
 const t=ph.querySelector('.toast');requestAnimationFrame(()=>t.classList.add('on'));
 setTimeout(()=>{if(!ph.contains(t))return;t.classList.remove('on');setTimeout(()=>t.remove(),340);},undo?4200:1900);}
const GROUPS=[['Public',[['landing','Landing'],['demo','Demo']]],
 ['Auth',[['su1','1 Account'],['su429','Rate limited'],['su2','2 Verify'],['su3','3 Name'],['su4','4 Unit'],['su5','5 Sports'],['su6','6 Plan'],['login','Sign in']]],
 ['Dash',[['overview','Overview'],['ledger','Ledger'],['history','History']]],
 ['Social',[['social','Social'],['discover','Discover'],['groupdetail','Group'],['person','Person']]],
 ['Import',[['import','Add a bet'],['reading','Analysing'],['review','Review'],['manual','Type it'],['importlinked','Linked'],['imphist','History'],['imphistreview','History review']]],
 ['Settings',[['settings','Settings'],['plan','Plan'],['referrals','Referrals'],['bs_failed','Declined'],['bs_readonly','Read only']]],
 ['Extras',[['crop','Crop']]],
 ['New/err',[['fresh','New dash'],['freshledger','New ledger'],['freshsocial','New social'],['offline','Offline'],['saveerr','Save failed'],['readererr','Unreadable']]],
 ['Billing',[['bs_reminder','Reminder'],['bs_failed','Declined'],['bs_readonly','Read only']]]];


/* ═══ THE BRIDGE FROM A BUTTON TO SOMETHING REAL ═══ */

/* A preference, kept in both places it can live. Locally so it survives a
   reload for somebody who has not signed up, and on the account so it
   follows them to another device. The local write is synchronous and the
   remote one is not, because a setting must take effect before a round trip
   rather than after it. */
function persist(patch) {
  saveStored(cur);
  fetch('/api/settings', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => { /* signed out, or offline. The local copy still holds. */ });
}

/* Held so the four second undo can cancel before anything is sent. Undo that
   fires a request and then reverses it is not undo, it is two mistakes. */
let pendingUndo = null;

function holdUndo(run, message) {
  if (pendingUndo) { clearTimeout(pendingUndo.timer); pendingUndo.run(pendingUndo.ctx); }
  const ctx = actionContext();
  const timer = setTimeout(() => {
    const p = pendingUndo; pendingUndo = null;
    if (p) Promise.resolve(p.run(p.ctx)).then(() => repaint());
  }, 4000);
  pendingUndo = { run, ctx, timer };
  toast(message, true);
}

function cancelUndo() {
  if (!pendingUndo) return false;
  clearTimeout(pendingUndo.timer);
  pendingUndo = null;
  return true;
}

/* What an action is allowed to see. Deliberately small: the state object, a
   repaint, a way to defer a destructive write, and a reader for whatever the
   open sheet has in its fields. */
function actionContext() {
  return {
    cur,
    repaint,
    toast,
    holdUndo,
    /* The mounted subtree, so an action can reach a control on the current
       screen without going through document and finding one on another. */
    root: ph,
    read(name) {
      const scope = ph.querySelector('.sheet') || ph;
      const el = scope.querySelector('[data-field=' + name + ']');
      if (el) return el.value !== undefined ? el.value : el.textContent;
      return cur[name];
    },
  };
}

async function runAction(el, ev) {
  const label = el.dataset.toast;
  const k = ACTION_KEY(label);
  const action = ACTIONS[k];

  if (typeof action === 'function') {
    if (!ev.target.closest('.udl')) closeSheet();
    let result;
    try { result = await action(actionContext()); }
    catch { result = 'Something went wrong. Nothing was changed.'; }
    /* A null result means the action reported for itself, or deliberately
       said nothing. Anything else is what actually happened, which is not
       always what the button predicted. */
    if (result) toast(result);
    else if (result !== null) toast(label);
    return;
  }

  /* NOT_BUILT, or unclassified, which is the same thing until somebody
     classifies it. The control says so instead of claiming success. */
  if (!ev.target.closest('.udl')) closeSheet();
  toast(notBuiltMessage(label));
}

/* TO STRIPE CHECKOUT, WITH ONLY A PLAN NAME.
 *
 * The client never sends an amount. A price set by the browser is a price
 * anybody can edit in a console, so the route looks the price id up from an
 * environment variable and Stripe charges that. */
async function startCheckout() {
  const picked = ph.querySelector('.plancell[aria-current=true]');
  const plan = (picked && picked.dataset.plan) || 'annual';
  toast('Opening checkout…');
  try {
    const r = await fetch('/api/stripe/checkout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: plan === 'monthly' ? 'monthly' : 'yearly', withTrial: plan === 'trial' }),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok && body.url) { location.href = body.url; return; }
    if (r.status === 401) { toast('Sign in first.'); go('login'); return; }
    toast(body.error || 'Could not open checkout just now.');
  } catch {
    toast('You appear to be offline. Nothing was sent.');
  }
}

async function openBillingPortal() {
  toast('Opening billing…');
  try {
    const r = await fetch('/api/stripe/portal', { method: 'POST', credentials: 'same-origin' });
    const body = await r.json().catch(() => ({}));
    if (r.ok && body.url) { location.href = body.url; return; }
    toast(body.error || 'Could not open billing just now.');
  } catch {
    toast('You appear to be offline. Nothing was sent.');
  }
}

function notBuiltMessage(label) {
  if (/app store|google play/i.test(label)) return label;   // already honest
  return 'Not built yet. Nothing was changed.';
}

doc.addEventListener('click',e=>{
 if(e.target.closest('[data-home]')){closeSheet();go(cur.signedIn?'overview':'landing');return;}
 if(e.target.closest('[data-signin]')){cur.signedIn=true;closeSheet();go('overview');toast('Signed in');return;}
 const cq=e.target.closest('[data-calctab]');if(cq){cur.calcTab=cq.dataset.calctab;
  const seg=cq.closest('.seg');[...seg.querySelectorAll('button')].forEach(x=>x.setAttribute('aria-current',x===cq));placeInd(seg);
  const bd=document.getElementById('calcBody');if(bd){bd.innerHTML=SH.calcPane(cur.calcTab);allInds()}return}
 if(e.target.closest('[data-cashdo]')){const f=cur.cashF||4,rem=cur.cashRem||100;
  cur.cashRem=+(rem-rem*f/8).toFixed(2);cur.cashF=4;closeSheet();
  toast(`Cashed out ${f}/8 · ${sym()}${(rem-cur.cashRem).toFixed(2)} settled, ${sym()}${cur.cashRem.toFixed(2)} still running`);return}
 if(e.target.closest('[data-bulk]')){cur.bulk=!cur.bulk;if(ph.querySelector('.sheet'))closeSheet();setTimeout(repaint,60);return}
 const bt=e.target.closest('[data-bet]');if(bt){if(cur.bulk)return;cur.betIdx=+bt.dataset.bet;closeSheet();setTimeout(()=>sheet('betdetail'),60);return}
 const g=e.target.closest('[data-go]');if(g){closeSheet();go(g.dataset.go);return;}
 const s=e.target.closest('[data-sheet]');if(s){closeSheet();setTimeout(()=>sheet(s.dataset.sheet),60);return;}
 if(e.target.closest('[data-close]')){closeSheet();return;}
 if(e.target.closest('[data-tut]')){closeSheet();setTimeout(startTut,300);return;}
 const st=e.target.closest('[data-settle]');if(st){cur.running=Math.max(0,cur.running-1);cur.risk=Math.max(0,cur.risk-22);
  const rt=document.getElementById('runtxt');if(rt)rt.textContent=`${cur.running} bets running`;
  toast(st.dataset.settle);closeSheet();return;}
 if(e.target.closest('[data-check]')){cur.running=1;cur.risk=18;
  const rt=document.getElementById('runtxt');if(rt)rt.textContent='1 bet running';
  closeSheet();toast('3 settled · 1 needs a result');return;}
 if(e.target.closest('[data-undo]')){ph.querySelectorAll('.toast').forEach(x=>x.remove());
  /* Real undo: the write was never sent. */
  toast(cancelUndo()?'Restored. Nothing was deleted.':'Nothing to undo.');repaint();return}
 const sc2=e.target.closest('[data-scroll]');if(sc2){const id=sc2.dataset.scroll;closeSheet();
  setTimeout(()=>{const tgt=document.querySelector('[data-sec="'+id+'"]');if(!tgt)return;
   const smooth=!matchMedia('(prefers-reduced-motion:reduce)').matches;
   let sc=tgt.parentElement;
   while(sc&&sc!==document.documentElement){
     const ov=getComputedStyle(sc).overflowY;
     if((ov==='auto'||ov==='scroll')&&sc.scrollHeight>sc.clientHeight+4)break;
     sc=sc.parentElement}
   if(sc&&sc!==document.documentElement){
     sc.scrollTo({top:tgt.offsetTop-14,behavior:smooth?'smooth':'auto'})
   }else{
     const y=tgt.getBoundingClientRect().top+(window.scrollY||document.documentElement.scrollTop)-14;
     window.scrollTo({top:y,behavior:smooth?'smooth':'auto'})}},420);return}
 /* THE HANDLER NO LONGER TRUSTS data-toast.
    It was: show this message, do nothing. Ninety one controls behaved that
    way, including Delete everything and Cancel my plan. Now the message is
    only the label; what happens comes from the action table, and an action
    nobody has classified is treated as not built rather than as done. */
 /* Straight to Stripe's own page. Nothing about a card is collected here. */
 if(e.target.closest('[data-portal]')){openBillingPortal();return;}
 /* 07 · A real retry. Stripe's portal is where a payment can actually be
    re-attempted against the card on file, so this goes to the same place as
    Update card rather than raising a toast that changes nothing. */
 if(e.target.closest('[data-retrypay]')){
  toast('Opening your billing page to retry…');
  openBillingPortal();return;}
 if(e.target.closest('[data-checkout]')){startCheckout();return;}
 const t=e.target.closest('[data-toast]');if(t){runAction(t,e);return;}
 const dy=e.target.closest('[data-day]');if(dy){cur.dayIdx=+dy.dataset.day;closeSheet();setTimeout(()=>sheet('day'),60);return}
 const so=e.target.closest('[data-setodds]');if(so){cur.oddsFmt=so.dataset.setodds;persist({oddsFormat:cur.oddsFmt.toLowerCase()});closeSheet();
  toast('Odds shown as '+cur.oddsFmt.toLowerCase());setTimeout(repaint,80);return}
 const sc=e.target.closest('[data-setcur]');if(sc){cur.currency=sc.dataset.setcur;
  persist({currency:cur.currency});closeSheet();
  toast('Figures shown in '+cur.currency);setTimeout(repaint,80);return}
 const ss=e.target.closest('[data-setshow]');if(ss){cur.showIn=ss.dataset.setshow;persist({showProfitIn:cur.showIn.toLowerCase()});closeSheet();
  toast('Profit shown in '+cur.showIn.toLowerCase());setTimeout(repaint,80);return}
 const sp=e.target.closest('[data-setper]');if(sp){cur.per=sp.dataset.setper;closeSheet();
  if(cur.view==='landing'){const sb=document.getElementById('shotBody');
   if(sb){sb.innerHTML=netCard()+calCard();boot();allInds()}return}
  setTimeout(repaint,60);return}
 const ws=e.target.closest('[data-ws]');if(ws){cur.weekStart=+ws.dataset.ws;persist({weekStart:cur.weekStart});closeSheet();
  toast('Week starts on '+(cur.weekStart===1?'Monday':'Sunday'));setTimeout(()=>{document.querySelectorAll('[data-cal]').forEach(c=>{c.removeAttribute('data-d');});boot()},260);return}
 const cd=e.target.closest('[data-caldates]');if(cd){cur.calDates=cd.getAttribute('aria-pressed')!=='true';
  cd.setAttribute('aria-pressed',cur.calDates);toast('Calendar dates '+(cur.calDates?'on':'off'));return;}
 /* ═══ ONE DOOR ═══
    The screen does not ask whether you have an account; the server answers
    and the flow branches on what it says. */
 const ago=e.target.closest('[data-authgo]');if(ago){authContinue(ago);return}
 if(e.target.closest('[data-authemail],[data-authpass]'))return;   /* typing is not a click */

 /* ═══ 02 · MODULE MENUS ═══ */
 const mt=e.target.closest('[data-menutoggle]');
 if(mt){const id=mt.dataset.menutoggle;cur.openMenu=cur.openMenu===id?null:id;repaint();return}
 const ms=e.target.closest('[data-modset]');
 if(ms){const [id,key,val]=ms.dataset.modset.split(':');
  if(id==='cal'&&key==='ws'){cur.weekStart=val==='sun'?0:1;persist({weekStart:cur.weekStart});
   document.querySelectorAll('[data-cal]').forEach(c=>c.removeAttribute('data-d'));repaint();return}
  cur.mod[id]=cur.mod[id]||{};
  cur.mod[id][key]=isNaN(+val)?val:+val;
  if(id==='stake'&&key==='tol')cur.stakeTol=+val;
  persist({mod:cur.mod});repaint();return}
 const mtg=e.target.closest('[data-modtog]');
 if(mtg){const [id,key]=mtg.dataset.modtog.split(':');
  cur.mod[id]=cur.mod[id]||{};
  cur.mod[id][key]=mtg.getAttribute('aria-checked')!=='true';
  persist({mod:cur.mod});repaint();return}
 const mh=e.target.closest('[data-modhide]');
 if(mh){const id=mh.dataset.modhide;
  if(!cur.hidden.includes(id))cur.hidden=[...cur.hidden,id];
  cur.openMenu=null;persist({hidden:cur.hidden});repaint();
  /* One click out, and one click back, so hiding is never a trap. */
  toast('Hidden. Restore it from Edit overview.');return}
 /* A click anywhere else closes an open menu. */
 if(cur.openMenu&&!e.target.closest('.menu')){cur.openMenu=null;repaint()}

 /* ═══ THE SLIP ITSELF ═══
    The one action the whole product exists for. It was a navigation to a
    screen showing somebody else's bet365 slip. */
 if(e.target.closest('[data-pick]')){const inp=ph.querySelector('[data-slipinput]');if(inp)inp.click();return}
 if(e.target.closest('[data-discard]')){cur.readBets=null;cur.readName='';go('import');return}
 const sa=e.target.closest('[data-saveall]');if(sa){saveRead(sa);return}

 const th=e.target.closest('[data-theme]');if(th){const t=th.dataset.theme;if(t===cur.theme)return;
  cur.theme=t;ph.dataset.t=t;document.body.dataset.t=t;document.documentElement.dataset.t=t;rememberTheme(t);
  ph.classList.add('tfade');
  ph.querySelectorAll('[data-theme]').forEach(x=>x.setAttribute('aria-current',x.dataset.theme===t));
  setTimeout(()=>ph.classList.remove('tfade'),540);return;}
 const mv=e.target.closest('[data-mv]');if(mv){const k=mv.dataset.k,i=cur.order.indexOf(k),j=mv.dataset.mv==='up'?i-1:i+1;
  if(j>=0&&j<cur.order.length){[cur.order[i],cur.order[j]]=[cur.order[j],cur.order[i]];
   const sh=ph.querySelector('.sheet');sh.innerHTML='<div class="grab"></div>'+SH.editov();repaint();}return;}
 const sz=e.target.closest('[data-size]');if(sz){const [k,z]=sz.dataset.size.split(':');cur.size[k]=z;
  {const sh=ph.querySelector('.sheet');if(sh)sh.innerHTML='<div class="grab"></div>'+SH.editov();}repaint();return}
 const vi=e.target.closest('[data-above]');if(vi){const k=vi.dataset.above;
  cur.above=cur.above.includes(k)?cur.above.filter(x=>x!==k):[...cur.above,k];
  const sh=ph.querySelector('.sheet');sh.innerHTML='<div class="grab"></div>'+SH.editov();repaint();return;}
 const doc=e.target.closest('[data-doc]');if(doc){doc.dataset.read=1;sheet(doc.dataset.doc);
  /* THE ACKNOWLEDGEMENT UNLOCKS AT THE END OF THE DOCUMENT, not at the top.
     The scroller here is the document body inside the sheet, not the sheet
     itself, and a document short enough not to scroll counts as read the
     moment it is open. */
  setTimeout(()=>{
   const sh=ph.querySelector('.sheet');if(!sh)return;
   const box=sh.querySelector('.scrollbox')||sh;
   const ack=sh.querySelector('[data-ack]');
   const hint=sh.querySelector('.ackhint');
   const done=()=>{
    doc.dataset.scrolled=1;
    if(ack){ack.removeAttribute('disabled');ack.setAttribute('aria-disabled','false')}
    if(hint)hint.textContent='Confirm to continue.';
    checkDocs();
   };
   const watch=()=>{if(box.scrollTop+box.clientHeight>=box.scrollHeight-40)done()};
   box.addEventListener('scroll',watch);
   sh.addEventListener('scroll',watch);
   if(box.scrollHeight<=box.clientHeight+10)done();
  },420);
  checkDocs();return}
 const su=e.target.closest('[data-setunit]');if(su){const v=su.dataset.setunit;
  if(v!=='Custom')cur.unit=parseInt(v.replace('£',''),10);
  [...su.parentElement.children].forEach(x=>x.setAttribute('aria-current',x===su));
  const eg=document.getElementById('unitEg');if(eg)eg.innerHTML=unitExample(cur.unit);
  const pv=document.getElementById('unitPrev');if(pv)pv.innerHTML=unitPreview(cur.unit);return}
 const stb=e.target.closest('[data-soctab]');if(stb){cur.socTab=stb.dataset.soctab;repaint();return}
 /* 22 · One control, two behaviours, because the pane it would open is
    already on screen above 1000px. Below it there is no second column, so
    the row does what it always did and goes to the group's own route. */
 /* 04 · The six outcomes are clickable rather than only cycling, so anyone
    can go straight to the one that matters to them. The whole box is
    re-rendered so the animations restart from their first frame. */
 /* 18 · Choosing a preset sets which modules the dashboard opens with. */
 const pz=e.target.closest('[data-preset]');
 if(pz){cur.preset=pz.dataset.preset;
  const mods=PRESET_MODULES[cur.preset];
  cur.above=mods?DEFAULT_ORDER.filter(k=>mods.includes(k)):[...DEFAULT_ORDER];
  cur.hidden=mods?DEFAULT_ORDER.filter(k=>!mods.includes(k)):[];
  repaint();return}

 /* 17 · TELEGRAM, FOR REAL. These three used to be `data-toast` and the code
    on screen was a hardcoded string the bot would have rejected. */
 /* 17 · Which Slipper. Same shape as data-groupsel. */
 const ps=e.target.closest('[data-personsel]');
 if(ps){cur.personsel=ps.dataset.personsel;go('person');return}

 /* 17 · Follow is real: /api/follows has existed all along. */
 const fb=e.target.closest('[data-follow]');
 if(fb){const who=fb.dataset.follow;
  cur.following=cur.following||[];
  const on=cur.following.includes(who);
  const done=busy(fb,on?'Unfollowing':'Following');
  fetch('/api/follows'+(on?'?handle='+encodeURIComponent(who.toLowerCase()):''),
   {method:on?'DELETE':'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:on?undefined:JSON.stringify({handle:who.toLowerCase()})})
   .then(r=>{done();
    if(!r.ok){toast('That did not save.');return}
    cur.following=on?cur.following.filter(x=>x!==who):[...cur.following,who];
    repaint()})
   .catch(()=>{done();toast('You appear to be offline. Nothing changed.')});
  return}

 const nt=e.target.closest('[data-notiftog]');
 if(nt){const k=nt.dataset.notiftog;
  cur.notifs=cur.notifs||{};
  cur.notifs[k]=!wantsNotif(k);
  nt.setAttribute('aria-pressed',String(cur.notifs[k]));
  /* Saved, not merely flipped. This is the whole difference from `data-tog`. */
  fetch('/api/settings',{method:'PATCH',credentials:'same-origin',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({notificationPrefs:cur.notifs})})
   .then(r=>{if(!r.ok)toast('That did not save.')})
   .catch(()=>toast('You appear to be offline. That did not save.'));
  return}

 if(e.target.closest('[data-copycode]')){
  const code=cur.linkCode;
  if(!code){toast('Still fetching your code.');return}
  navigator.clipboard?.writeText(code).then(()=>toast('Code copied'))
   .catch(()=>toast('Could not copy. The code is '+code+'.'));
  return}

 if(e.target.closest('[data-unlinktg]')){
  const btn=e.target.closest('[data-unlinktg]');
  const done=busy(btn,'Unlinking');
  fetch('/api/telegram/link',{method:'DELETE',credentials:'same-origin'})
   .then(r=>{done();closeSheet();
    /* Every bet stays exactly as it is, and the copy already promised that,
       so the toast confirms rather than reassuring twice. */
    toast(r.ok?'Telegram unlinked':'That did not unlink. Nothing changed.');
    cur.tgLinked=r.ok?false:cur.tgLinked;cur.linkCode=null;repaint()})
   .catch(()=>{done();toast('You appear to be offline. Nothing changed.')});
  return}

 const sg=e.target.closest('[data-settlego]');
 if(sg){cur.settleI=+sg.dataset.settlego;
  const box=ph.querySelector('[data-settledemo]');
  if(box)box.outerHTML=settleDemo();
  return}

 if(e.target.closest('[data-loadmore]')){
  cur.ledgerShown=(cur.ledgerShown||LEDGER_PAGE)+LEDGER_PAGE;
  repaint();
  /* Focus the first newly revealed row, so the button is not pressed into
     silence for anyone not using a mouse. */
  requestAnimationFrame(()=>{const rows=ph.querySelectorAll('.bet');
   const first=rows[(cur.ledgerShown-LEDGER_PAGE)]; if(first)first.focus()});
  return}

 /* 07 · THE LEGS OF A MULTIPLE.
    Add and remove repaint, because the leg numbers, the combined price and
    the "N legs" label all change with the count. The text inputs are handled
    on `input` below rather than here, so typing does not repaint on every
    keystroke and lose the caret. */
 if(e.target.closest('[data-legadd]')){
  (cur.legs||(cur.legs=[])).push(emptyLeg());
  repaint();
  /* Focus the selection field of the leg just added, or the button is
     pressed and nothing appears to happen for a keyboard user. */
  requestAnimationFrame(()=>{const f=ph.querySelector(`[data-legsel="${cur.legs.length-1}"]`);if(f)f.focus()});
  return}
 const ld=e.target.closest('[data-legdel]');
 if(ld){const i=+ld.dataset.legdel;
  cur.legs.splice(i,1); if(!cur.legs.length)cur.legs=[emptyLeg()];
  repaint(); return}

 /* 57 · Deposit or withdrawal. The sheet is re-rendered rather than
    repainted, because it is the sheet that is open. */
 const ak=e.target.closest('[data-adjkind]');
 if(ak){cur.adjKind=ak.dataset.adjkind;reSheet('adjust');return}
 const gsel=e.target.closest('[data-groupsel]');
 if(gsel){cur.groupSel=gsel.dataset.groupsel;
  if(matchMedia('(min-width:1000px)').matches&&cur.view==='social')repaint();
  else go('groupdetail');
  return}
 const shp=e.target.closest('[data-shareper]');if(shp){cur.sharePer=shp.dataset.shareper;reSheet('share');return}
 const shk=e.target.closest('[data-sharekind]');if(shk){const k=shk.dataset.sharekind;
  const cu=cur.shareKinds&&cur.shareKinds.length?cur.shareKinds:['Summary'];
  cur.shareKinds=cu.includes(k)?(cu.length>1?cu.filter(x=>x!==k):cu):[...cu,k];
  reSheet('share');return}
 if(e.target.closest('[data-sharemoney]')){cur.shareMoney=cur.shareMoney===false;reSheet('share');return}
 if(e.target.closest('[data-selall]')){const all=cur.above.length>=cur.order.length;
  cur.above=all?[...cur.LOCKED]:[...cur.order];reSheet('editov');repaint();return}
 if(e.target.closest('[data-resetov]')){cur.above=[...DEFAULT_ABOVE];cur.order=[...DEFAULT_ORDER];
  reSheet('editov');repaint();toast('Overview reset');return}
 const ackb=e.target.closest('[data-ack]');if(ackb){const k=ackb.dataset.ack;
  const src=ph.querySelector('[data-doc="'+k+'"]');if(src){src.dataset.scrolled=1;src.dataset.read=1}
  closeSheet();setTimeout(checkDocs,60);return}
 const dcb=e.target.closest('[data-doc]');if(dcb){dcb.dataset.read=1;sheet(dcb.dataset.doc);return}
 const exb=e.target.closest('[data-exch]');if(exb){const on=exb.getAttribute('aria-pressed')!=='true';
  exb.setAttribute('aria-pressed',on);const row=ph.querySelector('#commRow');if(row)row.hidden=!on;return}
 if(e.target.closest('[data-promoclear]')){cur.promo=null;repaint();toast('Code removed');return}
 if(e.target.closest('[data-promoapply]')){const i=ph.querySelector('[data-promoinput]');
  cur.promo=((i&&i.value.trim())||'SEUN-8QK4').toUpperCase();repaint();toast('Code applied');return}
 if(e.target.closest('[data-editname]')){const f=ph.querySelector('.sheet input');
  if(f){f.focus();f.select()}toast('Edit your display name');return}
 if(e.target.closest('[data-calexpand]')){cur.calOpen=!cur.calOpen;repaint();return}
 if(e.target.closest('[data-calunits]')){cur.calUnits=!cur.calUnits;reSheet('calopts');repaint();return}
 const cg=e.target.closest('[data-chalgroup]');if(cg){cur.chalGroup=cg.dataset.chalgroup;reSheet('challenge');return}
 if(e.target.closest('[data-adapt]')){cur.adaptBr=cur.adaptBr===false;reSheet('bankroll');repaint();return}
 if(e.target.closest('[data-resetbr]')){cur.adaptBr=false;reSheet('bankroll');repaint();toast('Reset to starting balance');return}
 const nmv=e.target.closest('[data-netmv]');if(nmv){const k=nmv.dataset.k,o=NETORDER();
  const i=o.indexOf(k),j=nmv.dataset.netmv==='up'?i-1:i+1;
  if(j>=0&&j<o.length){const t=o[i];o[i]=o[j];o[j]=t;cur.netOrder=o;reSheet('netfigs');repaint()}return}
 const nf=e.target.closest('[data-netfig]');if(nf){const k=nf.dataset.netfig;
  const base=cur.netShow.length?cur.netShow:['bets','units'];
  const next=base.indexOf(k)>=0?base.filter(x=>x!==k):base.concat([k]);
  cur.netShow=next.length?next:base;
  reSheet('netfigs');repaint();return}
 {const sg=e.target.closest('.seg button');
  if(sg&&ph.querySelector('.sheet')&&/Hall of fame|Running/.test(sg.innerText)){cur.chalTab=sg.innerText.trim();reSheet('challenge');return}}
 const p1=e.target.closest('[data-pickone]');if(p1){const seg=p1.closest('.seg')||p1.parentElement;
  [...seg.querySelectorAll('button')].forEach(x=>x.setAttribute('aria-current',x===p1));
  if(seg.classList.contains('seg'))placeInd(seg);return;}
 const pc=e.target.closest('[data-pickcard]');if(pc){[...pc.parentElement.querySelectorAll('[data-pickcard]')].forEach(x=>x.style.borderColor='');
  pc.style.borderColor='var(--p)';return;}
 const pm=e.target.closest('[data-multi]');if(pm){pm.setAttribute('aria-current',pm.getAttribute('aria-current')!=='true');return;}
 const tg=e.target.closest('[data-tog]');if(tg){tg.setAttribute('aria-pressed',tg.getAttribute('aria-pressed')!=='true');return;}
 const tr=e.target.closest('[data-tickrow]');if(tr){const b=tr.querySelector('span');const on=b.textContent.trim()==='✓';
  b.textContent=on?'':'✓';b.style.borderColor=on?'var(--line)':'var(--pos)';
  b.style.background=on?'none':'color-mix(in srgb,var(--pos) 20%,transparent)';return;}
 const dn=e.target.closest('[data-dnav]');if(dn){deckGo(+dn.dataset.dnav,dn.dataset.deckid);return;}
});
/* drag reorder */
let dragK=null;
/* Continue follows the fields, so the reason it is disabled is always
   current rather than whatever it was when the screen was drawn. */
doc.addEventListener('input',e=>{
 if(e.target.closest('[data-authemail],[data-authpass]'))checkDocs();

 /* 07 · The legs of a multiple, and the stake.
    Held in `cur` on every keystroke but NOT repainted: rebuilding the pane
    would destroy the field being typed into and take the caret with it. Only
    the two derived readouts are patched in place — the combined price and
    the returns line — which is the whole reason to do it by hand here. */
 const ls=e.target.closest('[data-legsel]'), lo=e.target.closest('[data-legodds]');
 const st=e.target.closest('[data-mstake]');
 if(!ls&&!lo&&!st)return;
 if(ls)cur.legs[+ls.dataset.legsel].sel=ls.value;
 if(lo)cur.legs[+lo.dataset.legodds].odds=lo.value;
 if(st)cur.manualStake=st.value;

 const comb=combinedOdds();
 const oddsField=ph.querySelector('#mOdds');
 if(oddsField&&comb!=null){oddsField.value=comb.toFixed(2);oddsField.readOnly=true}
 const note=ph.querySelector('.combodds');
 const stake=parseFloat(cur.manualStake||'')||0;
 if(comb==null){if(note)note.remove()}
 else{
  const legs=cur.legs.length;
  const html=`Combined price <b class="mono" style="color:var(--t1)">${comb.toFixed(2)}</b>`
   +(stake>0?` · returns <b class="mono" style="color:var(--pos)">${amount(stake*comb)}</b>`:'')
   +`<span style="display:block;color:var(--t3)">All ${legs} legs must win.</span>`;
  if(note)note.innerHTML=html;
  else{const anchor=ph.querySelector('[data-legadd]');
   if(anchor)anchor.insertAdjacentHTML('afterend',`<p class="note combodds">${html}</p>`)}
 }
});

doc.addEventListener('dragstart',e=>{const r=e.target.closest('[data-ek]');if(r){dragK=r.dataset.ek;r.style.opacity='.4';}});
doc.addEventListener('dragend',e=>{const r=e.target.closest('[data-ek]');if(r)r.style.opacity='';dragK=null;});
doc.addEventListener('dragover',e=>{if(dragK)e.preventDefault();});
doc.addEventListener('drop',e=>{const r=e.target.closest('[data-ek]');if(!r||!dragK)return;e.preventDefault();
 const to=r.dataset.ek,i=cur.order.indexOf(dragK),j=cur.order.indexOf(to);
 cur.order.splice(i,1);cur.order.splice(j,0,dragK);
 const sh=ph.querySelector('.sheet');if(sh)sh.innerHTML='<div class="grab"></div>'+SH.editov();repaint();});
/* deck swipe: one state per deck */
const DPOS={};
const deckOf=el=>el?el.closest('[data-deck]'):null;
function deckPaint(d){if(!d)return;
 const id=d.dataset.deck,n=d.querySelectorAll('.dslide').length,i=DPOS[id]||0;
 const tr=d.querySelector('.dtrack');
 tr.style.transform=`translateX(${-i*d.offsetWidth}px)`;
 const dots=document.querySelector(`[data-deckdots="${id}"]`);
 if(dots)[...dots.children].forEach((x,j)=>x.classList.toggle('on',j===i));
 document.querySelectorAll('[data-dnav]').forEach(b=>{
  const bid=b.dataset.deckid||d.dataset.deck;
  if(bid!==id)return;const v=+b.dataset.dnav;
  b.toggleAttribute('disabled',(v<0&&i===0)||(v>0&&i===n-1))});
 const a=d.querySelectorAll('.dslide')[Math.min(i,n-1)];
 if(a)d.style.height=Math.ceil(a.scrollHeight)+'px'}
function deckFit(){document.querySelectorAll('[data-deck]').forEach(deckPaint)}
function deckGo(step,id){
 const d=id?document.querySelector(`[data-deck="${id}"]`):document.querySelector('[data-deck]');
 if(!d)return;const n=d.querySelectorAll('.dslide').length;
 DPOS[d.dataset.deck]=Math.max(0,Math.min(n-1,(DPOS[d.dataset.deck]||0)+step));
 d.querySelector('.dtrack').style.transition='';deckPaint(d);
 const act=d.querySelectorAll('.dslide')[DPOS[d.dataset.deck]||0];
 if(act)[...act.children].forEach((c,i)=>{c.style.animation='none';void c.offsetWidth;
  c.style.animation=`slideRise .5s var(--ease-out) ${i*70}ms both`})}
let dx0=null,dEl=null;
doc.addEventListener('pointerdown',e=>{const d=deckOf(e.target);if(!d)return;
 dEl=d;dx0=e.clientX;d.querySelector('.dtrack').style.transition='none'});
doc.addEventListener('pointermove',e=>{if(dx0===null||!dEl)return;
 const w=dEl.offsetWidth,i=DPOS[dEl.dataset.deck]||0;
 dEl.querySelector('.dtrack').style.transform=`translateX(${-i*w+(e.clientX-dx0)}px)`});
doc.addEventListener('pointerup',e=>{if(dx0===null||!dEl)return;
 const d=e.clientX-dx0,n=dEl.querySelectorAll('.dslide').length,id=dEl.dataset.deck;
 let i=DPOS[id]||0;
 if(d<-40&&i<n-1)i++;else if(d>40&&i>0)i--;
 DPOS[id]=i;dEl.querySelector('.dtrack').style.transition='';deckPaint(dEl);
 dx0=null;dEl=null});

/* ═══ 10 · THE CALENDAR ════════════════════════════════════════════════════
 *
 * FILL SCALES WITH MAGNITUDE. A flat tint made +£264 and +£64 the same
 * green, so the month had no shape until you read every number. Intensity
 * gives it one before you read anything, and the figures are still there.
 *
 * A heavy cell flips its text to the background colour, because #86EFAC at
 * 76% over a dark ground will not carry #E6EBF3 text.
 *
 * FIGURES FOLLOW `Show profit in`. The calendar was the one place that
 * ignored it, so a unit-based account still saw pounds here.
 *
 * ON A PHONE THE WHOLE MONTH FITS. It used to collapse to a single week
 * behind an Expand button, which removes the only reason to open the module.
 * Seven columns at 390px gives 44px cells; under 44px the figure drops and
 * the date plus the intensity carries it. */
function calCell(d,today){
 const v=DAYVALS[d]||0,fut=d>today,none=!v&&!fut;
 const flat=modv('cal','style','intensity')==='flat';
 const showFig=modv('cal','figures',true);
 const showDate=cur.calDates!==false&&modv('cal','dates',true);
 const vals=Object.values(DAYVALS).map(Math.abs);
 const max=vals.length?Math.max(...vals):1;
 const a=flat?0.16:(v?Math.min(1,Math.abs(v)/max)*0.62+0.14:0);
 const heavy=!flat&&a>0.42;
 const tone=v>0?'127,227,166':'245,163,163';
 const style=v?`background:rgba(${tone},${a.toFixed(3)});border-color:rgba(${tone},${(a*0.8+0.15).toFixed(3)})`:'';
 const fig=cur.showIn==='Units'?(v>0?'+':'−')+Math.abs(v/cur.unit).toFixed(1)+'u'
   :(v>0?'+':'−')+Math.abs(v);
 return `<${v?'button':'div'} class="c ${v>0?'p':v<0?'n':''} ${none?'none':''} ${fut?'fut':''} ${d===today?'today':''}${heavy?' heavy':''}"
   ${v?`data-day="${d}"`:''} ${style?`style="${style}"`:''}>
  ${v&&showFig?`<span class="cv">${fig}</span>`:''}${showDate?`<span class="dn">${d}</span>`:''}</${v?'button':'div'}>`}
function buildCal(el,mode){const Y=2026,M=7,today=19,dim=new Date(Y,M+1,0).getDate();
 const first=new Date(Y,M,1).getDay();
 const off=cur.weekStart===1?((first+6)%7):first;
 const dows=cur.weekStart===1?['M','T','W','T','F','S','S']:['S','M','T','W','T','F','S'];
 let h=dows.map(d=>`<div class="dow">${d}</div>`).join('');
 if(mode==='week'){const wd=new Date(Y,M,today).getDay(),back=cur.weekStart===1?((wd+6)%7):wd;
  for(let i=0;i<7;i++){const d=today-back+i;
   h+=(d<1||d>dim)?'<div class="c pad"></div>':calCell(d,today)}
  el.innerHTML=h;return}
 for(let i=0;i<off;i++)h+='<div class="c pad"></div>';
 for(let d=1;d<=dim;d++)h+=calCell(d,today);
 el.innerHTML=h}
function countUp(el,to){const t0=performance.now();
 (function t(n){const k=Math.min(1,(n-t0)/900),e=1-Math.pow(1-k,3),v=to*e;
  /* 11 · The symbol comes from the account, not from this line. It was the
     last hardcoded £ in the product and it sat on the largest figure on the
     dashboard, so a euro account read every other figure in euros and the
     headline one in pounds. */
  el.textContent=(to<0?'−':'+')+sym()+Math.abs(v).toLocaleString(loc(),{minimumFractionDigits:2,maximumFractionDigits:2});
  if(k<1)requestAnimationFrame(t);})(t0);}
/* NAME EVERY CONTROL THAT DRAWS ITS LABEL BESIDE ITSELF.
 *
 * A switch is a square and a field is a box; both take their meaning from the
 * row they sit in, which a screen reader does not read as part of them.
 * Rather than dozens of hand-written labels that go stale the next time a row
 * is added, each control borrows the text already next to it, once per paint.
 */
function nameControls(root){
 root.querySelectorAll('button.tog:not([aria-label])').forEach(b=>{
  const row=b.closest('.setrow')||b.parentElement;
  const k=row&&row.querySelector('.k');
  const text=(k&&k.textContent||'').trim();
  if(text)b.setAttribute('aria-label',text);
 });
 root.querySelectorAll('input:not([aria-label]):not([id]),textarea:not([aria-label]):not([id]),select:not([aria-label]):not([id])').forEach(f=>{
  let el=f.previousElementSibling,text='';
  while(el&&!text){ if(el.classList&&(el.classList.contains('lbl')||el.classList.contains('k')||el.classList.contains('flabel')))text=(el.textContent||'').trim(); el=el.previousElementSibling; }
  if(!text)text=f.getAttribute('placeholder')||'';
  if(text)f.setAttribute('aria-label',text);
 });
}

/* THE TAB BAR MEASURES ITSELF.
 *
 * The scroller's bottom padding has to clear the bar, and the bar's height is
 * the sum of its type size, its icon size and the device's safe-area inset.
 * Any number written in the stylesheet is a guess that is wrong on some
 * phone, and the last card ends up underneath it. */
/* ═══════════════════════════════════════════════════════════════════════
 * THE LEDGER, FROM THE SERVER
 *
 * Signed out, every figure on the dashboard and in the ledger is the
 * prototype's worked example, which is what the marketing screens are for.
 * Signed in, all of it is replaced by the account's own — including an
 * account whose answer is nothing at all, which must read as nothing rather
 * than as somebody else's good month.
 *
 * Every figure comes from `bet_state` through /api/bets. Nothing here
 * recomputes a settlement: there is one grader and it is on the server.
 * ═══════════════════════════════════════════════════════════════════════ */

/* The render layer's row is a tuple, because that is what the prototype
   wrote and 90 call sites read. Mapping into it here keeps that one shape in
   one place rather than rewriting every screen. */
function ledgerRow(b){
  const won = b.realisedPlPence > 0;
  const settled = b.status && b.status !== 'open';
  const stake = (b.stakePence||0)/100;
  const ret = (b.returnedPence||0)/100;
  const net = (b.realisedPlPence||0)/100;
  const legs = (b.legs||[]).length > 1
    ? b.legs.map(l=>[l.selection||'', l.market||'', l.result==='won'?'w':l.result==='lost'?'l':'o'])
    : null;
  return [
    settled ? (won?'w':'l') : 'o',
    b.eventName || b.selection || 'Unnamed bet',
    b.selection || '',
    b.market || '',
    b.odds || 0,
    stake,
    ret,
    money(net),
    (b.units!=null?(b.units>0?'+':'')+Number(b.units).toFixed(2):'0.00')+'u',
    b.bookmaker || '',
    b.tipster || 'Own picks',
    b.source === 'telegram' ? 'Telegram' : b.source === 'import' ? 'Import' : b.slipBacked ? 'Screenshot' : 'Manual',
    fmtWhen(b.eventAt),
    0,
    legs,
  ];
}

function fmtWhen(iso){
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
    + ', ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}

/* A period is a window over the same rows, so it is derived rather than
   fetched again. Void stake is reported separately because a void is not a
   loss and must not be averaged into one. */
function periodOf(rows, from, lab, tgt){
  const inWindow = from ? rows.filter(b=>new Date(b.eventAt) >= from) : rows;
  const settled = inWindow.filter(b=>b.status && b.status!=='open');
  const net = settled.reduce((t,b)=>t+(b.realisedPlPence||0),0)/100;
  const to = inWindow.reduce((t,b)=>t+(b.stakePence||0),0)/100;
  const voided = settled.reduce((t,b)=>t+(b.voidedStakePence||0),0)/100;
  const units = settled.reduce((t,b)=>t+(b.units!=null?Number(b.units):0),0);
  return {net, bets:inWindow.length, units, to, void:voided, tgt:tgt||0,
    pace: tgt ? Math.max(0,Math.min(1,net/tgt)) : 0, lab};
}

function startOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}

async function hydrateLedger(){
  let body;
  try{
    const r = await fetch('/api/bets?period=all',{credentials:'same-origin'});
    if(!r.ok)return false;
    body = await r.json();
  }catch{ return false }
  if(!body || !Array.isArray(body.bets))return false;

  const rows = body.bets;
  bets = rows.map(ledgerRow);

  const now = new Date();
  const today = startOfDay(now);
  const week = startOfDay(now); week.setDate(week.getDate() - ((now.getDay()+6-(cur.weekStart===0?1:0))%7));
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const year = new Date(now.getFullYear(), 0, 1);

  PERIODS = {
    today: periodOf(rows, today, 'today', 0),
    W: periodOf(rows, week, 'this week', 0),
    M: periodOf(rows, month, 'this month', 0),
    Y: periodOf(rows, year, 'this year', 0),
    All: periodOf(rows, null, 'all time', 0),
  };

  /* The calendar is this month only, keyed by day of month, and it carries
     settled profit alone: a day whose bets have not run is not a zero, it is
     a day with nothing to say yet. */
  const days = {};
  for (const b of rows) {
    if (!b.status || b.status === 'open') continue;
    const d = new Date(b.eventAt);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    days[d.getDate()] = (days[d.getDate()] || 0) + (b.realisedPlPence||0)/100;
  }
  DAYVALS = days;
  TDY = PERIODS.today.net; WTD = PERIODS.W.net; MTD = PERIODS.M.net;
  BR_OPEN = Math.round(rows.filter(b=>!b.status||b.status==='open')
    .reduce((t,b)=>t+(b.remainingStakePence!=null?b.remainingStakePence:b.stakePence||0),0)/100);

  /* The calendar caches its own build, so it has to be told the data moved. */
  document.querySelectorAll('[data-cal]').forEach(el=>el.removeAttribute('data-d'));
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
 * READING A SLIP, FOR REAL
 *
 * Capture at placement is the product. Until now the dropzone navigated to
 * a screen drawing an invented bet365 slip, so the one thing the product
 * exists to do was the one thing it did not do in a browser.
 *
 * The order matters. The file goes up, the reader answers, and the answer is
 * shown for checking. NOTHING IS WRITTEN UNTIL SOMEBODY PRESSES SAVE. A
 * reader that is unsure marks the bet rather than inventing a fixture, for
 * the same reason the grader asks rather than guesses: a wrong bet saved
 * quietly is indistinguishable from a bet you placed.
 * ═══════════════════════════════════════════════════════════════════════ */

const READ_MAX = 12 * 1024 * 1024;

/* 59 · ONE PLACE THAT PUTS A CONTROL INTO ITS LOADING STATE.
 *
 * Three async actions each did a slightly different two thirds of this:
 * disable, swap the label, forget aria-busy, forget the spinner, and let the
 * button resize when "Save" became "Saving…". A row that reflows under the
 * cursor mis-places whatever was next to it, which is how somebody presses
 * Delete having aimed at Cancel.
 *
 * Returns the function that puts it back. Call it in a finally, or a failed
 * request leaves a button spinning forever with no way out.
 */
function busy(button, verb){
 if(!button) return ()=>{};
 const w=button.getBoundingClientRect().width;
 const label=button.innerHTML;
 const wasDisabled=button.disabled;
 /* Hold the measured width so the swap cannot change the layout. */
 if(w) button.style.minWidth=Math.ceil(w)+'px';
 button.setAttribute('aria-busy','true');
 button.disabled=true;
 /* Present tense: it says what is happening, not what was asked for. */
 button.innerHTML='<span class="spin" aria-hidden="true"></span>'+esc(verb);
 return ()=>{
  button.removeAttribute('aria-busy');
  button.disabled=wasDisabled;
  button.style.minWidth='';
  button.innerHTML=label;
 };
}

async function authContinue(button){
 const em=ph.querySelector('[data-authemail]'),pw=ph.querySelector('[data-authpass]');
 if(!em||!pw)return;
 const done=busy(button,'Checking');
 let r;
 try{
  const res=await fetch('/api/auth/continue',{method:'POST',credentials:'same-origin',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({email:em.value.trim(),password:pw.value})});
  r={ok:res.ok,body:await res.json().catch(()=>({}))};
 }catch{ r={ok:false,body:{error:'You appear to be offline. Nothing was sent.'}} }
 done();checkDocs();

 if(!r.ok){toast((r.body&&r.body.error)||'That did not work.');return}
 if(r.body.mode==='signin'){cur.signedIn=true;hydrateLedger().then(()=>repaint());go('overview');return}
 /* A new address: on to the emailed code, which is where an account is
    actually created. */
 go('su2');
}

async function readSlips(files){
  const list=[...files].filter(Boolean);
  if(!list.length)return;

  const tooBig=list.find(f=>f.size>READ_MAX);
  if(tooBig){toast('“'+tooBig.name+'” is bigger than 12MB. A screenshot rather than a photo is usually plenty.');return}

  cur.readName=list.length===1?list[0].name:list.length+' files';
  cur.readBets=null;
  go('reading');

  const found=[];
  const failed=[];
  for(const file of list){
    const form=new FormData();
    form.append('image',file);
    let r;
    try{
      const res=await fetch('/api/extract',{method:'POST',credentials:'same-origin',body:form});
      r={ok:res.ok,body:await res.json().catch(()=>({}))};
    }catch{
      r={ok:false,body:{error:'You appear to be offline. Nothing was sent.'}};
    }
    if(!r.ok){failed.push((r.body&&r.body.error)||'That did not read.');continue}
    if(r.body.notASlip){failed.push('“'+file.name+'” does not look like a bet slip.');continue}
    for(const b of (r.body.bets||[]))found.push(b);
  }

  cur.readBets=found;
  go('review');
  /* Partial failure is reported rather than rounded off: two of three slips
     reading is not the same as three reading. */
  if(failed.length)toast(failed.length===list.length?failed[0]:failed.length+' of '+list.length+' did not read. '+failed[0]);
}

async function saveRead(button){
  const bets=cur.readBets||[];
  if(!bets.length)return;
  const done=busy(button,'Saving');

  let saved=0;const problems=[];
  for(const b of bets){
    try{
      const res=await fetch('/api/bets',{method:'POST',credentials:'same-origin',
        headers:{'content-type':'application/json'},body:JSON.stringify(b)});
      if(res.ok)saved++;
      else{const j=await res.json().catch(()=>({}));problems.push(j.error||'One bet was refused.')}
    }catch{problems.push('You appear to be offline. Nothing was sent.')}
  }

  done();

  if(saved){
    /* Only what actually saved leaves the review screen, so pressing Save
       again retries the rest rather than duplicating the ones that worked. */
    cur.readBets=bets.slice(saved);
    if(!cur.readBets.length){cur.readName='';hydrateLedger().then(()=>repaint());go('overview')}
    else repaint();
  }
  toast(problems.length
    ? saved+' of '+bets.length+' saved. '+problems[0]
    : saved+' bet'+(saved===1?'':'s')+' saved.');
}

/* Drag and drop, bound once. The dragover default has to be cancelled or the
   browser navigates to the file instead of handing it over, which looks
   exactly like the drop being ignored. */
let dropBound=false;
function bindDrop(){
  if(dropBound)return;dropBound=true;
  const zone=()=>ph.querySelector('[data-pick]');
  on(document,'dragover',e=>{if(zone()&&e.dataTransfer){e.preventDefault();e.dataTransfer.dropEffect='copy';
    const z=zone();if(z)z.style.borderColor='var(--s)'}});
  on(document,'dragleave',()=>{const z=zone();if(z)z.style.borderColor=''});
  on(document,'drop',e=>{
    const z=zone();if(!z)return;
    e.preventDefault();z.style.borderColor='';
    if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length)readSlips(e.dataTransfer.files);
  });
  on(document,'change',e=>{
    const inp=e.target.closest&&e.target.closest('[data-slipinput]');
    if(!inp||!inp.files||!inp.files.length)return;
    const files=inp.files;
    /* Cleared so choosing the same file twice fires change the second time. */
    readSlips(files).finally(()=>{inp.value=''});
  });
}

/* 24 · Its own key, read by a blocking script in the document head before
   first paint. Without it seven of the eight themes flashed carbon. */
function rememberTheme(t){try{localStorage.setItem('slippery.theme',t)}catch{}}

let navRO=null;
let navMQ=null,navSet=null;
function measureNav(){
 const bar=ph.querySelector('.navbar');
 if(!bar){ph.style.removeProperty('--navh');return}
 /* Only a bar pinned across the bottom steals space from the scroller. At
  * and above 1000px the same element is a full-height sidebar beside the
  * content, and measuring it there wrote a 900px bottom padding into the
  * scroller — most of a screen of blank below the last card. */
 const set=()=>{
  if(getComputedStyle(bar).position!=='fixed'){ph.style.setProperty('--navh','0px');return}
  const h=Math.ceil(bar.getBoundingClientRect().height);if(h)ph.style.setProperty('--navh',h+'px')};
 set();
 if(navRO)navRO.disconnect();
 navRO=new ResizeObserver(set);
 navRO.observe(bar);
 /* Crossing 1000px swaps fixed bar for sticky sidebar without changing its
  * box, so the observer alone would not fire. */
 navSet=set;
 if(!navMQ){navMQ=matchMedia('(min-width:1000px)');navMQ.addEventListener('change',()=>navSet&&navSet());}
}

/* MARK WHAT IS NOT READY, ONCE PER PAINT.
 *
 * The action table is the single record of what each control does. Reading
 * it here means the interface cannot claim something works when the table
 * says it does not, and a control implemented later stops being marked the
 * moment its entry becomes a function. */
function markNotBuilt(root){
 root.querySelectorAll('[data-toast]').forEach(el=>{
  const a=ACTIONS[ACTION_KEY(el.dataset.toast)];
  const ready=typeof a==='function';
  /* The badge exists so a control cannot pretend to work. Where the copy
     beside it already says the same thing — the two store badges sit above
     "Coming soon to iOS and Android" — a second notice is not more honest,
     it is just louder. The control stays disabled and still announces
     itself to a screen reader. */
  const stated=el.closest('.storeb')!==null;
  el.toggleAttribute('data-notbuilt',!ready&&!stated);
  if(!ready)el.setAttribute('aria-disabled','true');else el.removeAttribute('aria-disabled');
 });
}

/* 17 · A real link code, asked for when the sheet opens rather than baked in.
   Fetched once per sheet opening: the code has a 15-minute life, so caching
   it across a session would show somebody an expired one. */
let linkCodeInFlight=false;
function fillLinkCode(){
 const el=ph.querySelector('[data-linkcode]');
 if(!el||cur.linkCode||linkCodeInFlight)return;
 linkCodeInFlight=true;
 fetch('/api/telegram/link',{method:'POST',credentials:'same-origin'})
  .then(r=>r.ok?r.json():null)
  .then(j=>{linkCodeInFlight=false;
   const code=j&&(j.code||j.linkCode);
   if(!code)return;
   cur.linkCode=code;
   const node=ph.querySelector('[data-linkcode]');
   if(node)node.textContent=code;})
  .catch(()=>{linkCodeInFlight=false;
   const node=ph.querySelector('[data-linkcode]');
   /* Say so rather than leaving a shimmer forever. */
   if(node)node.textContent='—';
   toast('Could not fetch a link code.')});
}

function boot(){
 fillLinkCode();
 nameControls(document);
 markNotBuilt(document);
 measureNav();
 bindDrop();
 bindFilms();
 /* The Continue button must be right the moment the screen is drawn, not
    only after somebody has touched something. */
 checkDocs();
 document.querySelectorAll('[data-cal]:not([data-d])').forEach(el=>{el.setAttribute('data-d',1);
  /* 'auto' used to mean a single week on a phone. Seven 44px columns fit at
     390px, so auto is always the month now and the Expand button is gone. */
  const md=el.dataset.cal==='auto'?'month':el.dataset.cal;buildCal(el,md);
  [...el.querySelectorAll('.c')].forEach((c,i)=>setTimeout(()=>c.classList.add('in'),i*16));});
 document.querySelectorAll('.fill:not([data-d]),.pacebar .f:not([data-d])').forEach(el=>{el.setAttribute('data-d',1);setTimeout(()=>el.style.width=el.dataset.w+'%',130);});
 document.querySelectorAll('[data-count]:not([data-d])').forEach(el=>{el.setAttribute('data-d',1);countUp(el,+el.dataset.count);});
 /* Two kinds of bar now: the vertical ones grow in height, the staking
    plot's horizontal ones grow in width. Each declares which. */
 document.querySelectorAll('[data-bar]:not([data-d])').forEach((el,i)=>{el.setAttribute('data-d',1);
  const w=el.style.getPropertyValue('--tw');
  if(w){setTimeout(()=>el.style.width=w,90+i*55);return}
  el.style.transition='height .7s var(--e)';
  setTimeout(()=>el.style.height=el.style.getPropertyValue('--th'),90+i*55);});
 document.querySelectorAll('[data-draw]:not([data-d])').forEach(el=>{el.setAttribute('data-d',1);
  const L=el.getTotalLength?el.getTotalLength():600;el.style.strokeDasharray=L;el.style.strokeDashoffset=L;
  el.style.transition='stroke-dashoffset 1.4s var(--e)';setTimeout(()=>el.style.strokeDashoffset=0,120);});
 requestAnimationFrame(()=>{allInds();fitSnaps();deckFit();});setTimeout(deckFit,340);}

let revIO=null;
/* REVEALING A SECTION AND ANIMATING IT ARE TWO DIFFERENT QUESTIONS.
 *
 * `.in` is one way on purpose: once a section has appeared it must not
 * disappear again when you scroll back up. `.offscreen` toggles both ways,
 * because its whole point is to stop paying for motion nobody can see.
 *
 * ROOT IS THE VIEWPORT, NOT THE SCROLLER. The marketing pages scroll the
 * document now, and an observer rooted on an element that is not a scroll
 * container never fires at all. The viewport is right either way:
 * intersection is computed through the clipping ancestors. */
function revealOn(){const root=ph.querySelector('.body');if(!root)return;
 if(revIO)revIO.disconnect();
 const els=[...root.querySelectorAll('.lsec,.lfoot,.lhero')];
 if(!els.length)return;
 revIO=new IntersectionObserver(es=>es.forEach(e=>{
  e.target.classList.toggle('offscreen',!e.isIntersecting);
  if(e.isIntersecting)e.target.classList.add('in');
 }),{rootMargin:'120px 0px',threshold:0});
 els.forEach((el,i)=>{
  el.classList.add('reveal');
  if(i<2)el.classList.add('in');else el.classList.add('offscreen');
  revIO.observe(el);
 })}

/* A locked phone or a background tab should be doing nothing at all. */
doc.addEventListener('visibilitychange',()=>{
 document.documentElement.toggleAttribute('data-hidden',document.hidden);
 if(document.hidden)clearT();else paint();
});
function fitSnaps(){
 document.querySelectorAll('[data-snapcal]:not([data-sd])').forEach(c=>{c.setAttribute('data-sd',1);
  buildCal(c,c.dataset.snapcal);[...c.querySelectorAll('.c')].forEach(x=>x.classList.add('in'))});
 document.querySelectorAll('[data-snap]').forEach(el=>{
  const box=el.parentElement;let w=box.clientWidth,h=box.clientHeight;
  const frame=el.closest('.snapframe');
  if(frame){w=frame.clientWidth;h=frame.clientHeight}
  if(!w||!h)return;
  el.style.width='390px';el.style.transform='none';el.style.left='0px';
  const ch=el.scrollHeight||el.offsetHeight||1;
  /* framed snaps scale on width alone, so the frame crops the bottom */
  const k=frame?Math.min(1,w/390):Math.min(w/390,h/ch);
  el.style.transform=`scale(${k})`;
  el.style.left=Math.max(0,(w-390*k)/2)+'px';
  box.style.overflow='hidden';});}

function runRead(){const dots=document.querySelectorAll('#rddots i');if(!dots.length)return;
 const m=['Selections','Odds and stake','Fixtures'],msg=document.getElementById('readmsg');
 dots.forEach((d,i)=>T.push(setTimeout(()=>{d.classList.add('on');if(msg)msg.textContent=m[i];},600+i*1100)));
 T.push(setTimeout(()=>{const s=document.getElementById('rdslip');if(s)s.classList.remove('scanning');
  if(msg)msg.textContent='Done';},600+3*1100));}
/* The landing page's two remaining timed effects. The slip carousel and the
   six-scene film deck that used to run here are Remotion films now: they
   were most of the page's infinite animation, each with its own timer,
   arrows and dots, and no two of them moved the same way. */
function paint(){clearT();runRead();}

/* ═══ guided tutorial ═══ */
const TUT=[
 ['overview','[data-cardid=net]','Your record, honestly','Net, units and turnover for the period you pick. Everything else on this page explains this number.'],
 ['overview','.runpill','What is still open','Money at risk right now, and anything needing a decision. It clears itself as bets settle.'],
 ['overview','.navbar [data-go="import"]','Add a bet','Forward a slip to the bot, or add one here. That is the whole job.']];
let tutI=0,tutOn=false;
function startTut(){tutI=0;tutOn=true;
 document.querySelector('.tut')?.remove();
 document.body.insertAdjacentHTML('beforeend',`<div class="tut" role="dialog" aria-modal="true" aria-labelledby="tutH">
  <div class="tutdim"></div><div class="spot"></div>
  <div class="tutbox"><h4 id="tutH"></h4><p></p><div class="tutnav"><span class="prog"></span>
  <button class="btn ghost sm" data-tutskip>Skip</button><button class="btn sm" data-tutnext>Next</button></div></div></div>`);
 lockBg(true);
 requestAnimationFrame(()=>{document.querySelector('.tut').classList.add('on');stepTut()})}

function tutTarget(sel){const all=[...ph.querySelectorAll(sel)];
 return all.find(e=>{const r=e.getBoundingClientRect();
  return e.offsetParent!==null&&r.width>24&&r.height>18&&getComputedStyle(e).visibility!=='hidden'})||null}

function tutPaint(){
 const t=document.querySelector('.tut');if(!t)return;
 const st=TUT[tutI],spot=t.querySelector('.spot'),box=t.querySelector('.tutbox');
 ph.querySelectorAll('.tuthi').forEach(x=>x.classList.remove('tuthi'));
 t.querySelector('h4').textContent=st[2];
 t.querySelector('p').textContent=st[3];
 t.querySelector('.prog').textContent=`${tutI+1} of ${TUT.length}`;
 t.querySelector('[data-tutnext]').textContent=tutI===TUT.length-1?'Finish':'Next';
 const el=tutTarget(st[1]);
 if(!el){spot.style.opacity=0;box.style.top='';box.style.bottom='24px';return}
 el.classList.add('tuthi');
 const sc=ph.querySelector('.body'),r0=el.getBoundingClientRect();
 if(r0.top<80||r0.bottom>innerHeight-80){
  if(sc&&sc.scrollHeight>sc.clientHeight+4)sc.scrollTop+=r0.top-innerHeight/2+r0.height/2;
  else scrollBy(0,r0.top-innerHeight/2+r0.height/2)}
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  const r=el.getBoundingClientRect();
  spot.style.opacity=1;
  spot.style.left=(r.left-6)+'px';spot.style.top=(r.top-6)+'px';
  spot.style.width=(r.width+12)+'px';spot.style.height=(r.height+12)+'px';
  const bh=box.offsetHeight||170,gap=14,below=r.bottom+gap,above=r.top-bh-gap;
  box.style.bottom='';
  box.style.top=(below+bh<innerHeight-16?below:(above>16?above:Math.max(16,innerHeight-bh-16)))+'px'}))}

function stepTut(){const st=TUT[tutI];
 if(cur.view!==st[0]){go(st[0]);setTimeout(tutPaint,320)}else tutPaint()}

doc.addEventListener('click',e=>{
 if(e.target.closest('[data-tutnext]')){tutI++;
  if(tutI>=TUT.length){endTut();toast('Tutorial complete')}else stepTut();return}
 if(e.target.closest('[data-tutskip]')){endTut();return}});

function endTut(){tutOn=false;lockBg(false);
 ph.querySelectorAll('.tuthi').forEach(x=>x.classList.remove('tuthi'));
 const t=document.querySelector('.tut');
 if(t){t.classList.remove('on');setTimeout(()=>t.remove(),380)}}
doc.addEventListener('input',e=>{const sl=e.target.closest('[data-cashslider]');if(!sl)return;
 cur.cashF=+sl.value;const sh=ph.querySelector('.sheet');
 if(sh){const y=sh.scrollTop;sh.innerHTML='<div class="grab"></div>'+SH.cashout();sh.scrollTop=y}});
/* fixture autofill: debounced prefix match over the bundled list */
let acT=null;
doc.addEventListener('input',e=>{
 const inp=e.target.closest('[data-ac]');if(!inp)return;
 clearTimeout(acT);
 acT=setTimeout(()=>{
  const list=document.getElementById('acList');if(!list)return;
  const q=inp.value.trim().toLowerCase();
  if(q.length<2){list.hidden=true;list.innerHTML='';return}
  const hits=FIXTURES.filter(f=>f[0].toLowerCase().includes(q)||f[2].toLowerCase().includes(q)).slice(0,6);
  list.hidden=false;
  list.innerHTML=hits.length?hits.map(f=>`<button class="acrow" data-fixture="${f[0]}|${f[3]}">
    <span><b>${f[0]}</b><span>${f[1]} · ${f[2]}</span></span><span class="pill">${f[3]}</span></button>`).join('')
   :`<div class="acnone">No fixture found. Type it out and it will still save.</div>`;
 },140)});
doc.addEventListener('click',e=>{
 const row=e.target.closest('[data-fixture]');
 if(row){const [name,sport]=row.dataset.fixture.split('|');
  const inp=document.getElementById('evIn');if(inp)inp.value=name;
  const list=document.getElementById('acList');if(list){list.hidden=true;list.innerHTML=''}
  const dl=document.getElementById('mkList');
  if(dl)dl.innerHTML=(MARKETS[sport]||[]).map(m=>`<option value="${m}">`).join('');
  const sel=document.getElementById('selIn');if(sel){sel.placeholder='Pick a market, or type your own';sel.focus()}
  toast(sport+' markets loaded');return}
 if(!e.target.closest('.acwrap')){const l=document.getElementById('acList');if(l){l.hidden=true}}});
win.addEventListener('resize',()=>{allInds();fitSnaps();deckFit()});


  /* Restored before anything is drawn, so there is no flash of the default
     theme for somebody who chose another one. The server overwrites this the
     moment /api/me answers for a signed-in account: local is a convenience
     for a visitor, never a second source of truth. */
  Object.assign(cur, loadStored());
  if (cur.theme) { ph.dataset.t = cur.theme; document.body.dataset.t = cur.theme; }

  /* THE HERO ENTRANCE. One of three, switchable at runtime for comparison.
     `slip` is the default: see the note in proto.css. */
  document.documentElement.dataset.heroanim = cur.heroAnim || 'slip';

  /* A promoted layer is worth having for 560ms and not worth carrying down
     five thousand pixels of page afterwards. */
  doc.addEventListener('animationend', (e) => {
    const el = e.target;
    if (el instanceof HTMLElement && el.matches('.lh1 em')) el.style.willChange = 'auto';
  });

  onReady({
    go,
    sheet,
    toast,
    closeSheet,
    repaint,
    cur,
    views: V,
    sheets: SH,
    groups: GROUPS,
    setTheme(t) { cur.theme = t; ph.dataset.t = t; document.body.dataset.t = t;
      document.documentElement.dataset.t = t; rememberTheme(t) },
    startTutorial() { startTut(); },
    tutorialSteps: TUT.length,
    /* Replaces the worked example with the account's own record. */
    hydrateLedger,
    /* Exposed so the three hero entrances can be compared in a real browser
       rather than argued about from a diff. */
    setHeroAnim(name) {
      cur.heroAnim = name;
      document.documentElement.dataset.heroanim = name;
      const em = ph.querySelector('.lh1 em');
      if (em) { const p = em.parentElement; p.replaceChild(em.cloneNode(true), em); }
    },
    hydrate(patch) { Object.assign(cur, patch); },
  });
  return () => { clearT(); bound.forEach(([t, ty, fn, o]) => t.removeEventListener(ty, fn, o)); };
}
