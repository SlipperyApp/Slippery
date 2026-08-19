/* Slippery view layer.
 *
 * Ported verbatim from the approved prototype: all 35 views, all sheets, the
 * eight themes, every string. The prototype rendered into a phone frame driven
 * by a harness toolbar; here the same render layer is mounted into the real
 * page and `go()` is wired to the router, so every screen has a URL, the back
 * button works, and a sheet is linkable.
 *
 * The layer is deliberately a pure function of one state object rather than a
 * component tree. That is how the prototype was specified and reviewed, and
 * rewriting 2000 lines of final copy into JSX is the one change guaranteed to
 * lose a string. React owns mounting, routing and data; this owns painting.
 */
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
const MARK=`<span class="mark"><svg viewBox="0 0 64 64"><path d="M43 21c-2.2-3.3-6-4.9-10-4.9-5.1 0-8.9 2.5-8.9 6.4 0 3.5 2.8 5.3 8.5 6.4l2 .4c5.5 1.2 8.3 3 8.3 6.5 0 3.9-3.8 6.7-9.3 6.7-4.5 0-8.3-1.8-10.5-5.3"/></svg></span>`;
const DAYVALS={1:186,3:-58,5:264,7:-96,8:64,10:212,12:-74,13:148,15:-41,16:238,18:229,19:112};
const DSUM=ks=>ks.reduce((t,k)=>t+(DAYVALS[k]||0),0);
const MTD=DSUM(Object.keys(DAYVALS).map(Number));
const WTD=DSUM([17,18,19,20,21,22,23]);
const TDY=DAYVALS[19];
const CURVE=(()=>{let t=0;return Array.from({length:19},(_,i)=>{t+=DAYVALS[i+1]||0;return t})})();
const TG='<svg class="i"><use href="#tgi"/></svg>';
/* The label belongs on the svg, which has role="img" and can carry it. On
   the span it was both ignored and reported: aria-label is prohibited on an
   element with no role. */
const APPLEBADGE=`<span class="badgelink">
<svg viewBox="0 0 120 40" role="img" aria-label="Download on the App Store"><rect x=".5" y=".5" width="119" height="39" rx="7" fill="#000" stroke="#A6A6A6"/>
<path fill="#fff" d="M24.77 20.3a4.95 4.95 0 0 1 2.36-4.15 5.07 5.07 0 0 0-4-2.16c-1.7-.18-3.46 1-4.39 1-.95 0-2.4-.97-3.94-.94a5.32 5.32 0 0 0-4.47 2.72c-1.9 3.3-.49 8.19 1.36 10.87.9 1.31 1.98 2.78 3.4 2.73 1.36-.06 1.88-.88 3.53-.88 1.63 0 2.1.88 3.54.85 1.46-.03 2.4-1.33 3.3-2.65a11 11 0 0 0 1.5-3.06 4.78 4.78 0 0 1-2.9-4.38zM22.04 12.2a4.87 4.87 0 0 0 1.11-3.49 4.96 4.96 0 0 0-3.2 1.65 4.64 4.64 0 0 0-1.14 3.36 4.1 4.1 0 0 0 3.23-1.52z"/>
<text x="41" y="14.5" fill="#fff" font-family="Helvetica,Arial,sans-serif" font-size="8">Download on the</text>
<text x="41" y="30" fill="#fff" font-family="Helvetica,Arial,sans-serif" font-size="16.5" font-weight="500">App Store</text></svg></span>`;
const PLAYBADGE=`<span class="badgelink">
<svg viewBox="0 0 152 40" role="img" aria-label="Get it on Google Play"><rect x=".5" y=".5" width="151" height="39" rx="7" fill="#000" stroke="#A6A6A6"/>
<g transform="translate(11 9.6) scale(.0448)">
<path fill="#3BCCFF" d="M9.6 3.4A7.7 7.7 0 0 0 7.8 8.8v442.4c0 2.1.7 4 1.8 5.4l232.7-226.6z"/>
<path fill="#FFD400" d="M319.6 305.6l-77.3-75.6-77.3 75.6 77.3 75.3z" transform="translate(0 -75.3)"/>
<path fill="#FF3333" d="M319.6 305.6L164.9 456.6c8.1 5.2 18.4 5.5 27-.3l127.7-72.6z" transform="translate(0 -75.3)"/>
<path fill="#48FF48" d="M164.9 3.4l154.7 151-127.7-72.6c-8.6-5.8-18.9-5.5-27-.3z" transform="translate(0 0)"/></g>
<text x="47" y="15" fill="#fff" font-family="Helvetica,Arial,sans-serif" font-size="7.5" letter-spacing=".6">GET IT ON</text>
<text x="46" y="31" fill="#fff" font-family="Helvetica,Arial,sans-serif" font-size="16.5" font-weight="500">Google Play</text></svg></span>`;
const BRAND=`<button class="brand" data-home>${MARK}<span>Slipp<em>ery</em></span></button>`;
const TRIAL={base:'5 days or 15 slips',ref:'14 days or 40 slips'};
/* Offered at signup, grouped by platform because brands on one platform
   share a slip layout and therefore read the same way.
   bet365 and BetVictor were missing from the prototype's list. bet365 is the
   one bookmaker in the product that grades Asian handicaps, where a whole
   line pushes rather than losing, so leaving it unpickable meant the single
   most consequential settlement rule could never be reached. */
const BOOKS=[['Flutter',['Paddy Power','Betfair Sportsbook','Sky Bet','PokerStars']],
 ['Kambi',['LiveScore Bet','Virgin Bet','LeoVegas','Unibet','Mr Green','BetMGM UK','BetUK','Expekt','Bally Bet','Monopoly Casino & Sports','Jackpotjoy Sports','Rainbow Riches','Grosvenor Sport','Casumo']],
 ['Other',['bet365','Ladbrokes','Coral','bwin','32Red','William Hill','888sport','Betfred','BetVictor','BoyleSports','Betfair Exchange','Smarkets']]];
const PERLIST=[['today','Today'],['W','This week'],['M','This month'],['Y','This year'],['All','All time']];
const PERIODS={today:{net:TDY,bets:3,units:TDY/25,to:75,void:0,tgt:100,pace:.5,lab:'today'},
 W:{net:WTD,bets:12,units:WTD/25,to:390,void:25,tgt:400,pace:.71,lab:'this week'},
 M:{net:MTD,bets:96,units:MTD/25,to:3180,void:80,tgt:2000,pace:.61,lab:'this month'},
 Y:{net:3171,bets:412,units:126.84,to:14200,void:410,tgt:6000,pace:.63,lab:'this year'},
 All:{net:3171,bets:412,units:126.84,to:14200,void:410,tgt:0,pace:0,lab:'all time'}};
function BETSFOR(d){const v=DAYVALS[d]||0,n=v>0?3:2,st=n*30,rt=st+v;
 const rows=(v>0?[['w','Bayern v Villa','Bayern −1 · 2.87 · £50 · Coral','+£93.50'],['l','Slavia v Sparta','Slavia · 2.10 · £30 · Coral','−£30.00'],['w','York 16:10','Selection 9 · 2.35 · £25 · Sky Bet','+£33.75']]
  :[['l','Inter v Milan','Inter · 3.19 · £25 · Sky Bet','−£25.00'],['l','Sevilla v Man Utd','Sevilla · 2.24 · £25 · Betfred','−£25.00']])
  .map(b=>`<div class="bet"><div class="o ${b[0]}">${b[0]==='w'?'✓':'✕'}</div><div class="m"><div class="n" style="font-size:13px">${b[1]}</div><div class="d">${b[2]}</div></div><div class="v" style="color:var(--${b[0]==='w'?'pos':'neg'})">${b[3]}</div></div>`).join('');
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
 ['What other users can see',['Inside a group: your display name, your figures in units, and your unit size.',
  'Outside a group, per your privacy setting: nothing on Private, units and ROI to people you follow back on Friends only, or to anyone on Public.',
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
 ['Home win',['Asian Handicap Home −0.5','Double Chance X2 No','Away or Draw No','Winning Margin Home 1+']],
 ['Away win',['Asian Handicap Away −0.5','Double Chance 1X No','Home or Draw No']],
 ['Draw',['Double Chance 12 No','Winning Margin Draw','Home Win No + Away Win No']],
 ['Home or draw',['Double Chance 1X','Asian Handicap Home +0.5','Away Win No']],
 ['Draw or away',['Double Chance X2','Asian Handicap Away +0.5','Home Win No']],
 ['Home or away',['Double Chance 12','Draw No']],
 ['Draw no bet, home',['Asian Handicap Home 0']],
 ['Both teams to score',['BTTS Yes','Both teams Over 0.5','Neither Clean Sheet','Home Score Yes + Away Score Yes']],
 ['Both teams to score, no',['BTTS No','Away Goals 0','Home Goals 0','Home Clean Sheet','Away Clean Sheet','Either Team Clean Sheet','Team Total Under 0.5','Win to Nil']],
 ['Overs',['Over 2.5','Goals Range 3+','Under 2.5 No','Asian Total Over 2.5']],
 ['Unders',['Under 2.5','Goals Range 0-2','Over 2.5 No']],
 ['0-0',['Under 0.5','Total Goals 0','Any Goalscorer No','First Team to Score: No Goal','Race to 1 Goal: Neither']],
 ['Over 0.5 goals',['Goals Range 1+','0-0 No','Any Goalscorer Yes']],
 ['Home win to nil',['Home Win + Away Goals 0','Result & BTTS: Home & No']],
 ['Away win to nil',['Away Win + Home Goals 0','Result & BTTS: Away & No']],
 ['Score draw',['Draw & BTTS Yes','Draw & Over 0.5']],
 ['Home −1.5',['Home by 2+','Winning Margin Home 2+','European Handicap Home −1 win']],
 ['Home to score',['Home Team Over 0.5','Away Clean Sheet No','Home Goals 1+']],
 ['Away to score',['Away Team Over 0.5','Home Clean Sheet No','Away Goals 1+']],
 ['Home scores first',['First Team to Score Home','Race to 1 Goal Home','Opening Goal Home']],
 ['Player to score',['Anytime Goalscorer','Player Over 0.5 Goals','Player 1+ Goals']],
 ['Player 2+ goals',['Player Over 1.5 Goals','Brace or better']],
 ['Player hat-trick',['Player Over 2.5 Goals','Player 3+ Goals']],
 ['Player carded',['Player to be Booked','Player Over 0.5 Cards']],
 ['Red card',['Total Reds Over 0.5','Sending Off Yes']],
 ['Home leads at half time',['1st Half Result Home','Half Time Result Home','1st Half AH Home −0.5']],
 ['Corners over 9.5',['Under 9.5 No','Corners Range 10+']]];
const bets=[
 ['w','Arsenal v Spurs','Arsenal to win','Match result',1.90,10,19,'+£9.00','+0.36u','bet365','Own picks','Screenshot','9 Aug 2026, 13:00',1,null],
 ['l','Inter v Milan','Inter','Match result',3.19,25,0,'−£25.00','−1.00u','Sky Bet','BlueSlip','Telegram','18 Aug 2026, 19:45',0,null],
 ['w','Monaco v Roma','Both teams to score','Both teams to score',2.51,25,62.75,'+£37.75','+1.51u','Betfred','Own picks','Telegram','18 Aug 2026, 20:00',0,null],
 ['l','Brentford v Wolves','Brentford','Match result',2.57,50,0,'−£50.00','−2.00u','Ladbrokes','Own picks','Screenshot','17 Aug 2026, 15:00',0,null],
 ['w','Juventus v Cremonese','4 legs, one fixture','Multiple',1.80,100,180,'+£80.00','+3.20u','bet365','Own picks','Telegram','19 Aug 2026, 19:12',0,
  [['Under 4 Cards','Total cards','w'],['Under 4.5 Shots on Target','Cremonese','w'],['Under 11.5 Shots','Cremonese','w'],['Juventus to win','Match result','w']]],
 ['l','Sevilla v Man Utd','Sevilla','Match result',2.24,25,0,'−£25.00','−1.00u','Betfred','KerryEdge','Telegram','17 Aug 2026, 20:00',0,null],
 ['a','York 16:10','Selection 9','Win',2.35,25,44,'+£19.00','+0.76u','Sky Bet','Own picks','Screenshot','16 Aug 2026, 16:10',0,null],
 ['l','Rublev v Fritz','Rublev','Match winner',2.41,25,0,'−£25.00','−1.00u','Betfred','Own picks','Telegram','16 Aug 2026, 12:30',0,null],
 ['w','Köln v Augsburg','Under 3.5 Goals','Total goals',1.55,40,62,'+£22.00','+0.88u','Paddy Power','BlueSlip','Telegram','15 Aug 2026, 14:30',0,null],
 ['v','Slavia v Sparta','Slavia','Match result',2.10,30,30,'£0.00','0.00u','Coral','Own picks','Screenshot','14 Aug 2026, 17:00',0,null],
 ['w','Bayern v Villa','Bayern −1','Handicap',2.87,50,143.50,'+£93.50','+3.74u','Coral','FiveFolds','Telegram','13 Aug 2026, 20:00',0,null],
 ['a','West Ham v Everton','Over 2.5 Goals','Total goals',5.91,25,9,'−£16.00','−0.64u','Sky Bet','Own picks','Telegram','13 Aug 2026, 17:30',0,null]];
const money=n=>(n>0?'+£':n<0?'−£':'£')+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
function fmtOdds(d){if(cur.oddsFmt==='Fractional'){let bn=Math.round(d-1),bd=1,err=Math.abs(d-1-bn);
  for(let den=2;den<=50;den++){const num=Math.round((d-1)*den),e=Math.abs(d-1-num/den);if(e<err-1e-9){err=e;bn=num;bd=den}}
  return bn+'/'+bd}
 if(cur.oddsFmt==='American')return d>=2?'+'+Math.round((d-1)*100):String(Math.round(-100/(d-1)));
 return d.toFixed(2)}
function reOdds(txt){return txt.replace(/(^|[\s·])(\d+\.\d{2})(?=[\s·]|$)/g,(m,a,d)=>a+fmtOdds(parseFloat(d)))}
function showVal(mny,un,col){
 if(cur.showIn==='Units')return `<div class="v" style="color:var(--${col})">${un}</div>`;
 if(cur.showIn==='Both')return `<div class="v" style="color:var(--${col})">${mny}<small style="color:inherit;opacity:.7">${un}</small></div>`;
 return `<div class="v" style="color:var(--${col})">${mny}<small>${un}</small></div>`}
/* The four outcomes a row can be in.
   A void returns the stake for no profit, so it must not be green: green
   means profit and zero is not profit. A cash out takes the accent, because
   it is neither a win nor a loss but a decision. */
const OMARK={w:'✓',l:'✕',a:'~',v:'–'};
const OTONE={w:'pos',l:'neg',a:'a',v:'t3'};
const betRow=(b,i)=>`<button class="bet" data-bet="${i}">${cur.bulk?`<span style="width:18px;height:18px;border-radius:5px;flex:0 0 auto;margin-top:3px;border:1.5px solid ${i<3?'var(--pos)':'var(--line)'};background:${i<3?'color-mix(in srgb,var(--pos) 22%,transparent)':'none'};display:grid;place-items:center;font-size:10px;color:var(--pos)">${i<3?'✓':''}</span>`:`<div class="o ${b[0]}">${OMARK[b[0]]||'✕'}</div>`}
 <div class="m"><div class="n">${b[1]}${b[13]?'<span class="tag">IMPORTED</span>':''}</div>
  <div class="d">${b[2]} · ${fmtOdds(b[4])} · £${b[5].toFixed(2)} · ${b[9]}</div></div>
 ${showVal(b[7],b[8],OTONE[b[0]]||'neg')}</button>`;
/* Each row carries its own profit green and loss red, taken from that
   theme's own custom-property block.
   THE PREVIEW USED ONE GLOBAL GREEN AND SPECIAL-CASED ONLY "light", so the
   Linen card drew #86EFAC on #F5F1E8: a contrast of 1.24 to 1, which is
   invisible. That is exactly the reason there is no single global profit
   green, demonstrated by the control whose whole job is to show one. */
const THEMES=[
 ['periwinkle','Periwinkle','Indigo on deep navy. The default.','#0A0F1E','#6D86DB','#F2F5FA','#86EFAC','#FCA5A5'],
 ['ink','Ink','Near black, violet cast. The darkest.','#050508','#8B84C4','#F3F1FA','#86EFAC','#FCA5A5'],
 ['graphite','Graphite','No colour but the figures.','#121417','#8A99AE','#F1F3F6','#86EFAC','#FCA5A5'],
 ['slate','Slate','Steel blue-grey. The lightest dark.','#161A21','#7E93B5','#EEF2F7','#86EFAC','#FCA5A5'],
 ['tide','Tide','Pastel teal. The coolest.','#0D1E24','#8FCBD4','#EFF8FA','#86EFAC','#FCA5A5'],
 ['bronze','Bronze','Warm charcoal. The only warm dark.','#15120F','#C9915E','#F7F1EA','#86EFAC','#FCA5A5'],
 ['light','Light','Soft grey-white. Easy in daylight.','#EFF1F5','#5468BE','#1B2233','#0F6B42','#A32B3C'],
 ['linen','Linen','Warm paper. The gentlest.','#F5F1E8','#8A6A44','#2A2318','#136B45','#A33448']];
const CARDS=[['net','Net and target'],['cal','Calendar'],['recent','Recent bets'],['alltime','All time'],
 ['book','By bookmaker'],['market','By market'],['tips','By tipster'],['odds','By odds range'],['dow','By day of week'],['sport','By sport'],['comp','By competition'],['course','By course'],['curve','Profit over time'],['months','Month by month'],['stake','Staking discipline'],['tag','By tag']];
const cur={oddsFmt:'Decimal',showIn:'Currency',view:'landing',theme:'periwinkle',per:'M',calDates:true,weekStart:1,demoSeen:false,signedIn:false,
 running:4,risk:88,above:['net','cal','curve','recent'],order:['net','cal','curve','recent','alltime','months','stake','book','market','tips','tag','sport','comp','course','odds','dow']};
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
 return `<div class="card" data-cardid="net"><div class="hd"><span class="lbl" data-netlab>Net ${d.lab}</span>
  <span style="display:flex;gap:7px;align-items:center;flex:0 0 auto">
  <button class="iconb" data-sheet="share" aria-label="Share"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg></button>
  <button class="pill" data-sheet="period">${PERLIST.find(x=>x[0]===cur.per)[1]} ▾</button></span></div>
 <div class="big mono" data-count="${d.net}">+£0.00</div>
 <div class="row"><span>Bets <b>${d.bets}</b></span><span>Units <b class="mono">+${d.units.toFixed(2)}u</b></span>
  <span>Turnover <b>£${(d.to-d.void).toLocaleString('en-GB')}</b></span>
  <span>ROI <b class="mono" style="color:var(--pos)">+${(d.net/(d.to-d.void)*100).toFixed(1)}%</b></span></div>
 ${d.void?`<p class="note" style="margin:6px 0 0;font-size:11.5px">Turnover and ROI exclude £${d.void} of voided stakes.</p>`:''}
 ${tgt?`<div class="tgt"><div class="r1"><span style="color:var(--t3)">Target £${d.tgt.toLocaleString('en-GB')}</span>
   <span><b class="mono" style="color:${met?'var(--pos)':ahead?'var(--s)':'var(--a)'}">${pct}%</b>
   <span class="mono" style="margin-left:8px;color:var(--t3)">${met?'met':'£'+(d.tgt-d.net).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+' to go'}</span></span></div>
  <div class="pacebar"><div class="f" data-w="${pct}" style="background:${col}"></div>
   ${met?'':`<div class="pace" style="left:${Math.max(4,Math.min(96,Math.round(d.pace*100)))}%"></div>`}</div></div>`:''}
 </div>`}
function calCard(){return `<div class="card" data-cardid="cal"><div class="hd"><b data-caltitle>This week</b><button class="chip" data-cal-toggle>Expand month</button></div>
 <div class="calwrap" data-calwrap style="max-height:150px"><div class="cal" data-cal="week"></div></div>
 <div class="callegend"><span><i class="sw p"></i>Profitable</span><span><i class="sw n"></i>Losing</span><span><i class="sw z"></i>No bets</span></div></div>`}
function calCardMonth(){return `<div class="card" data-cardid="cal"><div class="hd"><b>August 2026</b><span class="chip">Collapse</span></div>
 <div class="cal" data-cal="month"></div>
 <div class="callegend"><span><i class="sw p"></i>Profitable</span><span><i class="sw n"></i>Losing</span><span><i class="sw z"></i>No bets</span></div></div>`}
function recentCard(){return `<div class="card" data-cardid="recent"><div class="hd"><b>Recent bets</b><button class="chip" data-go="ledger">View all</button></div>
 ${bets.slice(0,6).map(betRow).join('')}
 <button class="btn ghost full sm" style="margin-top:11px" data-go="ledger">See all ${bets.length} in the ledger</button></div>`}
function breakdown(id,title,rows){return `<div class="card" data-cardid="${id}"><div class="hd"><b>${title}</b><span class="lbl">${PERIODS[cur.per].lab}</span></div>
 ${rows.map(r=>`<div class="barline"><div class="h"><span>${r[0]}</span><b class="mono" style="color:var(--${r[3]?'neg':'pos'})">${r[1]}</b></div><div class="track"><div class="fill ${r[3]?'neg':''}" data-w="${r[2]}"></div></div></div>`).join('')}</div>`}
function alltimeCard(){return `<div class="card" data-cardid="alltime"><div class="lbl" style="margin-bottom:9px">All time</div>
 <div class="g2">${[['Net','+£3,171',1],['Units','+126.8u',0],['Win rate','41%',0],['ROI','+6.9%',1]].map(s=>`<div class="stat"><div class="k">${s[0]}</div><div class="v mono"${s[2]?' style="color:var(--pos)"':''}>${s[1]}</div></div>`).join('')}</div></div>`}
function bdCard(id,title,rows){return `<div class="card" data-cardid="${id}"><div class="hd"><b>${title}</b><span class="lbl">${PERIODS[cur.per].lab}</span></div>
 ${rows.map(r=>`<div class="barline"><div class="h"><span>${r[0]}</span><b class="mono" style="color:var(--${r[3]?'neg':'pos'})">${r[1]}</b></div><div class="track"><div class="fill ${r[3]?'neg':''}" data-w="${r[2]}"></div></div></div>`).join('')}</div>`}
function lineChart(vals,id){const w=300,h=110,pad=4;
 const mn=Math.min(0,...vals),mx=Math.max(...vals),rng=(mx-mn)||1;
 const X=i=>pad+i*(w-pad*2)/(vals.length-1), Y=v=>h-pad-((v-mn)/rng)*(h-pad*2);
 const pts=vals.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
 const area=`${pad},${Y(mn)} ${pts} ${w-pad},${Y(mn)}`;
 return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block;overflow:visible">
  <defs><linearGradient id="cg${id}" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="var(--p)" stop-opacity=".28"/><stop offset="1" stop-color="var(--p)" stop-opacity="0"/></linearGradient></defs>
  <line x1="${pad}" y1="${Y(0)}" x2="${w-pad}" y2="${Y(0)}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3"/>
  <polygon points="${area}" fill="url(#cg${id})"/>
  <polyline data-draw points="${pts}" fill="none" stroke="var(--s)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${X(vals.length-1)}" cy="${Y(vals[vals.length-1])}" r="3.4" fill="var(--s)"/></svg>`}
function stakeChart(rows,unit){const mx=Math.max(unit*1.9,...rows.map(r=>r[1]));
 const H=110,y=v=>H-(v/mx)*H;
 return `<div style="position:relative;height:${H}px;margin:10px 0 6px;padding-right:64px">
  <div style="position:absolute;left:0;right:64px;top:${y(unit).toFixed(1)}px;border-top:1.5px dashed color-mix(in srgb,var(--s) 85%,transparent)"></div>
  <span style="position:absolute;right:0;top:${(y(unit)-7).toFixed(1)}px;font-size:9.5px;color:var(--s);white-space:nowrap;letter-spacing:.02em">1 unit £${unit}</span>
  <div style="display:flex;align-items:flex-end;gap:7px;height:100%">
   ${rows.map(r=>{const hot=r[1]>unit,hh=(r[1]/mx)*H;
    return `<div data-bar title="${r[0]}: £${r[1]}" style="flex:1;height:0;--th:${hh.toFixed(1)}px;border-radius:4px 4px 2px 2px;
     background:${hot?'var(--a)':'var(--p)'};opacity:${hot?1:.7}"></div>`}).join('')}</div></div>
 <div style="display:flex;gap:7px;padding-right:64px">${rows.map((r,i)=>`<span style="flex:1;text-align:center;font-size:9.5px;color:var(--t4)">${i%2?'':r[0]}</span>`).join('')}</div>`}
function barChart(rows){const mx=Math.max(...rows.map(r=>Math.abs(r[1])))||1;
 return `<div style="display:flex;align-items:flex-end;gap:6px;height:104px;margin:4px 0 8px">
  ${rows.map(r=>{const pos=r[1]>=0,hh=Math.max(4,Math.abs(r[1])/mx*82);
   return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0">
    <div data-bar style="width:100%;max-width:26px;height:0;--th:${hh}px;border-radius:5px 5px 2px 2px;
     background:${pos?'linear-gradient(180deg,var(--s),var(--p))':'linear-gradient(180deg,var(--neg),color-mix(in srgb,var(--neg) 65%,#000))'}"></div>
    <span style="font-size:9px;color:var(--t4)">${r[0]}</span></div>`}).join('')}</div>`}
const CARDFN={net:netCard,cal:calCard,recent:recentCard,
 curve:()=>`<div class="card" data-cardid="curve"><div class="hd"><b>Profit over time</b><span class="lbl">${PERIODS[cur.per].lab}</span></div>
  ${lineChart(CURVE,'a')}
  <div class="row" style="margin-top:8px;font-size:11.5px"><span>Best run <b>6 days</b></span>
   <span>Worst drop <b class="mono" style="color:var(--neg)">−£96</b></span>
   <span>Now <b class="mono" style="color:var(--pos)">+£${MTD.toLocaleString('en-GB')}</b></span></div></div>`,
 months:()=>`<div class="card" data-cardid="months"><div class="hd"><b>Month by month</b><span class="lbl">Last 8</span></div>
  ${barChart([['Jan',210],['Feb',-96],['Mar',318],['Apr',142],['May',-54],['Jun',402],['Jul',188],['Aug',MTD]])}
  <div class="row" style="font-size:11.5px"><span>Profitable months <b>6 of 8</b></span>
   <span>Average <b class="mono" style="color:var(--pos)">+£${Math.round((210-96+318+142-54+402+188+MTD)/8)}</b></span></div></div>`,
 stake:()=>`<div class="card" data-cardid="stake"><div class="hd"><b>Staking discipline</b>
  <button class="iconb" data-sheet="wrong" aria-label="This looks wrong">?</button></div>
  ${stakeChart([['Wk1',25],['Wk2',25],['Wk3',28],['Wk4',34],['Wk5',31],['Wk6',48],['Wk7',42],['Wk8',26]],25)}
  <div class="g3" style="margin-top:10px"><div class="stat"><div class="k">Average</div><div class="v mono">£32</div></div>
   <div class="stat"><div class="k">Your unit</div><div class="v mono">£25</div></div>
   <div class="stat"><div class="k">Biggest week</div><div class="v mono" style="color:var(--a)">1.9u</div></div></div>
  </div>`,
 tag:()=>breakdown('tag','By tag',[['Team news edge','£268',68,0],['Live in-play','£142',36,0],['Tipster fade','£88',22,0],['Chasing','−£174',44,1]]),
 comp:()=>breakdown('comp','By competition',[['Premier League','£384',74,0],['Champions League','£212',41,0],['Serie A','£148',29,0],['Championship','−£71',14,1]]),
 course:()=>breakdown('course','By course',[['York','£142',72,0],['Kempton','£96',49,0],['Ascot','£54',27,0],['Newmarket','−£38',19,1]]),
 odds:()=>bdCard('odds','By odds range',[['1.00 – 1.50','£96',20,0],['1.51 – 2.00','£438',66,0],['2.01 – 3.00','£512',78,0],['3.01 – 5.00','−£41',9,1],['5.00 +','−£120',18,1]]),
 dow:()=>bdCard('dow','By day of week',[['Saturday','£604',88,0],['Sunday','£301',46,0],['Wednesday','£188',29,0],['Tuesday','−£74',12,1]]),
 sport:()=>bdCard('sport','By sport',[['Football','£812',86,0],['Horse racing','£262',31,0],['Tennis','−£58',9,1]]),
 book:()=>breakdown('book','By bookmaker',[['bet365','£742',88,0],['Sky Bet','£310',42,0],['Ladbrokes','−£96',14,1]]),
 market:()=>breakdown('market','By market',[['Home win','£412',72,0],['Both teams to score','£268',47,0],['Overs','£141',25,0],['Player to score','£96',17,0],['Unders','−£62',11,1]]),
 tips:()=>breakdown('tips','By tipster',[['Own picks','£552',82,0],['BlueSlip','£404',62,0]]),
 alltime:alltimeCard};


V.overview={nav:'dash',tab:'OVERVIEW',run:1,html:()=>{
 const top=cur.order.filter(k=>cur.above.includes(k)),more=cur.order.filter(k=>!cur.above.includes(k));
 return `<div class="pane">${top.map(k=>CARDFN[k]()).join('')}
 ${more.length?`<details class="disc"><summary style="border:0;justify-content:flex-end;gap:8px"><span class="caret">▾</span><b style="font-size:14px">Show more</b></summary>
  <div style="margin-top:9px">${more.map(k=>CARDFN[k]()).join('')}</div></details>`:''}
 <button class="btn ghost full sm" style="margin-top:6px" data-sheet="editov">Edit overview</button></div>`}};

/* ═══ LANDING ═══ */
const WAVES=`<div class="waves" aria-hidden="true"><svg viewBox="0 0 1440 300" preserveAspectRatio="none"><defs>
 <linearGradient id="ga" x1="0" x2="1"><stop offset="0" stop-color="#6D86DB" stop-opacity="0"/><stop offset=".3" stop-color="#8DA4F5"/><stop offset=".66" stop-color="#8FD0FB"/><stop offset="1" stop-color="#6D86DB" stop-opacity="0"/></linearGradient>
 <linearGradient id="gb" x1="0" x2="1"><stop offset="0" stop-color="#46BEFA" stop-opacity="0"/><stop offset=".42" stop-color="#5CC8FF"/><stop offset=".8" stop-color="#8DA4F5"/><stop offset="1" stop-color="#6D86DB" stop-opacity="0"/></linearGradient>
 <filter id="b1" x="-40%" y="-200%" width="180%" height="500%"><feGaussianBlur stdDeviation="1.3"/></filter>
 <filter id="b2" x="-40%" y="-200%" width="180%" height="500%"><feGaussianBlur stdDeviation="3.6"/></filter></defs>
 <g filter="url(#b1)"><path class="rb rb1" d="M-200 140C180 80 460 210 740 120S1240 50 1640 130" stroke="url(#ga)" stroke-width="15" fill="none" stroke-linecap="round"/>
 <path class="rb rb2" d="M-200 195C250 255 520 100 820 180S1280 240 1640 155" stroke="url(#gb)" stroke-width="11" fill="none" stroke-linecap="round"/></g>
 <g filter="url(#b2)"><path class="rb rb3" d="M-200 95C300 165 560 45 900 110S1300 165 1640 90" stroke="url(#ga)" stroke-width="20" fill="none" stroke-linecap="round"/>
 <path class="rb rb4" d="M-200 235C340 185 640 275 980 220S1340 175 1640 230" stroke="url(#gb)" stroke-width="24" fill="none" stroke-linecap="round"/></g></svg></div>`;

const SLIPS=[
 {k:'w',t:'4 legs · bet365',stake:'100.00',ret:'180.00',vd:'WON · +£80.00',
  legs:[['Under 4 Cards','Total cards','w'],['Under 4.5 Shots on Target','Cremonese','w'],['Under 11.5 Shots','Cremonese','w'],['Juventus to win','Match result','w']]},
 {k:'x',t:'3 legs · Sky Bet',stake:'40.00',ret:'0.00',vd:'LOST · −£40.00',
  legs:[['Arsenal to win','Match result','w'],['Over 2.5 Goals','Leeds v Burnley','w'],['Sinner to win','Match winner','x']]},
 {k:'c',t:'Single · Betfred',stake:'50.00',ret:'71.20',vd:'CASHED OUT · +£21.20',
  legs:[['Liverpool to win','Match result','w']]},
 {k:'v',t:'Single · Coral',stake:'25.00',ret:'25.00',vd:'VOID · £0.00 · stake returned',
  legs:[['Selection 4, Kempton 19:45','Non-runner','v']]}];
const slipHTML=i=>{const S=SLIPS[i],col=S.k==='w'?'pos':S.k==='x'?'neg':S.k==='c'?'a':'t2';
 return `<div class="slip scanning" data-slip><div class="scanbar"></div>
 <div class="hd" style="margin-bottom:7px"><b style="font-size:13px">${S.t}</b><span class="tag">${S.legs.length} LEG${S.legs.length>1?'S':''}</span></div>
 ${S.legs.map(l=>`<div class="leg" data-leg data-r="${l[2]}"><div class="dotl"></div><div><div class="nm">${l[0]}</div><div class="sb">${l[1]}</div></div></div>`).join('')}
 <div class="slipfoot"><div>Stake<b class="mono">£${S.stake}</b></div>
  <div style="text-align:right">Returned<b class="mono retval" data-ret style="color:var(--${col})">£${S.ret}</b></div></div></div>
 <div class="status" data-status><span class="spin"></span><span data-stxt>Analysing slip</span></div>
 <div class="verdict ${S.k}" data-verdict>${S.vd}</div>`};

function tgWin(title,sub,av,rows){return `<div class="tgwin">
 <div class="tghead"><span class="tgav">${av}</span><div><b>${title}</b><span>${sub}</span></div></div>
 <div class="tgbody">${rows}</div></div>`}
const XBET=`<table class="tgt2">
 <tr><td>Event</td><td>Arsenal v Chelsea</td></tr>
 <tr><td>Selection</td><td>Both teams to score</td></tr>
 <tr><td>Odds</td><td>1.90</td></tr>
 <tr><td>Stake</td><td>2.00u · £50.00</td></tr>
 <tr><td>Bookmaker</td><td>bet365</td></tr></table>
 <div class="tgfoot">Reply with a tipster name to attribute it.</div>`;
const BOTDECK=[
 ['Forward a slip',tgWin('Slippery','private chat','S',
  `<div class="tgb out">📷 slip.png<div class="tgtime">19:12 ✓✓</div></div>
   <div class="tgb in"><div class="who2">Slippery</div>${XBET}<div class="tgtime">19:12</div></div>
   <div class="tgb out">Confirm<div class="tgtime">19:12 ✓✓</div></div>
   <div class="tgb in"><div class="who2">Slippery</div>Logged. 1 open, £50 at risk.<div class="tgtime">19:12</div></div>`)],
 ['Or just type it',tgWin('Slippery','private chat','S',
  `<div class="tgb out">Arsenal v Chelsea, BTTS yes, 1.90, 2u<div class="tgtime">14:32 ✓✓</div></div>
   <div class="tgb in"><div class="who2">Slippery</div>${XBET}<div class="tgtime">14:32</div></div>`)],
 ['It sits in your group',tgWin('Weekend Multis','group · 54 members','WM',
  `<div class="tgb in" style="max-width:92%"><div class="who2">BlueSlip</div>Man City v Arsenal, over 2.5 at 1.95, 2u<div class="tgtime">14:02</div></div>
   <div class="tgb in"><div class="who2">Slippery</div><table class="tgt2">
    <tr><td>Event</td><td>Man City v Arsenal</td></tr><tr><td>Selection</td><td>Over 2.5 Goals</td></tr>
    <tr><td>Odds</td><td>1.95</td></tr><tr><td>Stake</td><td>2.00u</td></tr>
    <tr><td>Tipster</td><td>BlueSlip</td></tr></table>
    <div class="tgfoot">Only members who linked the group get it logged.</div><div class="tgtime">14:02</div></div>`)],
 ['It settles itself',tgWin('Slippery','private chat','S',
  `<div class="tgb in"><div class="who2">Slippery</div><b style="color:var(--pos)">Full time · won</b><br>+£45.00 · +1.80u<br>
   <span style="color:var(--t3)">Today: +£${TDY.toFixed(2)} across 3 bets</span><div class="tgtime">21:48</div></div>
   <div class="tgb in"><div class="who2">Slippery</div><b style="color:var(--neg)">Full time · lost</b><br>−£25.00 · −1.00u<br>
   <span style="color:var(--t3)">2 still open</span><div class="tgtime">21:52</div></div>`)],
 ['Ask it anything',tgWin('Slippery','private chat','S',
  `<div class="tgb out">/today<div class="tgtime">22:10 ✓✓</div></div>
   <div class="tgb in"><div class="who2">Slippery</div><table class="tgt2">
    <tr><td>Bets</td><td>3</td></tr><tr><td>Won / lost</td><td>2 / 1</td></tr>
    <tr><td>Net</td><td>+£${TDY.toFixed(2)}</td></tr><tr><td>Units</td><td>+${(TDY/25).toFixed(2)}u</td></tr></table><div class="tgtime">22:10</div></div>`)],
 ['When it cannot read',tgWin('Slippery','private chat','S',
  `<div class="tgb out">📷 blurry.png<div class="tgtime">18:04 ✓✓</div></div>
   <div class="tgb in"><div class="who2">Slippery</div><b style="color:var(--a)">Could not read the odds</b><br>
   Everything else came through. Reply with the price.<div class="tgtime">18:04</div></div>
   <div class="tgb out">1.91<div class="tgtime">18:05 ✓✓</div></div>
   <div class="tgb in"><div class="who2">Slippery</div>Got it. Logged at 1.91.<div class="tgtime">18:05</div></div>`)]];
const BOTMSG={read:'READ · 4 legs · bet365<br>1.80 · £100.00 → £180.00<br><span style="color:var(--s)">[ Confirm ]  [ Edit ]</span>',
 track:'TRACKING · 1 open · £100 at risk', ft:`FT · WON<br>+£80.00 · +3.20u<br>Today: +£${TDY.toFixed(2)} · 3 bets`};
function SNAPBAR(){return `<div class="appbar">${BRAND}<span></span>
 <div class="barright"><span class="runpill"><span class="dotp"></span>4 bets running</span></div></div>`}
function stripIds(h){return h.replace(/\sid="[^"]*"/g,'').replace(/data-cal="/g,'data-snapcal="').replace(/data-count="/g,'data-snapcount="')}
function snapView(fn,tab){const inner=SNAPBAR()+(tab?TABS(tab):'')+fn();
 return `<div class="snapwrap"><div class="snapinner" data-snap>${stripIds(inner)}</div></div>`}
const FILM=[
 ['You place a bet','On the bookmaker, as normal',`<div class="snapwrap" style="display:grid;place-items:center;padding:16px">
  <div class="slip" style="border-style:solid;width:100%"><div class="hd" style="margin-bottom:6px"><b style="font-size:12.5px">4 legs · bet365</b><span class="tag">4 LEGS</span></div>
  ${[['Under 4 Cards','Total cards'],['Under 4.5 Shots on Target','Cremonese'],['Under 11.5 Shots','Cremonese'],['Juventus to win','Match result']].map(l=>`<div class="leg" style="padding:6px 0"><div class="dotl" style="width:12px;height:12px"></div><div><div class="nm" style="font-size:11.5px">${l[0]}</div><div class="sb" style="font-size:10px">${l[1]}</div></div></div>`).join('')}
  <div class="slipfoot" style="font-size:11.5px"><div>Stake<b class="mono" style="font-size:14px">£100.00</b></div><div style="text-align:right">Returns<b class="mono" style="font-size:14px">£180.00</b></div></div></div></div>`],
 ['Add a bet','The screen you land on',()=>snapView(V.import.html,null)],
 ['It reads the slip','Every leg, price and stake',()=>snapView(V.reading.html,null)],
 ['You confirm what it found','Three bets from one screenshot',()=>snapView(V.review.html,null)],
 ['Your dashboard updates','Net, the curve, then the week',()=>snapView(()=>`<div class="pane">${netCard()}${CARDFN.curve()}${calCard()}</div>`,'OVERVIEW')],
 ['And your calendar fills','Every day you have a record for',()=>snapView(()=>`<div class="pane">${calCardMonth()}</div>`,'OVERVIEW')]];

V.landing={bare:1,html:()=>`
<div class="lhero"><div class="inner">
 <div style="display:flex;justify-content:center;margin-bottom:18px">${BRAND}</div>
 <p class="leyebrow">Bet tracking for UK and Irish bettors</p>
 <h1 class="lh1">Don't let your profit <em>slip.</em></h1>
 <p class="lsub">Forward a slip to the bot before kick off, in play, or after it settled. Slippery reads it, settles it, keeps the record.</p>
 <button class="btn full" data-go="su1">Start tracking free</button>
 <p style="margin:13px 0 15px"><button style="font-size:14px;text-decoration:underline;text-underline-offset:5px;color:var(--t2)" data-go="demo">or see a live demo first</button></p>
 <div class="storeb">${APPLEBADGE}${PLAYBADGE}</div>
 <p class="storenote">Coming soon to iOS and Android. The web app works today.</p></div>
 <div class="wavewrap">${WAVES}</div></div>

<div class="lsec c" style="padding-top:10px">${shotFrame()}</div>

<div class="lsec"><h2 class="lh2" style="text-align:center">Three steps, then it runs itself.</h2>
 <ul class="steps">
  <li><span class="no mono">01</span><div><h3>Send the screenshot</h3><p>One slip or several at once.</p></div></li>
  <li><span class="no mono">02</span><div><h3>It reads every leg</h3><p>Stake, price, selections, bookmaker.</p></div></li>
  <li><span class="no mono">03</span><div><h3>You confirm, it tracks</h3><p>Settles itself at full time.</p></div></li></ul></div>

<div class="lsec c"><h2 class="lh2">Every slip, settled either way.</h2>
 <div id="slipHost">${slipHTML(0)}</div>
 <div class="dots" id="slipDots">${SLIPS.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('')}</div></div>

<div class="lsec c"><h2 class="lh2">See it in action</h2>
 <div class="deck" id="film" style="min-height:520px">
  ${FILM.map((s,i)=>`<div class="scene" data-scene="${i}" style="position:absolute;inset:0;padding:13px;opacity:${i?0:1};transition:opacity .55s var(--e)">
   <div class="snapcap"><span class="lbl" style="display:block;margin-bottom:5px">0${i+1} / 0${FILM.length}</span>${s[0]}<span>${s[1]}</span></div>
   ${typeof s[2]==='function'?s[2]():s[2]}</div>`).join('')}
  <div style="position:absolute;left:0;bottom:0;height:2px;background:var(--p);width:0" id="filmbar"></div>
  <div class="playwrap" id="playwrap"><button class="play" id="playbtn" aria-label="Play">▶</button></div></div></div>

<div class="lsec c"><h2 class="lh2">Send a bet on Telegram.<br>It is tracked instantly.</h2>
 <p class="lsub" style="margin-bottom:22px">Forward a slip or type it out. It logs itself.</p>
 <ul class="tgflow">
  ${[['Create an account','You get a code'],['Paste it to the bot','@SlipperyAppBot'],['Forward slips','Or add it to a group']].map(x=>`
   <li class="tgstep"><span class="tgn"></span><div><b>${x[0]}</b><span>${x[1]}</span></div></li>`).join('')}</ul>
 <div class="tgcard" style="margin-bottom:14px"><span class="tgicon">${TG}</span>
  <div style="text-align:left;flex:1;min-width:0"><b style="font-size:13.5px;display:block">@SlipperyAppBot</b>
   <span style="font-size:11.5px;color:var(--t3)">Private chat or group</span></div>
  <span class="pill g">Live</span></div>
 <div class="deck" data-deck="bot" style="background:transparent;border:0"><div class="dtrack">
  ${BOTDECK.map(x=>`<div class="dslide" style="padding:2px 3px 4px"><div class="lbl" style="margin-bottom:9px;text-align:left">${x[0]}</div>${x[1]}</div>`).join('')}</div></div>
 <div class="deckbar"><button class="nav" data-dnav="-1" aria-label="Previous">&lsaquo;</button>
  <div class="dots" data-deckdots="bot">${BOTDECK.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('')}</div>
  <button class="nav" data-dnav="1" aria-label="Next">&rsaquo;</button></div></div>

<div class="lsec c"><h2 class="lh2">Pricing</h2><div class="plans2">
 <div class="plan"><div class="top"><h3>Free trial</h3></div>
  <div class="price"><b style="font-size:32px;font-weight:700;letter-spacing:-.03em">£0</b></div>
  <p class="pn">${TRIAL.base}, whichever runs out first. Card required, cancel any time.</p>
  <ul><li>Every feature unlocked</li><li>Nothing charged during it</li></ul>
  <button class="btn ghost full" data-go="su1">Start free</button></div>
 <div class="plan"><div class="top"><h3>Monthly</h3></div>
  <div class="price"><b style="font-size:32px;font-weight:700;letter-spacing:-.03em">£3.49</b><span style="font-size:13px;color:var(--t3)">a month</span></div>
  <p class="pn">Rolling. Cancel whenever you like.</p>
  <ul><li>Unlimited slips</li><li>Every breakdown</li></ul>
  <button class="btn ghost full" data-go="su1">Choose monthly</button></div>
 <div class="plan pick2"><div class="top"><h3>Yearly</h3><span class="badge">Best value</span></div>
  <div class="price"><b style="font-size:32px;font-weight:700;letter-spacing:-.03em">£29.99</b>
   <span style="font-size:13px;color:var(--t3)">a year</span><span class="was">£34.99</span></div>
  <div class="saveline">Save £11.89 a year</div>
  <p class="pn">£2.50 a month, against £3.49 monthly.</p>
  <ul><li>Unlimited slips</li><li>Priority slip reading</li><li>Profile verification review</li></ul>
  <button class="btn full" data-go="su1">Choose yearly</button></div></div></div>

<div class="lsec"><h2 class="lh2" style="text-align:center">FAQs</h2>
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
 <nav>${[['How it works',''],['Pricing',''],['FAQs',''],['Calculators','calc'],['Support','support'],['Terms','terms'],['Privacy','privacypol'],['Changelog','changelog']].map(x=>`<button style="font-size:12.5px;color:var(--t2)" ${x[1]?`data-sheet="${x[1]}"`:`data-toast="${x[0]}"`}>${x[0]}</button>`).join('')}</nav>
 <p>© 2026 Slippery. Slippery tracks bets. It does not accept them and never handles money.</p>
 <p style="margin-top:8px">18+ Please gamble responsibly. BeGambleAware.org</p>
 <p style="margin-top:5px">National Gambling Helpline 0808 8020 133, free and confidential, 24 hours a day.</p></div>`};

function shotFrame(){return `<div style="border-radius:14px;overflow:hidden;border:1px solid var(--line);background:var(--elev)">
 <div style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:rgba(255,255,255,.05);border-bottom:1px solid var(--line)">
  <span style="width:8px;height:8px;border-radius:50%;background:#FF5F57"></span><span style="width:8px;height:8px;border-radius:50%;background:#FEBC2E"></span>
  <span style="width:8px;height:8px;border-radius:50%;background:#28C840"></span>
  <span class="mono" style="flex:1;text-align:center;font-size:10px;color:var(--t3)">slippery.app</span></div>
 <div style="padding:12px;text-align:left" id="shotBody">${netCard()}${calCard()}</div></div>`}

/* ═══ other views ═══ */
const CHECK=[['Set your unit','unit',1],['Connect Telegram','bot',0],['Log your first bet','import',0],['Join a group','social',0]];
V.fresh={nav:'dash',tab:'OVERVIEW',html:()=>{
 const done=CHECK.filter(c=>c[2]).length;
 return `<div class="pane">
 <div class="card" style="border-color:var(--p)"><div class="hd"><b>Get set up</b><span class="pill">${done} of ${CHECK.length}</span></div>
  <div class="track" style="margin-bottom:11px"><div class="fill" data-w="${Math.round(done/CHECK.length*100)}"></div></div>
  ${CHECK.map(c=>`<button class="ck ${c[2]?'done':''}" ${c[2]?'':`data-${c[1]==='import'||c[1]==='social'?'go':'sheet'}="${c[1]}"`}>
   <span class="box">${c[2]?'✓':''}</span><span class="t">${c[0]}</span>${c[2]?'':'<span class="caret" style="transform:rotate(-90deg)">▾</span>'}</button>`).join('')}
  <p class="note">This card disappears once all four are done.</p></div>
 <div class="card"><div class="hd"><span class="lbl">Net this month</span><span class="pill">This month ▾</span></div>
  <div class="empty"><div class="ic">£</div><b>No bets yet</b>
   <p>Send your first slip and your net, units and turnover appear here.</p>
   <button class="btn sm" data-go="import">Add a bet</button></div></div>
 <div class="card"><div class="hd"><b>Profit over time</b></div>
  <div class="empty" style="padding:14px 10px"><div class="ghostcal" style="grid-template-columns:repeat(12,1fr);opacity:.25;margin-bottom:12px">${Array.from({length:12},()=>'<i style="aspect-ratio:auto;height:38px;border-radius:4px"></i>').join('')}</div>
   <b>Nothing to plot</b><p>The curve starts after your first settled bet.</p></div></div>
 <div class="card"><div class="hd"><b>This week</b><span class="chip">Expand month</span></div>
  <div class="ghostcal">${Array.from({length:7},()=>'<i></i>').join('')}</div>
  <p class="note" style="text-align:center">Days fill in as you log bets.</p></div>
 <div class="card"><div class="hd"><b>Recent bets</b></div>
  <div class="empty"><div class="ic">📷</div><b>Your ledger is empty</b>
   <p>Screenshot a slip, forward it to the bot, or type it in. Any of the three.</p>
   <div style="display:flex;gap:8px;justify-content:center"><button class="btn sm" data-go="import">Add a bet</button>
    <button class="btn ghost sm" data-sheet="bot">Set up the bot</button></div></div></div></div>`}};
V.freshledger={narrow:1,nav:'dash',tab:'LEDGER',html:()=>`<div class="pane">
 <div class="card"><div class="empty"><div class="ic">≡</div><b>No bets to list</b>
  <p>Once you have a few, filter them by outcome, sport, bookmaker, tipster or odds band.</p>
  <button class="btn sm" data-go="import">Add your first</button></div></div></div>`};
V.freshsocial={narrow:1,nav:'soc',html:()=>`<div class="pane">
 <div class="card"><div class="empty"><div class="ic">◎</div><b>No groups yet</b>
  <p>A group ranks everyone by units, so stake size stays private. Start one or find one.</p>
  <div style="display:flex;gap:8px;justify-content:center"><button class="btn sm" data-sheet="creategroup">Create a group</button>
   <button class="btn ghost sm" data-go="discover">Discover</button></div></div></div>
 <div class="card"><div class="empty" style="padding:16px"><b style="font-size:13.5px">Nobody following you</b>
  <p style="margin:0">Share your handle and your figures show in units.</p></div></div></div>`};
V.offline={nav:'dash',tab:'OVERVIEW',run:1,html:()=>`<div class="pane">
 <div class="banner err"><span>⚠</span><div><b>No connection</b>Figures below were last updated 14 minutes ago. Nothing you log now will be lost, it queues and sends when you are back.</div></div>
 <div class="card t"><div class="hd" style="margin:0"><div><b style="font-size:13.5px">2 bets waiting to send</b><div class="dd">Queued locally</div></div>
  <button class="chip" data-toast="Retrying…">Retry</button></div></div>
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
 /* EVERY COUNT FROM ONE PASS OVER ONE SET.
    Cashed and Void were hardcoded 2 and 1 beside an All that counted the
    rows, so the facets read 6 + 6 + 2 + 1 against a total of 12 and could
    never add up. That is the defect this product is not allowed to have:
    a banner saying 486, a ledger listing 482 and facets summing to 474. */
 const c={w:0,l:0,a:0,v:0};bets.forEach(b=>c[b[0]]++);
 const staked=bets.reduce((t,b)=>t+b[5],0),ret=bets.reduce((t,b)=>t+b[6],0),net=ret-staked;
 const facets=[['All',bets.length,'',1],['Won',c.w,'w',0],['Lost',c.l,'l',0],['Cashed',c.a,'a',0],['Void',c.v,'v',0]];
 return `<div class="pane">
 <div class="hd"><span class="lbl">${PERIODS[cur.per].lab}</span><button class="pill" data-sheet="period">${PERLIST.find(x=>x[0]===cur.per)[1]} ▾</button></div>
 <div class="card" data-cardid="lsum"><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px">
  ${[['Staked','£'+staked.toFixed(0),0],['Returned','£'+ret.toFixed(0),0],['Net',money(net),1],['ROI','+'+(net/staked*100).toFixed(1)+'%',1]].map(x=>`
   <div class="stat"><div class="k">${x[0]}</div><div class="v mono"${x[2]?` style="color:var(--${net>0?'pos':'neg'})"`:''}>${x[1]}</div></div>`).join('')}</div></div>
 <div class="card" data-cardid="lrows">
  <div class="ltools">
   ${segHTML(['Bets','History'],'Bets',x=>`data-go="${x==='Bets'?'ledger':'history'}"`)}
   <input class="field lsearch" placeholder="Search event, selection or bookmaker">
   <button class="chip" data-sheet="filters">Filters</button>
   <button class="chip" data-sheet="lsort">Newest ▾</button>
   <button class="chip" data-bulk>${cur.bulk?'Done':'Select'}</button></div>
  ${cur.bulk?`<div class="bulkbar"><b style="font-size:13px">3 selected</b>
   <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="chip" data-sheet="tipsterpick">Tipster</button>
    <button class="chip" data-sheet="tags">Tag</button><button class="chip" data-sheet="sports">Sport</button>
    <button class="chip" data-toast="3 bets deleted">Delete</button></div></div>`:''}
  <div class="chips">${facets.map(f=>`<button class="chip ${f[2]}" aria-current="${!!f[3]}" data-pickone>${f[0]} ${f[1]}</button>`).join('')}</div>
  ${bets.map(betRow).join('')}
  <div style="display:flex;justify-content:center;padding-top:13px"><button class="btn ghost sm" data-toast="12 more loaded">Load more</button></div></div></div>`}};
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
V.discover={nav:'soc',back:'social',title:'Discover groups',html:()=>`<div class="pane">
 <input class="field" placeholder="Search by name" style="margin:0 0 10px">
 <div style="margin-bottom:13px">${segHTML(['Popular','Newest','A–Z'],'Popular',null,'full')}</div>
 ${[['Ultras','U',12,'+41.2u','+6.1%',1],['HB Value','HB',38,'+22.8u','+3.4%',0],['Irish Racing','IR',21,'+15.9u','+2.8%',0],['Weekend Multis','WM',54,'−8.7u','−2.1%',0],['Value Vault','VV',16,'+31.0u','+5.2%',0]].map(g=>`
  <div class="card t"><div class="hd" style="margin:0">
   <div style="display:flex;gap:10px;align-items:center"><span class="gpic" style="width:30px;height:30px;font-size:11px;border-radius:9px">${g[1]}</span>
    <div><b style="font-size:14px">${g[0]}</b><div class="dd" style="font-size:11px;color:var(--t3)">${g[2]} members · avg ROI ${g[4]}</div></div></div>
   <div style="display:flex;gap:9px;align-items:center"><b class="mono" style="font-size:12.5px;color:var(--${g[3].startsWith('−')?'neg':'pos'})">${g[3]}</b>
    ${g[5]?'<span class="pill g">✓ Joined</span>':`<button class="chip" data-toast="Request sent to ${g[0]}">Request</button>`}</div></div></div>`).join('')}
 <p class="note">Group averages only. Individual figures need a membership.</p></div>`};
V.person={narrow:1,nav:'soc',back:'social',title:'BlueSlip',html:()=>`<div class="pane">
 <div class="card" style="text-align:center"><span class="av" style="width:58px;height:58px;font-size:20px;margin:0 auto 10px">BS</span>
  <b style="font-size:17px;display:block">BlueSlip</b><div class="dd" style="color:var(--t3)">@blueslip</div>
  <div class="g3" style="margin-top:13px"><div class="stat"><div class="k">Units</div><div class="v mono" style="color:var(--pos)">+18.2u</div></div>
   <div class="stat"><div class="k">ROI</div><div class="v mono" style="color:var(--pos)">+9.4%</div></div>
   <div class="stat"><div class="k">Bets</div><div class="v mono">214</div></div></div>
  <button class="btn ghost full sm" style="margin-top:12px" data-toast="Unfollowed BlueSlip">Following</button></div>
 <div class="card"><div class="hd"><b>Groups</b><span class="lbl">3</span></div>
  ${[['Ultras','U',12],['HB Value','HB',38],['Value Vault','VV',16]].map(g=>`
   <div class="bet" style="align-items:center"><span class="gpic" style="width:28px;height:28px;font-size:11px;border-radius:9px">${g[1]}</span>
    <div class="m"><div class="n">${g[0]}</div><div class="d">${g[2]} members</div></div></div>`).join('')}</div>
 <p class="note">Stake sizes are only visible inside a group you both belong to.</p></div>`};
V.social={nav:'soc',html:()=>`<div class="pane">
 <div class="hd"><b style="font-size:18px">Social</b><button class="chip" data-sheet="creategroup">+ New group</button></div>
 <div class="lbl" style="margin:6px 0 8px">Your groups</div>
 ${[['Ultras','U',12,4,'+63.4u',0],['Sunday League','SL',7,2,'−4.1u',1]].map(g=>`
  <button class="card t" style="width:100%" data-go="groupdetail"><div class="hd" style="margin:0">
   <div style="display:flex;gap:11px;align-items:center"><span class="gpic">${g[1]}</span>
    <div style="text-align:left"><b style="font-size:14.5px">${g[0]}${g[5]?' <span class="tag">ADMIN</span>':''}</b>
     <div class="dd" style="font-size:11.5px;color:var(--t3)"><span class="${posc(g[3])}">${g[3]}</span> of ${g[2]} members</div></div></div>
   <b class="mono" style="color:var(--${g[4].startsWith('−')?'neg':'pos'})">${g[4]}</b></div></button>`).join('')}
 <button class="btn ghost full sm" style="margin-bottom:16px" data-go="discover">Discover groups</button>
 <div class="lbl" style="margin:0 0 8px">People</div>
 ${segHTML(['Following','Followers'],'Following',null,'full')}
 <div style="margin-top:11px">${[['BlueSlip','BS','+18.2u','+9.4% ROI'],['KerryEdge','KE','+11.7u','+4.1% ROI'],['FiveFolds','FF','+8.4u','+2.2% ROI']].map(f=>`
  <button class="card t" style="width:100%" data-go="person"><div class="hd" style="margin:0">
   <div style="display:flex;gap:10px;align-items:center"><span class="av" style="width:32px;height:32px;font-size:11px">${f[1]}</span>
    <div style="text-align:left"><b style="font-size:14px">${f[0]}</b><div class="dd" style="font-size:11px;color:var(--t3)">${f[3]}</div></div></div>
   <b class="mono" style="color:var(--pos)">${f[2]}</b></div></button>`).join('')}</div></div>`};
V.groupdetail={narrow:1,nav:'soc',back:'social',title:'Ultras',html:()=>`<div class="pane">
 <div class="card"><div class="hd"><div style="display:flex;gap:11px;align-items:center"><span class="gpic">U</span>
   <div><b>Ultras</b><div class="dd"><span class="pos2">4</span> of 12 members</div></div></div>
  <div style="display:flex;gap:7px"><button class="chip" data-sheet="challenge">Challenge</button>
   <button class="chip" data-sheet="groupadmin">Manage</button></div></div>
  <div class="banner warn" style="margin-bottom:10px"><span>✓</span><div><b>Slip-backed only</b>Every figure below has a bookmaker slip behind it.</div></div>
  ${[[1,'BlueSlip','+18.2u','1u = £100','100%',0],[2,'KerryEdge','+11.7u','1u = £50','96%',1],[3,'FiveFolds','+8.4u','1u = £25','100%',0],[4,'You','+6.3u','1u = £25','94%',0],[5,'NapKing','+2.1u','1u = £10','88%',2]].map(m=>`
   <button class="bet" style="align-items:center" data-go="person"><span class="mono ${posc(m[0])}" style="width:18px;text-align:center;flex:0 0 auto">${m[0]}</span>
   <div class="m"><div class="n">${m[1]}</div><div class="d">${m[3]} · ${m[4]} slip-backed${m[5]?` · <span style="color:var(--a)">${m[5]} edited late</span>`:''}</div></div>
   <div class="v" style="color:var(--pos)">${m[2]}</div></button>`).join('')}
  <p class="note">Group members see each other's unit size. Outside a group only units are shown.</p></div></div>`};

/* ═══ IMPORT ═══ */
V.import={narrow:1,nav:'imp',html:()=>`<div class="pane">
 <h2 style="font-size:22px;margin:0 0 12px">Add a bet</h2>
 <button class="card" style="width:100%;border-style:dashed;border-color:var(--p);text-align:center;padding:26px 16px" data-go="crop">
  <div style="font-size:24px;margin-bottom:7px">📷</div><b style="font-size:14px;display:block">Screenshot, PDF or CSV</b>
  <p class="note" style="margin-top:4px">Drop it here, or tap to choose</p></button>
 <button class="btn ghost full" style="margin-bottom:13px" data-go="manual">Type it instead</button>
 <div class="card" style="border-color:var(--p)"><div class="hd" style="margin:0">
  <b style="font-size:13px">${TG} Forward slips to the bot</b>
  <button class="btn sm" style="flex:0 0 auto" data-sheet="bot">Set up</button></div></div>
 <div style="height:50px"></div>
 <div style="text-align:center;border-top:1px solid var(--line);padding-top:14px">
  <button style="font-size:13.5px;color:var(--s);text-decoration:underline;text-underline-offset:4px" data-go="imphist">Or, import history</button></div></div>`};
V.importlinked={nav:'imp',html:()=>V.import.html().replace('<button class="btn sm" style="flex:0 0 auto" data-sheet="bot">Set up</button>','<span class="pill g" style="flex:0 0 auto">✓ Linked</span>')};
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
V.reading={narrow:1,nav:'imp',html:()=>`<div class="pane" style="padding-top:44px;text-align:center">
 <div class="slip scanning" style="max-width:230px;margin:0 auto 20px;padding:11px;border-style:solid" id="rdslip">
  <div class="scanbar"></div>
  <div class="hd" style="margin-bottom:6px"><b style="font-size:11.5px">bet365</b><span class="tag" style="font-size:8px">SLIP</span></div>
  ${['Under 4 Cards','Under 4.5 Shots on Target','Juventus to win'].map(l=>`<div class="leg" style="padding:6px 0"><div class="dotl" style="width:11px;height:11px"></div><div><div class="nm" style="font-size:11px">${l}</div></div></div>`).join('')}
  <div class="slipfoot" style="font-size:11px"><div>Stake<b class="mono" style="font-size:13px">£100.00</b></div>
   <div style="text-align:right">Returns<b class="mono" style="font-size:13px">£180.00</b></div></div></div>
 <h2 style="font-size:19px;margin:0 0 5px">Analysing slip</h2>
 <p class="note" style="margin:0 0 18px" id="readmsg">Selections</p>
 <div class="dots" id="rddots">${[0,1,2].map(()=>'<i></i>').join('')}</div>
 <button class="btn ghost full sm" style="margin-top:22px;max-width:200px;margin-left:auto;margin-right:auto" data-go="review">Skip ahead</button></div>`};
V.review={narrow:1,nav:'imp',html:()=>`<div class="pane">
 <div class="hd"><h2 style="font-size:20px;margin:0">3 bets found</h2><button class="pill" data-sheet="tipsterpick">Own picks ▾</button></div>
 ${[['Juventus v Cremonese','4 legs · 1.80 · £100 · bet365',0],
    ['Arsenal, Leeds, Sinner','3 legs · 8.20 · £40 · Sky Bet',0],
    ['Kempton 19:45','Single · 4.50 · £20 · Coral',1]].map(b=>`
  <button class="card t" style="width:100%" data-sheet="editbet"><div class="hd" style="margin:0">
   <div style="text-align:left"><b style="font-size:13.5px">${b[0]}</b><div class="dd" style="font-size:11px;color:var(--t3)">${b[1]}</div></div>
   <span class="pill ${b[2]?'a':'g'}">${b[2]?'Fixture?':'✓'}</span></div></button>`).join('')}
 <button class="btn full" style="margin-top:4px" data-go="overview">Save all</button>
 <p style="text-align:center;margin-top:10px"><button style="font-size:13px;color:var(--t3)" data-go="import">Discard</button></p></div>`};
V.manual={narrow:1,nav:'imp',html:()=>`<div class="pane"><h2 style="font-size:22px;margin:0 0 10px">Type it in</h2>
 <label class="flabel">Event</label><input class="field" placeholder="Arsenal v Spurs">
 <label class="flabel">Selection</label><input class="field" placeholder="Arsenal to win">
 <button class="btn ghost full sm" style="margin-top:9px" data-toast="Leg added">+ Add another leg</button>
 <div style="display:flex;gap:9px"><div style="flex:1"><label class="flabel">Stake</label><input class="field mono" placeholder="£25.00"></div>
  <div style="flex:1"><label class="flabel">Odds</label><input class="field mono" placeholder="1.90"></div></div>
 <label class="flabel">Bookmaker</label><button class="field" style="text-align:left;display:flex;justify-content:space-between" data-sheet="bookpick">bet365 <span class="caret">▾</span></button>
 <label class="flabel">Tipster</label><button class="field" style="text-align:left;display:flex;justify-content:space-between" data-sheet="tipsterpick">Own picks <span class="caret">▾</span></button>
 <label class="flabel">Placed on</label><button class="field" style="text-align:left;display:flex;justify-content:space-between" data-toast="Date picker">Today, 19 Aug 2026 <span class="caret">▾</span></button>
 <details class="disc"><summary style="margin-top:8px"><span style="font-size:13.5px;color:var(--s)">More options</span><span class="caret">▾</span></summary>
  <div class="setrow"><div><div class="k">Each way</div><div class="dd">Splits into win and place</div></div><button class="tog" data-tog aria-pressed="false"></button></div>
  <div class="setrow"><div><div class="k">Free bet or bonus</div><div class="dd">Stake is not returned on a win</div></div><button class="tog" data-tog aria-pressed="false"></button></div></details>
 <button class="btn full" style="margin-top:14px" data-go="overview">Save</button></div>`};
V.imphist={narrow:1,nav:'imp',back:'import',title:'Import history',html:()=>`<div class="pane">
 <p class="note" style="margin:0 0 13px">Most people never need this. It is for moving a record across from somewhere else.</p>
 ${[['Spreadsheet or CSV','Full bets if the columns are there, figures only if not'],
    ['Screenshot of a profit screen','From another tracker or a bookmaker statement'],
    ['Type the figures','A date and an amount, nothing else']].map(o=>`
  <button class="card t" style="width:100%" data-go="imphistreview"><div class="hd" style="margin:0">
   <div style="text-align:left"><b style="font-size:14px">${o[0]}</b><div class="dd" style="font-size:11px;color:var(--t3)">${o[1]}</div></div>
   <span class="caret" style="transform:rotate(-90deg)">▾</span></div></button>`).join('')}
 <div class="card" style="margin-top:6px"><b style="font-size:13px">What imported history can and cannot do</b>
  ${[['Counts toward net and turnover','g','Yes'],['Shows on the calendar','g','Yes'],['Affects win rate','r','No'],['Affects streaks','r','No'],['Affects best and worst day','r','No']].map(x=>`<div class="setrow" style="padding:9px 0"><div class="k" style="font-size:13px">${x[0]}</div><span class="pill ${x[1]}">${x[2]}</span></div>`).join('')}</div></div>`};
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
    <div class="bar" style="background:${t[4]}"></div><span class="up" style="color:${t[6]}">+£48</span>
    <span class="dnn" style="color:${t[7]}">−£12</span></div>
   <div class="tname">${t[1]}</div><div class="tdesc">${t[2]}</div></button>`).join('')}</div>
  <div class="setrow" style="margin-top:11px;border-top:1px solid var(--line)"><div><div class="k">Dates on the calendar</div><div class="dd">Show the day number in each cell</div></div><button class="tog" data-caldates aria-label="Dates on the calendar" aria-pressed="${cur.calDates}"></button></div>
  <button class="setrow" data-sheet="editov"><div><div class="k">Edit overview</div><div class="dd">Reorder or hide dashboard cards</div></div><span class="pill">Open ›</span></button>
  <button class="setrow" data-sheet="odds"><div class="k">Odds format</div><span class="pill">${cur.oddsFmt} ▾</span></button>
  <button class="setrow" data-sheet="showin"><div class="k">Show profit in</div><span class="pill">${cur.showIn} ▾</span></button></div>

 <div class="card"><div class="lbl" style="margin-bottom:4px">Betting</div>
  <button class="setrow" data-sheet="unit"><div><div class="k">Your unit</div><div class="dd">Every group comparison uses this</div></div><span class="pill">£25 ▾</span></button>
  <button class="setrow" data-sheet="target"><div><div class="k">Target</div><div class="dd">Monthly · £2,000</div></div><span class="pill g">On ›</span></button>
  <button class="setrow" data-sheet="books"><div class="k">Bookmakers</div><span class="pill">9 ›</span></button>
  <button class="setrow" data-sheet="tipsters"><div class="k">Tipsters</div><span class="pill">4 ›</span></button>
  <button class="setrow" data-sheet="sports"><div class="k">Sports</div><span class="pill">3 ›</span></button>
  <button class="setrow" data-sheet="tags"><div><div class="k">Tags</div><div class="dd">Your own labels for why you took a bet</div></div><span class="pill">5 ›</span></button>
  <button class="setrow" data-sheet="markets"><div><div class="k">Market groups</div><div class="dd">Fold equivalent market names into one</div></div><span class="pill">27 ›</span></button>
  <button class="setrow" data-sheet="exposure"><div><div class="k">Open exposure</div><div class="dd">What is at risk against your bankroll</div></div><span class="pill">8.8% ›</span></button>
  <button class="setrow" data-sheet="bankroll"><div><div class="k">Bankroll</div><div class="dd">Starting balance, so growth shows as a percentage</div></div><span class="pill">£1,000 ›</span></button></div>

 <div class="card"><div class="lbl" style="margin-bottom:4px">Slips</div>
  <button class="setrow" data-sheet="bot"><div><div class="k">${TG} Telegram</div><div class="dd">Not linked</div></div><span class="pill">Set up</span></button>
  <button class="setrow" data-sheet="rules"><div><div class="k">Reading rules</div><div class="dd">What it does when a slip is unclear</div></div><span class="pill">6 ›</span></button>
  <button class="setrow" data-sheet="golden"><div><div class="k">Reader accuracy</div><div class="dd">Reference slips the reader is scored against</div></div><span class="pill a">0 ›</span></button>
  <button class="setrow" data-sheet="stale"><div><div class="k">Waiting on a result</div><div class="dd">Bets that finished with no result back</div></div><span class="pill a">3 ›</span></button>
  <button class="setrow" data-sheet="fix"><div><div class="k">Fix problem bets</div><div class="dd">Missing a fixture, sport, or split</div></div><span class="pill a">7 ›</span></button>
  <div class="setrow"><div><div class="k">Imported history</div><div class="dd">You chose No at setup</div></div><button class="tog" data-tog aria-pressed="false"></button></div></div>

 <div class="card"><div class="lbl" style="margin-bottom:4px">Privacy and data</div>
  <button class="setrow" data-sheet="privacy"><div><div class="k">Who can see your figures</div><div class="dd">Only people you follow back</div></div><span class="pill">Friends only ▾</span></button>
  <button class="setrow" data-sheet="weekly"><div><div class="k">Weekly summary</div><div class="dd">Sunday email with the week in one card</div></div><span class="pill g">On ›</span></button>
  <button class="setrow" data-sheet="notifs"><div><div class="k">Notifications</div><div class="dd">What we message and email you about</div></div><span class="pill">4 on ›</span></button>
  <button class="setrow" data-sheet="security"><div><div class="k">Security</div><div class="dd">Password, two step sign in, devices</div></div><span class="pill">Open ›</span></button>
  <button class="setrow" data-sheet="share"><div><div class="k">Share an image</div><div class="dd">Calendar, curve or summary, money optional</div></div><span class="pill">Open ›</span></button>
  <button class="setrow" data-sheet="export"><div class="k">Export all bets</div><span class="pill">CSV · JSON · PDF ›</span></button>
  <button class="setrow" data-toast="Slip images deleted"><div><div class="k">Slip images</div><div class="dd">Kept 90 days, then deleted</div></div><span class="pill">Delete now</span></button></div>

 <div class="card"><div class="lbl" style="margin-bottom:4px">Help</div>
  <button class="setrow" data-sheet="calc"><div><div class="k">Calculators</div><div class="dd">Rule 4, each way, dutching, acca</div></div><span class="pill">Open ›</span></button>
  <button class="setrow" data-tut><div><div class="k">Guided tutorial</div><div class="dd">Walks the whole app and ends with your first bet</div></div><span class="pill">Play ›</span></button>
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
  <button class="setrow" data-toast="Switched to monthly"><div><div class="k">Monthly</div><div class="dd">£3.49 a month</div></div><span class="pill">Choose</span></button>
  <button class="setrow" data-toast="Staying on yearly"><div><div class="k">Yearly</div><div class="dd">£29.99 a year</div></div><span class="pill g">Current</span></button></div>
 <button class="btn danger full" data-sheet="cancelplan">Cancel plan</button></div>`};
V.referrals={narrow:1,nav:'set',back:'settings',title:'Refer a friend',html:()=>`<div class="pane">
 <div class="card" style="text-align:center;border-color:var(--p)"><div class="lbl">Your code</div>
  <div class="mono" style="font-size:27px;letter-spacing:.08em;margin:8px 0 6px">SEUN-8QK4</div>
  <p class="note" style="margin:0 0 12px">They get ${TRIAL.ref} instead of ${TRIAL.base}.</p>
  <button class="btn full sm" data-toast="Link copied">Share</button></div>
 <div class="card"><div class="hd"><b>Used by</b><span class="pill">3</span></div>
  ${[['NapKing','12 Aug','On trial','a'],['ValueVault','4 Aug','Paying','g'],['SlipCity','28 Jul','Lapsed','r']].map(r=>`
   <div class="setrow"><div><div class="k">${r[0]}</div><div class="dd">${r[1]}</div></div><span class="pill ${r[3]}">${r[2]}</span></div>`).join('')}
  <p class="note">The person you refer gets the longer trial. No reward on your side.</p></div></div>`};

/* ═══ AUTH ═══ */
const wiz=(n,t,title,sub,body)=>`<div class="pane">
 <div style="display:flex;gap:5px;margin-bottom:15px">${Array.from({length:t},(_,i)=>`<i style="height:3px;flex:1;border-radius:9px;background:${i<n?'var(--p)':'rgba(255,255,255,.12)'};transition:background .4s var(--e)"></i>`).join('')}</div>
 <div class="lbl">Step ${n} of ${t}</div><h2 style="font-size:22px;margin:6px 0 6px">${title}</h2>
 <p class="note" style="margin:0 0 13px">${sub}</p>${body}</div>`;
V.su1={bare:1,html:()=>wiz(1,6,'Create your account','Takes about a minute.',`
 <label class="flabel">Email</label><input class="field" value="seun4150@gmail.com">
 <label class="flabel">Password</label><input class="field" type="password" value="Slippery!26">
 <div style="display:flex;gap:11px;flex-wrap:wrap;margin-top:8px;font-size:11.5px">
  ${['8 characters','One capital','One special'].map(r=>`<span style="color:var(--pos)">✓ ${r}</span>`).join('')}</div>
 <label class="setrow" style="margin-top:16px"><div><div class="k">I am 18 or over</div><div class="dd">And I agree to the <b style="color:var(--s)">Terms</b> and <b style="color:var(--s)">Privacy policy</b></div></div><button class="tog" aria-pressed="true" data-tog></button></label>
 <button class="btn full" data-go="su2">Continue</button>
 <div style="display:flex;align-items:center;gap:10px;color:var(--t3);font-size:11px;margin:14px 0 4px">
  <span style="flex:1;height:1px;background:var(--line)"></span>OR<span style="flex:1;height:1px;background:var(--line)"></span></div>
 <button class="btn ghost full" data-toast="Google sign-up">Sign up with Google</button>
 <p style="text-align:center;margin-top:12px"><button style="font-size:13px;color:var(--t3)" data-go="login">Already have an account? Sign in</button></p>`)};
V.su429={bare:1,html:()=>wiz(1,6,'Create your account','',`
 <label class="flabel">Email</label><input class="field" value="seun4150@gmail.com">
 <div class="card" style="margin-top:13px;border-color:color-mix(in srgb,var(--neg) 42%,transparent);background:color-mix(in srgb,var(--neg) 8%,transparent)">
  <b style="font-size:14px;color:var(--neg)">Too many attempts</b>
  <p class="note" style="margin-top:4px;color:var(--t2)">Try again in <b class="mono" style="color:var(--t1)">4:52</b>.</p></div>
 <button class="btn ghost full" style="margin-top:13px">Continue</button>
 <p class="note" style="text-align:center">The 429 branch signup and login are missing today.</p>`)};
V.su2={bare:1,html:()=>wiz(2,6,'Check your email','Six digits sent to seun4150@gmail.com.',`
 <div style="display:flex;gap:7px;margin-top:8px">${[0,1,2,3,4,5].map(i=>`<input class="field mono" style="text-align:center;padding:16px 0;margin:0;font-size:20px" maxlength="1" value="${i<3?'4':''}">`).join('')}</div>
 <button class="btn full" style="margin-top:20px" data-go="su3">Verify</button>
 <div style="display:flex;gap:9px;margin-top:10px"><button class="btn ghost full sm" data-toast="Code resent">Resend</button>
  <button class="btn ghost full sm" data-go="su1">Change email</button></div>`)};
V.su3={bare:1,html:()=>wiz(3,6,'Pick a display name','Groups and followers see this. One change a month after that.',`
 <input class="field" value="EdgeMargin60" style="margin-top:10px">
 <p class="note">Your handle will be <b class="mono" style="color:var(--t2)">@edgemargin60</b></p>
 <details class="disc" style="margin-top:8px"><summary style="border:0"><span style="font-size:13.5px;color:var(--s)">Have a promo or referral code?</span><span class="caret">▾</span></summary>
  <input class="field" value="SEUN-8QK4" style="margin-top:0">
  <p class="note" style="color:var(--pos)">Referral applied · ${TRIAL.ref} instead of ${TRIAL.base}</p></details>
 <button class="btn full" style="margin-top:16px" data-go="su4">Continue</button>`)};
V.su4={bare:1,html:()=>wiz(4,6,'What is one unit?','Your normal stake. It lets you compare with people who bet bigger or smaller.',`
 <div class="chips" style="margin-top:10px">${['£5','£10','£20','£25','£50','£100','Custom'].map(x=>`<button class="chip" aria-current="${x==='£25'}" data-pickone>${x}</button>`).join('')}</div>
 <div class="card t" style="margin-top:12px"><div class="row" style="font-size:12.5px;justify-content:space-between">
  <span>Stake £25, win £50</span><b class="mono" style="color:var(--pos)">+1.00u</b></div>
  <div class="row" style="font-size:12.5px;justify-content:space-between;margin-top:6px">
  <span>Stake £50, lose</span><b class="mono" style="color:var(--neg)">−2.00u</b></div></div>
 <p class="note">Change it later in Settings. Bets already logged keep the unit they were logged with.</p>
 <button class="btn full" style="margin-top:16px" data-go="su5">Continue</button>`)};
V.su5={bare:1,html:()=>wiz(5,6,'What do you bet on?','Tunes the reader and the breakdowns.',`
 <label class="flabel">Sports</label>
 <div class="chips" style="margin-top:6px">${['Football','Tennis','Horse racing'].map(x=>`<button class="chip" aria-current="true" data-multi>${x}</button>`).join('')}</div>
 <label class="flabel">Bookmakers</label>
 <div class="scrollbox" style="max-height:230px;margin-top:4px">
 ${BOOKS.map((c,ci)=>`<details class="disc" ${ci===0?'open':''}><summary><span style="font-size:13.5px">${c[0]}</span>
  <span style="display:flex;gap:8px;align-items:center"><span class="pill" style="padding:3px 9px;font-size:11px">${c[1].length}</span><span class="caret">▾</span></span></summary>
  <div class="chips">${c[1].map((b,i)=>`<button class="chip" aria-current="${ci===0&&i<3}" data-multi>${b}</button>`).join('')}</div></details>`).join('')}</div>
 <button class="btn ghost full sm" style="margin:11px 0" data-toast="Add a custom bookmaker">+ Add a custom bookmaker</button>
 <button class="btn full" data-go="su6">Continue</button>`)};
V.su6={bare:1,html:()=>wiz(6,6,'Choose a plan','Every plan starts with the trial. Nothing is charged today.',`
 <div class="card t" style="border-color:var(--pos);background:color-mix(in srgb,var(--pos) 8%,transparent)">
  <b style="font-size:13px;color:var(--pos)">Referral applied</b>
  <p class="note" style="margin-top:3px;color:var(--t2)">Your trial is ${TRIAL.ref} instead of ${TRIAL.base}.</p></div>
 ${[['Yearly','£29.99 a year','£2.50 a month · save £11.89',1],['Monthly','£3.49 a month','after the trial',0]].map(x=>`
  <button class="card t" style="width:100%${x[3]?';border-color:var(--p)':''}" data-pickcard><div class="hd" style="margin:0">
   <div style="text-align:left"><b style="font-size:14px">${x[0]}</b><div class="dd" style="font-size:11px;color:var(--t3)">${x[2]}</div></div>
   <b class="mono" style="font-size:13.5px">${x[1]}</b></div></button>`).join('')}
 <label class="flabel">Card number</label><input class="field mono" value="4242 4242 4242 4142">
 <div style="display:flex;gap:9px"><div style="flex:1"><label class="flabel">Expiry</label><input class="field mono" value="09/29"></div>
  <div style="flex:1"><label class="flabel">CVC</label><input class="field mono" value="•••"></div></div>
 <div class="card" style="margin-top:13px;border-color:color-mix(in srgb,var(--a) 40%,transparent)">
  <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Today</div><b class="mono" style="font-size:13px">£0.00</b></div>
  <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">2 Sep 2026</div><b class="mono" style="font-size:13px">£29.99 a year</b></div>
  <p class="note">The yearly plan starts automatically when the trial ends. Cancel before then and you pay nothing.</p></div>
 <button class="btn full" style="margin-top:12px" data-signin>Start my free trial</button>`)};
V.login={bare:1,html:()=>`<div class="pane"><h2 style="font-size:22px;margin:20px 0 5px">Sign in</h2>
 <p class="note" style="margin:0 0 14px">Welcome back.</p>
 <label class="flabel">Username or email</label><input class="field" value="EdgeMargin60">
 <label class="flabel">Password</label><input class="field" type="password" value="••••••••••">
 <button class="btn full" style="margin-top:15px" data-signin>Sign in</button>
 <p style="text-align:center;margin-top:11px"><button style="font-size:13px;color:var(--t3)" data-sheet="forgot">Forgotten your password?</button></p>
 <p style="text-align:center"><button style="font-size:13px;color:var(--s)" data-go="su1">New here? Create an account</button></p></div>`};
V.demo={nav:'dash',tab:'OVERVIEW',run:1,demo:1,html:()=>V.overview.html()};
const WHOAMI=()=>cur.view==='demo'?{n:'Tester123',h:'@tester123',i:'T1'}:{n:'EdgeMargin60',h:'@edgemargin60',i:'EM'};
V.bs_reminder={nav:'set',back:'settings',title:'Plan',html:()=>`<div class="pane">
 <div class="card" style="border-color:color-mix(in srgb,var(--a) 45%,transparent)"><div class="hd"><b>Trial ends in 7 days</b><span class="chip a">Reminder</span></div>
  <p class="note" style="margin:0 0 12px;color:var(--t2)">On 2 Sep we charge <b class="mono" style="color:var(--t1)">£29.99</b> to your Visa ending 4142.</p>
  <button class="btn full" style="margin-bottom:9px" data-toast="Plan kept">Keep my plan</button>
  <button class="btn ghost full" style="margin-bottom:9px" data-toast="Switched to monthly">Switch to monthly, £3.49</button>
  <button class="btn danger full" data-sheet="cancelplan">Cancel, do not charge me</button></div></div>`};
V.bs_failed={narrow:1,nav:'set',back:'settings',title:'Plan',html:()=>`<div class="pane">
 <div class="card" style="border-color:color-mix(in srgb,var(--neg) 40%,transparent)"><div class="hd"><b style="color:var(--neg)">Payment declined</b></div>
  <p class="note" style="margin:0 0 11px;color:var(--t2)">Everything still works. We try again in 3 days.</p>
  <div class="track" style="margin-bottom:9px"><div class="fill neg" data-w="50"></div></div>
  <p class="note" style="margin:0 0 12px">Attempt 1 of 2. If the second attempt fails the account goes read only.</p>
  <button class="btn full" style="margin-bottom:9px" data-sheet="card">Update card</button>
  <button class="btn ghost full" data-toast="Retrying…">Try again now</button></div></div>`};
V.bs_readonly={narrow:1,nav:'set',back:'settings',title:'Plan',html:()=>`<div class="pane">
 <div class="card" style="border-color:color-mix(in srgb,var(--neg) 45%,transparent)"><div class="hd"><b>Read only</b><span class="chip l">Paused</span></div>
  <p class="note" style="margin:0 0 12px;color:var(--t2)">Two payment attempts failed. Everything you logged is safe and stays here.</p>
  ${[['See your ledger','g','Yes'],['Export everything','g','Yes'],['Log new slips','r','Paused'],['Import history','r','Paused'],['Telegram bot','r','Paused']].map(x=>`<div class="setrow"><div class="k">${x[0]}</div><span class="pill ${x[1]}">${x[2]}</span></div>`).join('')}
  <button class="btn full" style="margin-top:12px" data-sheet="card">Restart my plan</button>
  <button class="btn ghost full" style="margin-top:9px" data-sheet="export">Export and close</button></div></div>`};

/* ═══ SHEETS ═══ */
Object.assign(SH,{
 day:()=>{const d=cur.dayIdx||19,v=DAYVALS[d]||0,bl=BETSFOR(d);
  return `<div class="hd"><b style="font-size:16px">${d} August 2026</b><span class="chip ${v>0?'w':'l'}">${v>0?'+':'−'}£${Math.abs(v)}</span></div>
  <div class="g3" style="margin-bottom:10px">${[['Staked','£'+(bl.st).toFixed(0)],['Returned','£'+(bl.rt).toFixed(0)],['Bets',bl.n]].map(x=>`<div class="stat"><div class="k">${x[0]}</div><div class="v mono">${x[1]}</div></div>`).join('')}</div>
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
 run:()=>`<div class="hd"><b style="font-size:16px">${cur.running} bets running</b><span class="chip a">£${cur.risk} at risk</span></div>
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
  <div class="barline" style="margin-top:4px"><div class="h"><span>Open against bankroll</span><b class="mono" style="color:var(--a)">8.8%</b></div>
   <div class="track"><div class="fill amb" data-w="9"></div></div></div>
  <button class="btn full" style="margin-top:10px" data-check>Check results now</button>
  <button class="btn ghost full sm" style="margin-top:9px" data-sheet="stale">3 waiting on a result</button>`,
 profile:()=>`<div class="hd"><b style="font-size:16px">Your profile</b></div>
  <div style="display:flex;gap:13px;align-items:center;margin-bottom:12px"><span class="av" style="width:56px;height:56px;font-size:19px">EM</span>
   <button class="btn ghost sm" data-toast="Choose a picture">Change picture</button></div>
  <label class="flabel">Display name</label><input class="field" value="EdgeMargin60">
  <p class="note">One change a month. Next available 1 Sep 2026.</p>
  <label class="flabel">Handle</label><input class="field mono" value="@edgemargin60" disabled style="opacity:.6">
  <button class="btn full" style="margin-top:12px" data-toast="Profile saved">Save</button>`,
 editov:()=>`<div class="hd"><b style="font-size:16px">Edit overview</b></div>
  <p class="note" style="margin:0 0 12px">Drag to reorder. On keeps a card on the overview, off moves it under Show more.</p>
  <div id="editList">${cur.order.map(k=>{const c=CARDS.find(x=>x[0]===k),on=cur.above.includes(k);
   return `<div class="editrow" draggable="true" data-ek="${k}">
    <span class="gr">⠿</span><span class="nm2" style="${on?'':'opacity:.55'}">${c[1]}</span>
    <button class="mvbtn" data-mv="up" data-k="${k}">↑</button>
    <button class="mvbtn" data-mv="dn" data-k="${k}">↓</button>
    <button class="tog" data-above="${k}" aria-pressed="${on}" style="transform:scale(.82)"></button></div>`}).join('')}</div>
  <button class="btn full" style="margin-top:12px" data-close>Done</button>`,
 bot:()=>`<div class="hd"><b style="font-size:16px">${TG} Telegram</b></div>
  ${cur.signedIn?`<div class="card t" style="text-align:center;border-color:var(--p)"><div class="lbl">Your code</div>
   <div class="mono" style="font-size:26px;letter-spacing:.1em;margin:6px 0 3px">SLIP-4K2P</div>
   <p class="note" style="margin:0">Does not expire</p></div>
  <button class="btn full" style="margin-bottom:9px" data-toast="Opens t.me/SlipperyAppBot">Open Telegram</button>
  <button class="btn ghost full" style="margin-bottom:9px" data-toast="Copied">Copy code</button>
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
  <button class="btn danger full" style="margin-bottom:9px" data-toast="Unlinked">Unlink</button><button class="btn ghost full" data-close>Cancel</button>`,
 target:()=>`<div class="hd"><b style="font-size:16px">Target</b></div>
  <div class="setrow"><div class="k">Show a target</div><button class="tog" data-tog aria-pressed="true"></button></div>
  <label class="flabel">Period</label><div style="margin-top:6px">${segHTML(['Daily','Weekly','Monthly','Yearly'],'Monthly').replace('class="seg"','class="seg full"')}</div>
  <label class="flabel">Amount</label><input class="field mono" value="2000">
  <p class="note">Amber below pace, blue on pace, green when met.</p>
  <button class="btn full" style="margin-top:12px" data-toast="Target saved">Save</button>`,
 cashout:()=>{const f=cur.cashF||4,rem=cur.cashRem||100,part=rem*f/8,price=1.42;
  return `<div class="hd"><b style="font-size:16px">Cash out</b><span class="pill a">Chelsea v Newcastle</span></div>
  <div class="card t"><div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Remaining stake</div><b class="mono" style="font-size:13px">£${rem.toFixed(2)}</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Offer</div><b class="mono" style="font-size:13px">${price.toFixed(2)} of stake</b></div></div>
  <label class="flabel">How much of what is left</label>
  <div style="text-align:center;margin:10px 0 4px"><b class="mono" style="font-size:30px;letter-spacing:-.02em">${f}/8</b>
   <div class="dd" style="text-align:center;margin-top:2px">£${part.toFixed(2)} of £${rem.toFixed(2)}</div></div>
  <input type="range" min="1" max="8" step="1" value="${f}" data-cashslider style="width:100%;accent-color:var(--p)">
  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t4);margin-top:2px">
   ${[1,2,3,4,5,6,7,8].map(i=>`<span>${i}</span>`).join('')}</div>
  <div class="card t" style="margin-top:12px">
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Cashing out now</div><b class="mono" style="font-size:13px;color:var(--a)">£${(part*price).toFixed(2)}</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Realised on this part</div><b class="mono" style="font-size:13px;color:var(--pos)">+£${(part*price-part).toFixed(2)}</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Still running</div><b class="mono" style="font-size:13px">£${(rem-part).toFixed(2)} at 1.91</b></div></div>
  <button class="btn full" style="margin-top:12px" data-cashdo>Cash out ${f}/8</button>
  <p class="note">Each pull is recorded separately. You can cash out again from what is left.</p>`},
 exposure:()=>`<div class="hd"><b style="font-size:16px">Open exposure</b><span class="chip a">£88 at risk</span></div>
  <div class="barline"><div class="h"><span>Against bankroll</span><b class="mono" style="color:var(--a)">8.8%</b></div>
   <div class="track" style="height:9px"><div class="fill amb" data-w="9"></div></div></div>
  <div class="g3" style="margin:11px 0">${[['Open stake','£88'],['Bankroll','£1,000'],['Cap','25%']].map(x=>`<div class="stat"><div class="k">${x[0]}</div><div class="v mono">${x[1]}</div></div>`).join('')}</div>
  <div class="setrow"><div><div class="k">Warn me above</div><div class="dd">A banner when open stake passes this</div></div><span class="pill">25% ▾</span></div>
  <p class="note">Four bets running. Well inside your cap.</p>`,
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
 share:()=>`<div class="hd"><b style="font-size:16px">Share</b></div>
  <label class="flabel">What to share</label><div style="margin-top:6px">${segHTML(['Calendar','Curve','Summary'],'Calendar',null,'full')}</div>
  <div class="card t" style="margin-top:12px;background:var(--bg)">
   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
    <div style="display:flex;gap:7px;align-items:center">${MARK}<span style="font-family:'Poppins',system-ui;font-weight:800;font-size:13px">Slipp<em style="font-style:normal;color:var(--s)">ery</em></span></div>
    <span class="lbl">August 2026</span></div>
   <div class="cal" data-cal="month" style="margin-bottom:9px"></div>
   <div class="row" style="font-size:11px;justify-content:space-between"><span>Net <b class="mono" style="color:var(--pos)">+£${MTD.toLocaleString('en-GB')}</b></span>
    <span>96 bets</span><span>ROI <b class="mono" style="color:var(--pos)">+8.4%</b></span></div></div>
  <div class="setrow"><div><div class="k">Hide money, show units only</div><div class="dd">For group chats</div></div><button class="tog" data-tog aria-pressed="true"></button></div>
  <div style="display:flex;gap:9px;margin-top:10px"><button class="btn full sm" data-toast="Image saved">Save image</button>
   <button class="btn ghost full sm" data-toast="Copied to clipboard">Copy</button></div>`,
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
  <div class="card t" style="background:var(--bg)">
   <div class="lbl" style="margin-bottom:7px">Your week, 13 to 19 August</div>
   <div class="mono" style="font-size:24px;font-weight:700;color:var(--pos);letter-spacing:-.03em">+£${WTD.toFixed(2)}</div>
   <div class="row" style="font-size:11.5px;margin-top:7px"><span>19 bets</span><span>W 8 · L 11</span><span>+11.4u</span></div>
   <div class="callegend" style="justify-content:flex-start;margin-top:10px"><span>Best day <b class="mono" style="color:var(--pos)">Sat +£96</b></span>
    <span>Worst <b class="mono" style="color:var(--neg)">Fri −£31</b></span></div>
   <p class="note" style="margin-top:9px">Your average stake was £34 against a £25 unit.</p></div>
  <div class="setrow" style="margin-top:8px"><div class="k">Send it weekly</div><button class="tog" data-tog aria-pressed="true"></button></div>
  <div class="setrow"><div><div class="k">Skip weeks with no bets</div><div class="dd">No email if nothing happened</div></div><button class="tog" data-tog aria-pressed="true"></button></div>`,
 challenge:()=>`<div class="hd"><b style="font-size:16px">Challenge</b><span class="chip a">6 days left</span></div>
  <p class="note" style="margin:0 0 11px">August: first to +20u. Everyone in units, so stake size does not decide it.</p>
  ${[[1,'BlueSlip','+18.2u',91],[2,'KerryEdge','+11.7u',59],[3,'FiveFolds','+8.4u',42],[4,'You','+6.3u',32]].map(m=>`
   <div class="barline"><div class="h"><span class="${posc(m[0])}">${m[0]}. ${m[1]}</span><b class="mono">${m[2]}</b></div>
    <div class="track"><div class="fill" data-w="${m[3]}"></div></div></div>`).join('')}
  <div style="display:flex;gap:9px;margin-top:11px"><button class="btn full sm" data-toast="Challenge shared">Share standings</button>
   <button class="btn ghost full sm" data-toast="New challenge">New challenge</button></div>`,
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
 filters:()=>`<div class="hd"><b style="font-size:16px">Filters</b><button class="chip" data-toast="Filters cleared">Clear</button></div>
  ${[['Sport',['All','Football','Tennis','Horse racing']],['Bookmaker',['All','bet365','Sky Bet','Coral','Betfred']],
     ['Tipster',['All','Own picks','BlueSlip','KerryEdge']],['Odds',['All','Under 2.00','2.00 – 3.00','Over 3.00']],
     ['Bet shape',['All','Single','Multi-leg']]].map(f=>`<label class="flabel">${f[0]}</label>
   <div class="chips" style="margin-top:5px">${f[1].map((x,i)=>`<button class="chip" aria-current="${!i}" data-pickone>${x}</button>`).join('')}</div>`).join('')}
  <button class="btn full" style="margin-top:12px" data-toast="Filters applied">Apply</button>`,
 bankroll:()=>`<div class="hd"><b style="font-size:16px">Bankroll</b></div>
  <p class="note" style="margin:0 0 11px">Set a starting balance and Slippery shows growth as a percentage, not just a total.</p>
  <label class="flabel">Starting balance</label><input class="field mono" value="1000.00">
  <div class="card t" style="margin-top:12px">
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Started</div><b class="mono" style="font-size:13px">£1,000.00</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Now</div><b class="mono" style="font-size:13px;color:var(--pos)">£4,171.00</b></div>
   <div class="setrow" style="padding:8px 0"><div class="k" style="font-size:13px">Growth</div><b class="mono" style="font-size:13px;color:var(--pos)">+317%</b></div></div>
  <button class="btn full" style="margin-top:12px" data-toast="Bankroll saved">Save</button>`,
 notifs:()=>`<div class="hd"><b style="font-size:16px">Notifications</b></div>
  ${[['Bet settled','Telegram message when a bet finishes',1],['Weekly summary','Sunday evening email with the week',1],
     ['Monthly summary','First of the month email',0],['Trial and billing','Payment notices and receipts',1],
     ['Target reached','When you hit your period target',1],['Group activity','When someone joins or overtakes you',0],
     ['Product news','New features, no more than monthly',0]].map(x=>`
   <div class="setrow"><div><div class="k" style="font-size:13.5px">${x[0]}</div><div class="dd">${x[1]}</div></div>
   <button class="tog" data-tog aria-pressed="${!!x[2]}"></button></div>`).join('')}
  <p class="note">Billing notices cannot be turned off. They are part of the contract.</p>`,
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
  <label class="flabel">Name</label><input class="field" value="BlueSlip">
  <label class="flabel">Their unit</label>
  <div class="chips" style="margin-top:6px">${['Use mine','£10','£25','£50','£100'].map((x,i)=>`<button class="chip" aria-current="${i===3}" data-pickone>${x}</button>`).join('')}</div>
  <p class="note" style="margin-top:2px">Overrides your own unit for their bets only, so their ROI is measured against what you actually stake on them.</p>
  <label class="flabel">Where they post</label><input class="field" placeholder="Telegram channel, X handle, or a note">
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
  <button class="btn ghost full sm" style="margin-top:11px" data-toast="Copy sent to your email">Email me a copy</button>`},
 terms:()=>SH.legalDoc('terms'),
 privacypol:()=>SH.legalDoc('privacy'),
 betdetail:()=>{const b=bets[cur.betIdx||0],won=b[0]==='w';
  return `<div class="hd"><b style="font-size:16px">${b[1]}</b><span class="chip ${b[0]}">${won?'WON':'LOST'}</span></div>
  <div class="card t">${[['Selection',b[2]],['Market',b[3]],['Bookmaker',b[9]],['Odds',fmtOdds(b[4])],['Stake','£'+b[5].toFixed(2)],
   ['Returned','£'+b[6].toFixed(2)],['Profit or loss',b[7]],['Units',b[8]],['Tipster',b[10]],['Placed',b[12]],['Source',b[11]],
   ['Each way','No'],['Rule 4 deduction','None'],['Free bet','No']].map(r=>`
   <div class="setrow"><div class="k" style="font-size:13.5px">${r[0]}</div><b class="mono" style="font-size:13.5px">${r[1]}</b></div>`).join('')}</div>
  ${b[14]?`<div class="card t"><div class="lbl" style="margin-bottom:6px">Legs</div>
   ${b[14].map(l=>`<div class="setrow" style="padding:9px 0"><div><div class="k" style="font-size:13px">${l[0]}</div><div class="dd">${l[1]}</div></div>
    <span class="pill ${l[2]==='w'?'g':'r'}">${l[2]==='w'?'✓':'✕'}</span></div>`).join('')}</div>`:''}
  <button class="setrow" data-sheet="arb"><div><div class="k">Paired position</div><div class="dd">Held with another bet as one arb</div></div><span class="pill g">Net +£2.10 ›</span></button>
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
  <label class="flabel">Event</label><input class="field" value="Juventus v Cremonese">
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
  <label class="flabel">Description</label><input class="field" value="Arsenal v Spurs">
  <div style="display:flex;gap:9px"><div style="flex:1"><label class="flabel">Stake</label><input class="field mono" value="100.00"></div>
   <div style="flex:1"><label class="flabel">Profit</label><input class="field mono" value="180.00"></div></div>
  <button class="btn full" style="margin-top:12px" data-toast="Row updated">Save</button>`,
 creategroup:()=>`<div class="hd"><b style="font-size:16px">Create a group</b></div>
  <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px"><span class="gpic" style="width:52px;height:52px;border-radius:16px;font-size:18px">SL</span>
   <button class="btn ghost sm" data-toast="Choose a picture">Add a picture</button></div>
  <label class="flabel">Name</label><input class="field" placeholder="Sunday league">
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
  <div class="setrow"><div><div class="k">Slip-backed bets only</div><div class="dd">Imported figures and manual entries are excluded from the table</div></div><button class="tog" data-tog aria-pressed="true"></button></div>
  <div class="setrow"><div><div class="k">Show edit-after-result counts</div><div class="dd">Members see who changed a bet once the result was known</div></div><button class="tog" data-tog aria-pressed="true"></button></div>
  <button class="btn ghost full sm" style="margin-top:12px" data-toast="Admin transferred">Transfer admin</button>
  <button class="btn danger full sm" style="margin-top:9px" data-toast="Group deleted">Delete group</button>`,
 unit:()=>`<div class="hd"><b style="font-size:16px">Your unit</b></div>
  <div class="chips">${['£10','£20','£25','£50','£100','Custom'].map(x=>`<button class="chip" aria-current="${x==='£25'}" data-pickone>${x}</button>`).join('')}</div>
  <button class="btn full" style="margin-top:10px" data-toast="Unit set">Save</button>`,
 odds:()=>`<div class="hd"><b style="font-size:16px">Odds format</b></div>
  ${[['Decimal','1.80'],['Fractional','4/5'],['American','−125']].map(o=>`<button class="setrow" data-setodds="${o[0]}">
   <div><div class="k">${o[0]}</div><div class="dd mono">${o[1]}</div></div>${o[0]===cur.oddsFmt?'<span class="pill g">✓</span>':''}</button>`).join('')}`,
 showin:()=>`<div class="hd"><b style="font-size:16px">Show profit in</b></div>
  ${[['Currency','+£80.00'],['Units','+3.20u'],['Both','+£80.00 and +3.20u']].map(o=>`<button class="setrow" data-setshow="${o[0]}">
   <div><div class="k">${o[0]}</div><div class="dd mono">${o[1]}</div></div>${o[0]===cur.showIn?'<span class="pill g">✓</span>':''}</button>`).join('')}`,
 privacy:()=>`<div class="hd"><b style="font-size:16px">Who can see your figures</b></div>
  ${[['Public','Anyone sees your units and ROI'],['Friends only','Only people you follow back'],['Private','No one. Groups you join still do.']].map((o,i)=>`
   <button class="setrow" data-toast="${o[0]}"><div><div class="k">${o[0]}</div><div class="dd">${o[1]}</div></div>${i===1?'<span class="pill g">✓</span>':''}</button>`).join('')}
  <p class="note">Stake sizes are shared inside groups you join, and nowhere else.</p>`,
 card:()=>`<div class="hd"><b style="font-size:16px">Payment method</b></div>
  <label class="flabel">Card number</label><input class="field mono" value="4242 4242 4242 4142">
  <div style="display:flex;gap:9px"><div style="flex:1"><label class="flabel">Expiry</label><input class="field mono" value="09/29"></div>
   <div style="flex:1"><label class="flabel">CVC</label><input class="field mono" value="•••"></div></div>
  <button class="btn full" style="margin-top:12px" data-toast="Card updated">Save</button>`,
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
  <input class="field" value="seun4150@gmail.com"><button class="btn full" style="margin-top:12px" data-toast="Code sent">Send a code</button>`,
 demonote:()=>`<div class="hd"><b style="font-size:16px">This is an example account</b></div>
  <p class="note" style="margin:0 0 14px">Everything here is invented so you can see how the app looks with a full record behind it. Nothing saves.</p>
  <button class="btn ghost full" style="margin-bottom:9px" data-close>Dismiss</button>
  <button class="btn full" data-go="su1">Start free</button>`});

/* ═══ router ═══ */

/* WHAT EACH SCREEN IS CALLED.
 *
 * Every page needs exactly one level-one heading and every piece of content
 * needs to sit inside a landmark, or a screen reader arrives at a wall of
 * text with no way to tell where it is or to skip past it. The prototype had
 * neither: 122 of the landing page's own elements were outside any landmark.
 * Most of these headings are visible on the screen already, so the one that
 * is inserted is read but not drawn. */
const VIEWTITLE={
 landing:'Slippery, a bet tracker', demo:'Demo account',
 su1:'Create your account', su429:'Too many attempts', su2:'Confirm your email',
 su3:'Your name', su4:'Your unit', su5:'Sports and bookmakers', su6:'Choose a plan',
 login:'Sign in',
 overview:'Dashboard', ledger:'Ledger', history:'Imported history',
 social:'Social', discover:'Discover groups', groupdetail:'Group', person:'Profile',
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
 ${[['dash','overview','dsh','Dashboard'],['imp','import','impi','Add a bet'],['soc','social','soci','Social'],['set','settings','seti','Settings']]
 .map(x=>`<button aria-current="${a===x[0]}" data-go="${x[1]}"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${x[2]}"/></svg>${x[3]}</button>`).join('')}</nav>`;
const TABS=t=>`<div class="tabs">${[['OVERVIEW','overview'],['LEDGER','ledger']].map(x=>`<button aria-current="${x[0]===t}" data-go="${x[1]}">${x[0]}</button>`).join('')}</div>`;
const BAR=v=>v.back?`<div class="topback"><button data-go="${v.back}" style="font-size:20px">‹</button>${v.title}</div>`
 :`<div class="appbar">${BRAND}
   <button class="who" data-sheet="profile"><span class="av">${WHOAMI().i}</span><span class="wh mono">${WHOAMI().h}</span></button>
   <div class="barright">${v.run?`<button class="runpill" data-sheet="run"><span class="dotp"></span><span id="runtxt">${cur.running} bets running</span></button>`:''}</div></div>`;
const ph=host;
function go(id){const v=V[id];if(!v)return;
 cur.view=id;
 const heading=`<h1 class="sronly">${VIEWTITLE[id]||'Slippery'}</h1>`;
 ph.innerHTML=`<main class="body" id="main">${heading}${v.bare?'':BAR(v)}${v.tab?TABS(v.tab):''}${v.html()}</main>${v.bare?'':NAVI(v.nav)}`;
 ph.toggleAttribute('data-narrow',!!v.narrow);
 ph.toggleAttribute('data-cols',!!v.cols);
 const bd=ph.querySelector('.body');
 [...bd.children].forEach((c,i)=>{if(c.tagName!=='H1')c.style.animationDelay=(i*55)+'ms'});
 bd.classList.add('enter');setTimeout(()=>bd.classList.remove('enter'),700);
 revealOn();
 if(v.demo&&!cur.demoSeen){cur.demoSeen=true;setTimeout(()=>sheet('demonote'),420);}
 boot();paint();
 onView(id);}
function repaint(){const b=ph.querySelector('.body'),y=b.scrollTop;
 b.querySelectorAll('.pane').forEach(p=>p.remove());
 const t=document.createElement('div');t.innerHTML=V[cur.view].html();
 while(t.firstChild)b.appendChild(t.firstChild);b.scrollTop=y;boot();paint();}
function sheet(k){if(!SH[k])return;
 ph.querySelectorAll('.scrim,.sheet').forEach(x=>x.remove());
 ph.insertAdjacentHTML('beforeend',`<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${k}"><div class="grab"></div>${SH[k]()}</div>`);
 requestAnimationFrame(()=>{const sc=ph.querySelector('.scrim'),sh=ph.querySelector('.sheet');
  if(sc)sc.classList.add('on');if(sh)sh.classList.add('on');allInds();});boot();}
function closeSheet(){const s=ph.querySelector('.scrim'),t=ph.querySelector('.sheet');if(!s||!t)return;
 s.classList.remove('on');t.classList.remove('on');setTimeout(()=>{s.remove();t.remove();},380);}
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

doc.addEventListener('click',e=>{
 if(e.target.closest('[data-home]')){closeSheet();go(cur.signedIn?'overview':'landing');return;}
 if(e.target.closest('[data-signin]')){cur.signedIn=true;closeSheet();go('overview');toast('Signed in');return;}
 const cq=e.target.closest('[data-calctab]');if(cq){cur.calcTab=cq.dataset.calctab;
  const seg=cq.closest('.seg');[...seg.querySelectorAll('button')].forEach(x=>x.setAttribute('aria-current',x===cq));placeInd(seg);
  const bd=document.getElementById('calcBody');if(bd){bd.innerHTML=SH.calcPane(cur.calcTab);allInds()}return}
 if(e.target.closest('[data-cashdo]')){const f=cur.cashF||4,rem=cur.cashRem||100;
  cur.cashRem=+(rem-rem*f/8).toFixed(2);cur.cashF=4;closeSheet();
  toast(`Cashed out ${f}/8 · £${(rem-cur.cashRem).toFixed(2)} settled, £${cur.cashRem.toFixed(2)} still running`);return}
 if(e.target.closest('[data-bulk]')){cur.bulk=!cur.bulk;repaint();return}
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
 if(e.target.closest('[data-undo]')){ph.querySelectorAll('.toast').forEach(x=>x.remove());toast('Restored');return}
 const t=e.target.closest('[data-toast]');if(t){const m=t.dataset.toast;
  toast(m,/delet|remov|reset|cancel|unlink|moved|unfollow|discard/i.test(m));
  if(!e.target.closest('.udl'))closeSheet();return;}
 const dy=e.target.closest('[data-day]');if(dy){cur.dayIdx=+dy.dataset.day;closeSheet();setTimeout(()=>sheet('day'),60);return}
 const so=e.target.closest('[data-setodds]');if(so){cur.oddsFmt=so.dataset.setodds;closeSheet();
  toast('Odds shown as '+cur.oddsFmt.toLowerCase());setTimeout(repaint,80);return}
 const ss=e.target.closest('[data-setshow]');if(ss){cur.showIn=ss.dataset.setshow;closeSheet();
  toast('Profit shown in '+cur.showIn.toLowerCase());setTimeout(repaint,80);return}
 const sp=e.target.closest('[data-setper]');if(sp){cur.per=sp.dataset.setper;closeSheet();
  if(cur.view==='landing'){const sb=document.getElementById('shotBody');
   if(sb){sb.innerHTML=netCard()+calCard();boot();allInds()}return}
  setTimeout(repaint,60);return}
 const ws=e.target.closest('[data-ws]');if(ws){cur.weekStart=+ws.dataset.ws;closeSheet();
  toast('Week starts on '+(cur.weekStart===1?'Monday':'Sunday'));setTimeout(()=>{document.querySelectorAll('[data-cal]').forEach(c=>{c.removeAttribute('data-d');});boot()},260);return}
 const cd=e.target.closest('[data-caldates]');if(cd){cur.calDates=cd.getAttribute('aria-pressed')!=='true';
  cd.setAttribute('aria-pressed',cur.calDates);toast('Calendar dates '+(cur.calDates?'on':'off'));return;}
 const ct=e.target.closest('[data-cal-toggle]');if(ct){
  const card=ct.closest('.card');if(!card)return;
  const w=card.querySelector('[data-calwrap]');if(!w)return;
  const c=w.querySelector('.cal'),ti=card.querySelector('[data-caltitle]');if(!c)return;
  const open=ct.textContent.indexOf('Collapse')>=0;
  if(open){buildCal(c,'week');w.style.maxHeight='150px';ct.textContent='Expand month';ti.textContent='This week';}
  else{buildCal(c,'month');w.style.maxHeight='440px';ct.textContent='Collapse';ti.textContent='August 2026';}
  if(ti)ti.textContent=open?'This week':'August 2026';
  card.classList.toggle('wide',!open);
  [...c.querySelectorAll('.c')].forEach((x,i)=>setTimeout(()=>x.classList.add('in'),i*14));return;}
 const th=e.target.closest('[data-theme]');if(th){const t=th.dataset.theme;if(t===cur.theme)return;
  ph.insertAdjacentHTML('beforeend','<div class="themeveil"></div>');
  const vl=ph.querySelector('.themeveil');
  requestAnimationFrame(()=>{vl.classList.add('on');ph.classList.add('tswap')});
  setTimeout(()=>{cur.theme=t;ph.dataset.t=t;document.body.dataset.t=t;
   ph.querySelectorAll('[data-theme]').forEach(x=>x.setAttribute('aria-current',x.dataset.theme===t));
   vl.classList.remove('on');ph.classList.remove('tswap')},210);
  setTimeout(()=>{vl.remove();toast(THEMES.find(x=>x[0]===t)[1]+' applied')},430);return;}
 const mv=e.target.closest('[data-mv]');if(mv){const k=mv.dataset.k,i=cur.order.indexOf(k),j=mv.dataset.mv==='up'?i-1:i+1;
  if(j>=0&&j<cur.order.length){[cur.order[i],cur.order[j]]=[cur.order[j],cur.order[i]];
   const sh=ph.querySelector('.sheet');sh.innerHTML='<div class="grab"></div>'+SH.editov();repaint();}return;}
 const vi=e.target.closest('[data-above]');if(vi){const k=vi.dataset.above;
  cur.above=cur.above.includes(k)?cur.above.filter(x=>x!==k):[...cur.above,k];
  const sh=ph.querySelector('.sheet');sh.innerHTML='<div class="grab"></div>'+SH.editov();repaint();return;}
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
 const dn=e.target.closest('[data-dnav]');if(dn){deckGo(dcur+(+dn.dataset.dnav));return;}
 if(e.target.closest('#playbtn')){document.getElementById('playwrap').classList.add('gone');runFilm();return;}
});
/* drag reorder */
let dragK=null;
doc.addEventListener('dragstart',e=>{const r=e.target.closest('[data-ek]');if(r){dragK=r.dataset.ek;r.style.opacity='.4';}});
doc.addEventListener('dragend',e=>{const r=e.target.closest('[data-ek]');if(r)r.style.opacity='';dragK=null;});
doc.addEventListener('dragover',e=>{if(dragK)e.preventDefault();});
doc.addEventListener('drop',e=>{const r=e.target.closest('[data-ek]');if(!r||!dragK)return;e.preventDefault();
 const to=r.dataset.ek,i=cur.order.indexOf(dragK),j=cur.order.indexOf(to);
 cur.order.splice(i,1);cur.order.splice(j,0,dragK);
 const sh=ph.querySelector('.sheet');if(sh)sh.innerHTML='<div class="grab"></div>'+SH.editov();repaint();});
/* deck swipe */
let dx0=null,dcur=0,dEl=null;
function deckFit(){const d=document.querySelector('[data-deck]');if(!d)return;
 const sl=d.querySelectorAll('.dslide');if(!sl.length)return;
 const a=sl[Math.min(dcur,sl.length-1)];
 d.style.height=Math.ceil(a.scrollHeight)+'px'}
function deckGo(i){const d=document.querySelector('[data-deck]');if(!d)return;
 const n=d.querySelectorAll('.dslide').length;dcur=Math.max(0,Math.min(n-1,i));
 const tr=d.querySelector('.dtrack');tr.style.transition='';tr.style.transform=`translateX(${-dcur*d.offsetWidth}px)`;
 const dots=document.querySelector('[data-deckdots]');if(dots)[...dots.children].forEach((x,j)=>x.classList.toggle('on',j===dcur));
 document.querySelectorAll('[data-dnav]').forEach(b=>{const v=+b.dataset.dnav;
  b.toggleAttribute('disabled',(v<0&&dcur===0)||(v>0&&dcur===n-1));});deckFit();}
doc.addEventListener('pointerdown',e=>{const d=e.target.closest('[data-deck]');if(!d)return;
 dEl=d;dx0=e.clientX;d.querySelector('.dtrack').style.transition='none';});
doc.addEventListener('pointermove',e=>{if(dx0===null||!dEl)return;
 const w=dEl.offsetWidth,d=e.clientX-dx0;
 dEl.querySelector('.dtrack').style.transform=`translateX(${-dcur*w+d}px)`;});
doc.addEventListener('pointerup',e=>{if(dx0===null||!dEl)return;
 const w=dEl.offsetWidth,d=e.clientX-dx0,n=dEl.querySelectorAll('.dslide').length;
 if(d<-40&&dcur<n-1)dcur++;else if(d>40&&dcur>0)dcur--;
 const tr=dEl.querySelector('.dtrack');tr.style.transition='';tr.style.transform=`translateX(${-dcur*w}px)`;
 const dots=document.querySelector('[data-deckdots]');if(dots)[...dots.children].forEach((x,i)=>x.classList.toggle('on',i===dcur));
 document.querySelectorAll('[data-dnav]').forEach(bb=>{const v=+bb.dataset.dnav;
  bb.toggleAttribute('disabled',(v<0&&dcur===0)||(v>0&&dcur===n-1));});deckFit();
 dx0=null;dEl=null;});

function calCell(d,today){const v=DAYVALS[d]||0,fut=d>today,none=!v&&!fut;
 return `<${v?'button':'div'} class="c ${v>0?'p':v<0?'n':''} ${none?'none':''} ${fut?'fut':''} ${d===today?'today':''}" ${v?`data-day="${d}"`:''}>
  ${v?`<span>${v>0?'+':''}${v}</span>`:''}${cur.calDates?`<span class="dn">${d}</span>`:''}</${v?'button':'div'}>`}
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
  el.textContent=(to<0?'−£':'+£')+Math.abs(v).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(k<1)requestAnimationFrame(t);})(t0);}
/* NAME EVERY CONTROL THAT DRAWS ITS LABEL BESIDE ITSELF.
 *
 * A switch is a square and a field is a box; both take their meaning from
 * the row they sit in, which a screen reader does not read as part of them.
 * Rather than twenty hand-written aria-labels that go stale the moment a row
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
  /* The label a person sees is the .lbl immediately above the field, which
     is how every form in the product is drawn. */
  let el=f.previousElementSibling,text='';
  while(el&&!text){ if(el.classList&&(el.classList.contains('lbl')||el.classList.contains('k')))text=(el.textContent||'').trim(); el=el.previousElementSibling; }
  if(!text)text=f.getAttribute('placeholder')||'';
  if(text)f.setAttribute('aria-label',text);
 });
}

function boot(){
 nameControls(document);
 document.querySelectorAll('[data-cal]:not([data-d])').forEach(el=>{el.setAttribute('data-d',1);buildCal(el,el.dataset.cal);
  [...el.querySelectorAll('.c')].forEach((c,i)=>setTimeout(()=>c.classList.add('in'),i*16));});
 document.querySelectorAll('.fill:not([data-d]),.pacebar .f:not([data-d])').forEach(el=>{el.setAttribute('data-d',1);setTimeout(()=>el.style.width=el.dataset.w+'%',130);});
 document.querySelectorAll('[data-count]:not([data-d])').forEach(el=>{el.setAttribute('data-d',1);countUp(el,+el.dataset.count);});
 document.querySelectorAll('[data-bar]:not([data-d])').forEach((el,i)=>{el.setAttribute('data-d',1);
  el.style.transition='height .7s var(--e)';setTimeout(()=>el.style.height=el.style.getPropertyValue('--th'),90+i*55);});
 document.querySelectorAll('[data-draw]:not([data-d])').forEach(el=>{el.setAttribute('data-d',1);
  const L=el.getTotalLength?el.getTotalLength():600;el.style.strokeDasharray=L;el.style.strokeDashoffset=L;
  el.style.transition='stroke-dashoffset 1.4s var(--e)';setTimeout(()=>el.style.strokeDashoffset=0,120);});
 requestAnimationFrame(()=>{allInds();fitSnaps();deckFit();});setTimeout(deckFit,340);}
let slipIO=null,slipVis=true;
function runSlip(){const host=document.getElementById('slipHost');if(!host)return;let idx=0;slipVis=true;
 if(slipIO)slipIO.disconnect();
 slipIO=new IntersectionObserver(es=>{slipVis=es[0].isIntersecting;},{threshold:.25,root:ph.querySelector('.body')});
 slipIO.observe(host);
 (function cycle(){
  if(!document.body.contains(host)){if(slipIO)slipIO.disconnect();return;}
  if(!slipVis){T.push(setTimeout(cycle,400));return;}
  host.innerHTML=slipHTML(idx);
  const dots=document.getElementById('slipDots');if(dots)[...dots.children].forEach((d,i)=>d.classList.toggle('on',i===idx));
  const slip=host.querySelector('[data-slip]'),legs=[...host.querySelectorAll('[data-leg]')],
   st=host.querySelector('[data-status]'),sx=host.querySelector('[data-stxt]'),
   ret=host.querySelector('[data-ret]'),vd=host.querySelector('[data-verdict]');
  slip.style.setProperty('--scanH',(slip.offsetHeight-2)+'px');
  const msgs=['Analysing slip','Selections','Odds and stake','Fixtures'];
  legs.forEach((leg,i)=>T.push(setTimeout(()=>{legs.forEach(l=>l.classList.remove('reading'));
   leg.classList.add('reading');sx.textContent=msgs[Math.min(i+1,3)];},380+i*560)));
  const end=380+legs.length*560+300;
  T.push(setTimeout(()=>{slip.classList.remove('scanning');st.style.display='none';
   legs.forEach(l=>{l.classList.remove('reading');l.classList.add(l.dataset.r);});
   ret.classList.add('on');vd.classList.add('on');},end));
  T.push(setTimeout(()=>{idx=(idx+1)%SLIPS.length;cycle();},end+2600));})();}
let filmRunning=false;
let revIO=null;
function revealOn(){const root=ph.querySelector('.body');if(!root)return;
 if(revIO)revIO.disconnect();
 const els=[...root.querySelectorAll('.lsec,.lfoot')];
 if(!els.length)return;
 revIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');revIO.unobserve(e.target)}}),
  {root,threshold:.12});
 els.forEach((el,i)=>{if(i<2){el.classList.add('reveal','in');return}el.classList.add('reveal');revIO.observe(el)})}
function fitSnaps(){document.querySelectorAll('[data-snap]').forEach(el=>{
 const box=el.parentElement,w=box.clientWidth,h=box.clientHeight;if(!w||!h)return;
 el.style.width='390px';el.style.transform='none';
 const ch=el.scrollHeight||el.offsetHeight||1;
 const k=Math.min(w/390,h/ch);
 el.style.transform=`scale(${k})`;
 el.style.left=Math.max(0,(w-390*k)/2)+'px';
 box.style.overflow='hidden';});
 document.querySelectorAll('[data-snapcal]:not([data-sd])').forEach(c=>{c.setAttribute('data-sd',1);
  buildCal(c,c.dataset.snapcal);[...c.querySelectorAll('.c')].forEach(x=>x.classList.add('in'))});}
function runFilm(){const film=document.getElementById('film');if(!film||filmRunning)return;filmRunning=true;fitSnaps();
 const scenes=[...film.querySelectorAll('[data-scene]')],bar=document.getElementById('filmbar'),dur=2700;let i=0;
 (function step(){if(!document.body.contains(film)){filmRunning=false;return;}
  scenes.forEach((s,j)=>s.style.opacity=j===i?1:0);
  bar.style.transition='none';bar.style.width=(i/scenes.length*100)+'%';
  requestAnimationFrame(()=>{bar.style.transition=`width ${dur}ms linear`;bar.style.width=((i+1)/scenes.length*100)+'%';});
  fitSnaps();
  scenes[i].querySelectorAll('.slip.scanning').forEach(sl=>sl.style.setProperty('--scanH',(sl.offsetHeight-2)+'px'));
  const c=scenes[i].querySelector('[data-cal]');
  if(c&&!c.dataset.d){c.dataset.d=1;buildCal(c,'month');[...c.querySelectorAll('.c')].forEach((x,k)=>setTimeout(()=>x.classList.add('in'),k*26));}
  i++;
  if(i<scenes.length)T.push(setTimeout(step,dur));
  else T.push(setTimeout(()=>{filmRunning=false;document.getElementById('playwrap')?.classList.remove('gone');
   bar.style.width='0';scenes.forEach((s,j)=>s.style.opacity=j===0?1:0);},dur));})();}
function runRead(){const dots=document.querySelectorAll('#rddots i');if(!dots.length)return;
 const m=['Selections','Odds and stake','Fixtures'],msg=document.getElementById('readmsg');
 dots.forEach((d,i)=>T.push(setTimeout(()=>{d.classList.add('on');if(msg)msg.textContent=m[i];},600+i*1100)));
 T.push(setTimeout(()=>{const s=document.getElementById('rdslip');if(s)s.classList.remove('scanning');
  if(msg)msg.textContent='Done';},600+3*1100));}
function paint(){clearT();runSlip();runRead();}

/* ═══ guided tutorial ═══ */
const TUT=[
 ['overview','[data-cardid=net]','Your figures','Net for the period, with bets, units and turnover. The bar shows your target and where you should be by now.'],
 ['overview','[data-cardid=curve]','Profit over time','Your running total. Flat stretches and drops are as useful as the peaks.'],
 ['overview','[data-cardid=cal]','The calendar','Every day you have a record for. Tap a day for its detail, or expand to the month.'],
 ['overview','[data-cardid=recent]','Recent bets','Tap any bet to see every field, including each leg.'],
 ['overview','.runpill','Bets still running','What is open. Settle by hand or let the results check do it.'],
 ['ledger','.chips','The ledger','Filter by outcome. Outcomes with nothing in them are not shown.'],
 ['social','.gpic','Groups','Compare in units, so stake size stays private outside a group.'],
 ['settings','[data-sheet=unit]','Your unit','Your normal stake. Every comparison uses it.'],
 ['settings','[data-sheet=bot]','Connect Telegram','Link the bot and slips land here on their own.'],
 ['import','.card','Add your first bet','Screenshot, PDF or CSV. This is the last step.']];
let tutI=0,tutOn=false;
function startTut(){tutI=0;tutOn=true;
 ph.querySelector('.tut')?.remove();
 ph.insertAdjacentHTML('beforeend',`<div class="tut"><div class="tutdim"></div><div class="spot"></div>
  <div class="tutbox"><h4></h4><p></p><div class="tutnav"><span class="prog"></span>
  <button class="btn ghost sm" data-tutskip>Skip</button><button class="btn sm" data-tutnext>Next</button></div></div></div>`);
 requestAnimationFrame(()=>{ph.querySelector('.tut').classList.add('on');stepTut()})}
function stepTut(){const t=ph.querySelector('.tut');if(!t)return;const st=TUT[tutI];
 ph.querySelectorAll('.tuthi').forEach(x=>x.classList.remove('tuthi'));
 const paint2=()=>{
  const el=ph.querySelector(st[1]),spot=t.querySelector('.spot'),box=t.querySelector('.tutbox'),p=ph.getBoundingClientRect();
  ph.querySelectorAll('.tuthi').forEach(x=>x.classList.remove('tuthi'));
  if(el)el.classList.add('tuthi');
  t.querySelector('h4').textContent=st[2];t.querySelector('p').textContent=st[3];
  t.querySelector('.prog').textContent=`${tutI+1} of ${TUT.length}`;
  t.querySelector('[data-tutnext]').textContent=tutI===TUT.length-1?'Finish':'Next';
  if(!el){spot.style.opacity=0;box.style.top='50%';return}
  el.scrollIntoView({block:'center',behavior:'instant'});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const r=el.getBoundingClientRect();
   spot.style.opacity=1;
   spot.style.left=(r.left-p.left-6)+'px';spot.style.top=(r.top-p.top-6)+'px';
   spot.style.width=(r.width+12)+'px';spot.style.height=(r.height+12)+'px';
   const bh=box.offsetHeight||160,below=r.bottom-p.top+14;
   box.style.top=(below+bh<p.height-20?below:Math.max(14,r.top-p.top-bh-14))+'px'}))};
 if(cur.view!==st[0]){go(st[0]);ph.appendChild(t);t.classList.add('on');setTimeout(paint2,300)}
 else paint2()}
doc.addEventListener('click',e=>{
 if(e.target.closest('[data-tutnext]')){tutI++;if(tutI>=TUT.length){endTut();toast('Tutorial complete')}else stepTut();return}
 if(e.target.closest('[data-tutskip]')){endTut();return}});
function endTut(){tutOn=false;ph.querySelectorAll('.tuthi').forEach(x=>x.classList.remove('tuthi'));const t=ph.querySelector('.tut');if(t){t.classList.remove('on');setTimeout(()=>t.remove(),420)}}
doc.addEventListener('input',e=>{const sl=e.target.closest('[data-cashslider]');if(!sl)return;
 cur.cashF=+sl.value;const sh=ph.querySelector('.sheet');
 if(sh){const y=sh.scrollTop;sh.innerHTML='<div class="grab"></div>'+SH.cashout();sh.scrollTop=y}});
win.addEventListener('resize',()=>{allInds();fitSnaps();deckFit()});


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
    setTheme(t) { cur.theme = t; ph.dataset.t = t; document.body.dataset.t = t; },
    hydrate(patch) { Object.assign(cur, patch); },
  });
  return () => { clearT(); bound.forEach(([t, ty, fn, o]) => t.removeEventListener(ty, fn, o)); };
}
