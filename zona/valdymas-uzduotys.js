// =============================================================================
//  TRENERIO SKYDELIS: KLIENTŲ UŽDUOTYS
//  Trenerio pusė privačiai užduočių skilčiai. Klientas ją mato tik tada, kai
//  čia jam įjungta (Klientai skiltyje).
// =============================================================================
import { db, $, $$, esc, klaidaLT, pranesk } from './app.js?v=20261114';
import {
  T, KATEGORIJOS, SABLONAI, dataSuDiena, SAVAITES_DIENOS, SAVAITES_DIENOS_TRUMPOS, dienuSuvestine, dataTrumpa,
} from './tekstai.js?v=20261114';
import { apskaiciuok, siandienLT, pridek, privalomosDienai, videoIterpimas, savaitesDiena, dataLT, tikslas, savaitesPazanga, savaitesPirmadienis as savPirmadienis, ipociuVaizdas } from './uzduociu-logika.js?v=20261114';

// Pranešimas rodomas puslapio viršuje, o forma yra apačioje, todėl po kiekvieno
// pranešimo puslapis pastumiamas prie jo, kad jis nepaliktų nepastebėtas.
function zinok(tekstas, tipas) {
  const el = $('#pranesimas');
  pranesk(el, tekstas, tipas);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Naujas stulpelis duomenų bazėje dar nesukurtas (nepaleistas SQL failas).
function dbKlaida(error) {
  const tekstas = String(error?.message || '').toLowerCase();
  if (error?.code === 'PGRST204' || (tekstas.includes('column') && tekstas.includes('schema cache'))) {
    return 'Duomenų bazėje trūksta naujų laukų. Supabase skiltyje SQL Editor paleisk failus uzduotys-progresas.sql ir uzduotys-video.sql, tada bandyk dar kartą.';
  }
  return klaidaLT(error);
}

let pasirinktas = null;   // kliento id
let uzduotys = [];
let atlikimai = [];
let redaguojama = null;   // užduoties id arba null
import { gaukPaketus, piesPaketuPanele, paketai } from './valdymas-paketai.js?v=20261114';
let uzrasai = [];          // kliento nuotaikos ir trenerio žinutės (day_notes)
let nuotaikaVeikia = true;
let aktyvusSkirtukas = 'apzvalga';   // kuris kliento skirtukas matomas
const atviros = new Map();   // skilčių (details) atvirumas, kad perpiešus nesusilankstytų
let ipociuDienos = 14;     // kiek dienų rodo įpročių lentelė
let savaitesPradzia = null; // rodomos savaitės pirmadienis (YYYY-MM-DD)

export async function piesUzduotis(profiliai, savasId) {
  const vieta = $('#kortele-uzduotys');
  const klientai = profiliai.filter((p) => p.id !== savasId && p.uzduotys_ijungtos);

  if (!klientai.length) {
    vieta.innerHTML = `
      <div class="card">
        <div class="card-head"><h2>Klientų užduotys</h2></div>
        <p class="muted">Užduotys dar nė vienam klientui neįjungtos. Skiltyje Klientai prie norimo kliento spausk „Įjungti užduotis“.</p>
      </div>`;
    return;
  }
  if (!klientai.some((k) => k.id === pasirinktas)) pasirinktas = klientai[0].id;

  vieta.innerHTML = `
    <div class="u-klientas-eilute">
      <label for="u-klientas">Klientas</label>
      <div class="field"><select id="u-klientas">
        ${klientai.map((k) => `<option value="${esc(k.id)}"${k.id === pasirinktas ? ' selected' : ''}>${esc(k.full_name || k.email)}</option>`).join('')}
      </select></div>
    </div>
    <div id="u-turinys" style="margin-top:var(--s-200)"><div class="loading"><span class="spinner" aria-hidden="true"></span><span>Kraunama</span></div></div>`;

  $('#u-klientas').addEventListener('change', (e) => {
    pasirinktas = e.target.value;
    redaguojama = null;
    savaitesPradzia = null;
    ikelkKliento();
  });
  await gaukPaketus();
  await ikelkKliento();
}

async function ikelkKliento() {
  const [u, a, n] = await Promise.all([
    db.from('client_challenges').select('*').eq('client_id', pasirinktas)
      .order('position', { ascending: true }).order('created_at', { ascending: true }),
    db.from('challenge_completions').select('id, challenge_id, day, xp, amount').eq('client_id', pasirinktas)
      .order('day', { ascending: true }),
    db.from('day_notes').select('*').eq('client_id', pasirinktas)
      .order('day', { ascending: true }),
  ]);
  // Jei nuotaikos lentelės dar nėra (SQL nepaleistas), likusi dalis veikia kaip veikusi.
  nuotaikaVeikia = !n.error;
  uzrasai = n.data || [];
  if (u.error || a.error) {
    zinok(dbKlaida(u.error || a.error), 'error');
    $('#u-turinys').innerHTML = '';
    return;
  }
  uzduotys = u.data || [];
  atlikimai = a.data || [];
  pieskKliento();
}

function eilutesHtml(sarasas) {
  return sarasas.map((x) => {
    const kat = KATEGORIJOS[x.category] || KATEGORIJOS.iprociai;
    return `
      <tr>
        <td>
          <strong>${esc(x.title)}</strong>
          ${x.description ? `<div class="muted" style="font-size:.8125rem">${esc(x.description)}</div>` : ''}
          ${x.video_url ? '<div class="muted" style="font-size:.8125rem">&#9654; Su video</div>' : ''}
          ${x.target > 1 ? `<div class="muted" style="font-size:.8125rem">Per dieną: ${esc(Number(x.target).toLocaleString('lt-LT'))}${x.unit ? ' ' + esc(x.unit) : ''}, vienas paspaudimas +${esc(Number(x.step).toLocaleString('lt-LT'))}</div>` : ''}
        </td>
        <td>${kat.ikona} ${esc(kat.pavadinimas)}</td>
        <td>${esc(dienuSuvestine(x.weekdays))}</td>
        <td>
          <span class="chip ${x.is_bonus ? 'chip-volt' : 'chip-quiet'}">${x.is_bonus ? 'Papildoma' : 'Privaloma'}</span>
          ${x.active ? '' : '<span class="chip chip-danger">Išjungta</span>'}
        </td>
        <td>
          <div class="row">
            <button class="btn btn-ghost btn-sm u-red" type="button" data-id="${esc(x.id)}">Redaguoti</button>
            <button class="btn btn-ghost btn-sm u-jungti" type="button" data-id="${esc(x.id)}">${x.active ? 'Išjungti' : 'Įjungti'}</button>
            <button class="btn btn-danger btn-sm u-trinti" type="button" data-id="${esc(x.id)}">Trinti</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// -----------------------------------------------------------------------------
//  Filtrai (veikia tik jau užkrautame sąraše, duomenų bazės neliečia)
// -----------------------------------------------------------------------------
const TUSCI_FILTRAI = { q: '', kategorija: '', diena: '', tipas: '', busena: '' };
let filtrai = { ...TUSCI_FILTRAI };

function filtruotos() {
  const q = filtrai.q.trim().toLowerCase();
  return uzduotys.filter((x) => {
    if (q && !`${x.title} ${x.description || ''}`.toLowerCase().includes(q)) return false;
    if (filtrai.kategorija && x.category !== filtrai.kategorija) return false;
    if (filtrai.diena && !x.weekdays.includes(Number(filtrai.diena))) return false;
    if (filtrai.tipas === 'privaloma' && x.is_bonus) return false;
    if (filtrai.tipas === 'papildoma' && !x.is_bonus) return false;
    if (filtrai.tipas === 'su_video' && !x.video_url) return false;
    if (filtrai.tipas === 'su_kiekiu' && !(x.target > 1)) return false;
    if (filtrai.busena === 'aktyvi' && !x.active) return false;
    if (filtrai.busena === 'isjungta' && x.active) return false;
    return true;
  });
}

function filtruBlokas() {
  const pasirinkimas = (reiksme, tekstas, dabartine) =>
    `<option value="${esc(reiksme)}"${dabartine === reiksme ? ' selected' : ''}>${esc(tekstas)}</option>`;
  return `
    <div class="u-filtrai">
      <div class="field">
        <label for="f-q">Paieška</label>
        <input id="f-q" type="search" placeholder="Ieškoti pagal pavadinimą" value="${esc(filtrai.q)}">
      </div>
      <div class="field">
        <label for="f-kategorija">Kategorija</label>
        <select id="f-kategorija">
          ${pasirinkimas('', 'Visos', filtrai.kategorija)}
          ${Object.entries(KATEGORIJOS).map(([k, v]) => pasirinkimas(k, `${v.ikona} ${v.pavadinimas}`, filtrai.kategorija)).join('')}
        </select>
      </div>
      <div class="field">
        <label for="f-diena">Diena</label>
        <select id="f-diena">
          ${pasirinkimas('', 'Visos dienos', filtrai.diena)}
          ${[1, 2, 3, 4, 5, 6, 7].map((d) => pasirinkimas(String(d), SAVAITES_DIENOS[d], filtrai.diena)).join('')}
        </select>
      </div>
      <div class="field">
        <label for="f-tipas">Tipas</label>
        <select id="f-tipas">
          ${pasirinkimas('', 'Visi', filtrai.tipas)}
          ${pasirinkimas('privaloma', 'Privalomos', filtrai.tipas)}
          ${pasirinkimas('papildoma', 'Papildomos', filtrai.tipas)}
          ${pasirinkimas('su_kiekiu', 'Su kiekiu per dieną', filtrai.tipas)}
          ${pasirinkimas('su_video', 'Su video', filtrai.tipas)}
        </select>
      </div>
      <div class="field">
        <label for="f-busena">Būsena</label>
        <select id="f-busena">
          ${pasirinkimas('', 'Visos', filtrai.busena)}
          ${pasirinkimas('aktyvi', 'Aktyvios', filtrai.busena)}
          ${pasirinkimas('isjungta', 'Išjungtos', filtrai.busena)}
        </select>
      </div>
      <div class="field u-filtrai-valyti">
        <button class="btn btn-ghost btn-sm" type="button" id="f-valyti">Išvalyti filtrus</button>
      </div>
    </div>`;
}

function pieskRezultatus() {
  const rodomos = filtruotos();
  const filtruojama = Object.values(filtrai).some(Boolean);
  $('#u-skaicius').textContent = filtruojama ? `Rodoma ${rodomos.length} iš ${uzduotys.length}` : String(uzduotys.length);
  const vieta = $('#u-rezultatai');
  if (!uzduotys.length) {
    vieta.innerHTML = '<p class="muted">Šiam klientui užduočių dar nėra. Pridėk pirmą žemiau.</p>';
    return;
  }
  if (!rodomos.length) {
    vieta.innerHTML = '<p class="muted">Pagal pasirinktus filtrus užduočių nerasta.</p>';
    return;
  }
  vieta.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Užduotis</th><th>Kategorija</th><th>Dienos</th><th>Tipas</th><th></th></tr></thead>
      <tbody>${eilutesHtml(rodomos)}</tbody>
    </table></div>`;
  for (const b of $$('.u-red')) b.addEventListener('click', () => { redaguojama = b.dataset.id; aktyvusSkirtukas = 'uzduotys'; atviros.set('forma', true); pieskKliento(); $('#u-forma').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  for (const b of $$('.u-jungti')) b.addEventListener('click', () => perjunkAktyvuma(b.dataset.id));
  for (const b of $$('.u-trinti')) b.addEventListener('click', () => trink(b.dataset.id));
}

function prijunkFiltrus() {
  const rysys = (id, raktas, ivykis) => {
    $(id)?.addEventListener(ivykis, (e) => { filtrai[raktas] = e.target.value; pieskRezultatus(); });
  };
  rysys('#f-q', 'q', 'input');
  rysys('#f-kategorija', 'kategorija', 'change');
  rysys('#f-diena', 'diena', 'change');
  rysys('#f-tipas', 'tipas', 'change');
  rysys('#f-busena', 'busena', 'change');
  $('#f-valyti')?.addEventListener('click', () => {
    filtrai = { ...TUSCI_FILTRAI };
    for (const [id, v] of [['#f-q', ''], ['#f-kategorija', ''], ['#f-diena', ''], ['#f-tipas', ''], ['#f-busena', '']]) $(id).value = v;
    pieskRezultatus();
  });
}


// -----------------------------------------------------------------------------
//  Atlikimų istorija: ką klientas padarė kiekvieną dieną
// -----------------------------------------------------------------------------
const kiekisTekstas = (u, kiek) =>
  `${Number(kiek).toLocaleString('lt-LT')} / ${Number(tikslas(u)).toLocaleString('lt-LT')}${u.unit ? ' ' + u.unit : ''}`;

// "iš 1 užduoties", "iš 5 užduočių"
const uzduociu = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'užduoties' : 'užduočių');

/** Užduotys, kurios turėjo būti tą dieną, ir ką klientas jose padarė. */
function dienosEilutes(diena, atlikimaiPagalDiena) {
  const wd = savaitesDiena(diena);
  const padaryta = new Map((atlikimaiPagalDiena.get(diena) || []).map((a) => [a.challenge_id, a]));
  const eilutes = [];
  for (const u of uzduotys) {
    const numatyta = u.active && u.weekdays.includes(wd) && dataLT(u.created_at) <= diena;
    const irasas = padaryta.get(u.id);
    if (!numatyta && !irasas) continue;
    const kiek = irasas?.amount || 0;
    eilutes.push({ u, kiek, irasas, atlikta: kiek >= tikslas(u), numatyta });
  }
  return eilutes;
}

const savaitesPirmadienis = (d) => pridek(d, -(savaitesDiena(d) - 1));

/** Pirma diena, nuo kurios apskritai yra ką rodyti: pirma užduotis arba pirmas atlikimas. */
function istorijosPradzia() {
  let p = siandienLT();
  for (const u of uzduotys) { const d = dataLT(u.created_at); if (d < p) p = d; }
  for (const a of atlikimai) if (a.day < p) p = a.day;
  return p;
}

function pieskIstorija() {
  const vieta = $('#u-istorija');
  if (!vieta) return;
  const dabar = siandienLT();
  const pradzia = istorijosPradzia();
  const siosSavaites = savaitesPirmadienis(dabar);
  const pirmaSavaite = savaitesPirmadienis(pradzia);
  if (!savaitesPradzia || savaitesPradzia > siosSavaites) savaitesPradzia = siosSavaites;
  if (savaitesPradzia < pirmaSavaite) savaitesPradzia = pirmaSavaite;
  const savaitesPabaiga = pridek(savaitesPradzia, 6);
  $('#sav-etikete').textContent = `${dataTrumpa(savaitesPradzia)} – ${dataTrumpa(savaitesPabaiga)}${savaitesPradzia === siosSavaites ? ' (ši savaitė)' : ''}`;
  $('#sav-atgal').disabled = savaitesPradzia <= pirmaSavaite;
  $('#sav-pirmyn').disabled = savaitesPradzia >= siosSavaites;
  const pagalDiena = new Map();
  for (const a of atlikimai) {
    if (!pagalDiena.has(a.day)) pagalDiena.set(a.day, []);
    pagalDiena.get(a.day).push(a);
  }

  // Tik šios savaitės dienos nuo pirmos dienos iki šiandien, naujausios viršuje.
  const dienos = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = pridek(savaitesPradzia, i);
    if (d >= pradzia && d <= dabar) dienos.push(d);
  }
  const duomenys = dienos.map((d) => ({ d, eilutes: dienosEilutes(d, pagalDiena) }));

  const dienuBlokai = duomenys.map(({ d, eilutes }, i) => {
    const reikia = eilutes.filter((e) => e.numatyta && !e.u.is_bonus);
    const reikiaPadaryta = reikia.filter((e) => e.atlikta).length;
    const pilna = reikia.length > 0 && reikiaPadaryta === reikia.length;
    const uzrasas = uzrasai.find((n) => n.day === d);
    const nuotaika = T.nuotaikos.find((n) => n.v === uzrasas?.mood);
    const nieko = !eilutes.length;
    let santrauka;
    if (nieko) santrauka = '<span class="chip chip-quiet">Poilsio diena</span>';
    else if (pilna) santrauka = '<span class="chip chip-ok">Pilna diena</span>';
    else if (reikia.length) santrauka = `<span class="chip chip-quiet">Atlikta ${reikiaPadaryta} iš ${reikia.length} ${uzduociu(reikia.length)}</span>`;
    else santrauka = '<span class="chip chip-quiet">Tik papildomos</span>';
    const jau = d === dabar;
    const turinys = `
      ${nieko ? '' : `<ul class="u-ist-sarasas">
        ${eilutes.map((e) => {
          const dalinai = !e.atlikta && e.kiek > 0;
          let busena;
          if (e.atlikta) busena = '<span class="chip chip-ok">Atlikta ✓</span>';
          else if (dalinai) busena = `<span class="chip chip-volt">${esc(kiekisTekstas(e.u, e.kiek))}</span>`;
          else busena = `<span class="chip chip-quiet">${jau ? 'Dar neatlikta' : 'Neatlikta'}</span>`;
          const detale = e.u.target > 1 && e.atlikta ? ` <span class="muted">(${esc(kiekisTekstas(e.u, e.kiek))})</span>` : '';
          return `<li class="${e.atlikta ? 'padaryta' : ''}">
            <span class="u-ist-pavadinimas">${esc(e.u.title)}${detale}${e.u.is_bonus ? ' <span class="chip chip-volt">Papildoma</span>' : ''}${e.numatyta ? '' : ' <span class="chip chip-quiet">Ne pagal planą</span>'}</span>
            ${busena}
          </li>`;
        }).join('')}
      </ul>`}
      ${uzrasoHtml(d, uzrasas)}`;
    return `
      <details class="u-ist-diena">
        <summary>
          <span class="u-ist-data">${esc(dataSuDiena(d))}${jau ? ' <span class="muted">(šiandien)</span>' : ''}</span>
          <span class="u-ist-santrauka">${nuotaika ? `<span class="u-nuotaika" title="${esc(nuotaika.pavadinimas)}">${nuotaika.ikona}</span>` : ''}${uzrasas?.note || uzrasas?.coach_reply ? '<span title="Yra žinutė">💬</span>' : ''}${santrauka}</span>
        </summary>
        ${turinys}
      </details>`;
  }).join('');

  vieta.innerHTML = `<div class="u-ist-dienos">${dienuBlokai}</div>`;
  for (const b of $$('.u-atsakyti')) b.addEventListener('click', () => issiuskAtsakyma(b.dataset.diena));
}

/** Kliento nuotaika, jo parašyta žinutė ir trenerio atsakymo laukas vienai dienai. */
function uzrasoHtml(d, u) {
  if (!nuotaikaVeikia) return '';
  const n = T.nuotaikos.find((x) => x.v === u?.mood);
  return `
    <div class="u-uzrasas">
      ${n ? `<p><span class="u-nuotaika">${n.ikona}</span> <strong>${esc(n.pavadinimas)}</strong></p>` : '<p class="muted">Nuotaikos klientas neįrašė.</p>'}
      ${u?.note ? `<blockquote>${esc(u.note)}</blockquote>` : ''}
      <label class="sr-only" for="atsakymas-${esc(d)}">Tavo žinutė klientui</label>
      <textarea id="atsakymas-${esc(d)}" maxlength="300" rows="2" placeholder="Trumpa žinutė klientui (iki 300 simbolių)">${esc(u?.coach_reply || '')}</textarea>
      <div class="row"><button class="btn btn-ghost btn-sm u-atsakyti" type="button" data-diena="${esc(d)}">${u?.coach_reply ? 'Atnaujinti žinutę' : 'Siųsti žinutę'}</button>
      ${u?.coach_replied_at ? `<span class="muted" style="font-size:.8125rem">Išsiųsta ${esc(dataTrumpa(dataLT(u.coach_replied_at)))} · ${u.coach_reply_read_at ? 'klientas perskaitė ✓' : 'dar neperskaityta'}</span>` : ''}</div>
      ${u?.client_reply ? `<blockquote class="u-kliento-atsakymas"><strong>Kliento atsakymas:</strong> ${esc(u.client_reply)}</blockquote>` : ''}
    </div>`;
}

async function issiuskAtsakyma(diena, tekstas) {
  const laukas = $(`#atsakymas-${diena}`);
  const zinute = (tekstas ?? laukas?.value ?? '').trim();
  const { error } = await db.rpc('admin_atsakyti', { p_client: pasirinktas, p_day: diena, p_reply: zinute });
  if (error) { zinok(dbKlaida(error), 'error'); return; }
  const esamas = uzrasai.find((n) => n.day === diena);
  const laikas = zinute ? new Date().toISOString() : null;
  if (esamas) { esamas.coach_reply = zinute; esamas.coach_replied_at = laikas; }
  else uzrasai = [...uzrasai, { day: diena, mood: null, note: '', coach_reply: zinute, coach_replied_at: laikas }];
  zinok(zinute ? 'Žinutė išsiųsta. Klientas ją pamatys savo puslapyje.' : 'Žinutė ištrinta.', 'ok');
  pieskIstorija();
  pieskZinute();
}


// -----------------------------------------------------------------------------
//  Savaitės planas: kokios užduotys priskirtos kiekvienai savaitės dienai
// -----------------------------------------------------------------------------
function savaitesPlanas() {
  const siandienWd = savaitesDiena(siandienLT());
  const aktyvios = uzduotys.filter((x) => x.active);
  const stulpeliai = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const dienos = aktyvios.filter((x) => x.weekdays.includes(d));
    const privalomos = dienos.filter((x) => !x.is_bonus);
    const papildomos = dienos.filter((x) => x.is_bonus);
    const eilute = (x) => {
      const kat = KATEGORIJOS[x.category] || KATEGORIJOS.iprociai;
      return `<li><span aria-hidden="true">${kat.ikona}</span><span>${esc(x.title)}</span></li>`;
    };
    return `
      <div class="u-plano-diena${d === siandienWd ? ' siandien' : ''}">
        <div class="u-plano-virsus">
          <strong>${esc(SAVAITES_DIENOS[d])}</strong>
          <span class="muted">${dienos.length ? `${dienos.length} ${uzduociuVard(dienos.length)}` : 'poilsio diena'}</span>
        </div>
        <button class="btn btn-ghost btn-sm u-plano-red" type="button" data-diena="${d}">Redaguoti dieną</button>
        ${dienos.length ? `<ul>${privalomos.map(eilute).join('')}</ul>` : ''}
        ${papildomos.length ? `<div class="u-plano-papildomos"><span class="chip chip-volt">Papildomos</span><ul>${papildomos.map(eilute).join('')}</ul></div>` : ''}
      </div>`;
  }).join('');
  return `<div class="u-planas">${stulpeliai}</div>`;
}

// 1 užduotis, 2 užduotys, 10 užduočių
const uzduociuVard = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'užduotis' : (n % 10 === 0 || (n % 100 >= 11 && n % 100 <= 19)) ? 'užduočių' : 'užduotys');


// -----------------------------------------------------------------------------
//  Vienos savaitės dienos redagavimas: kurios užduotys šią dieną
// -----------------------------------------------------------------------------
let redaguojamaDiena = null;

function atidarykDienosRedagavima(diena) {
  redaguojamaDiena = diena;
  $('#u-dienos-antraste').textContent = `${SAVAITES_DIENOS[diena]}: užduotys`;
  pranesk($('#u-dienos-klaida'), '');
  const aktyvios = uzduotys.filter((x) => x.active);
  $('#u-dienos-sarasas').innerHTML = aktyvios.length ? `
    <ul class="u-dienos-sarasas">
      ${aktyvios.map((x) => {
        const kat = KATEGORIJOS[x.category] || KATEGORIJOS.iprociai;
        return `
        <li>
          <label class="check-opt">
            <input type="checkbox" name="u-dienos-uzduotis" value="${esc(x.id)}"${x.weekdays.includes(diena) ? ' checked' : ''}>
            <span>${kat.ikona} ${esc(x.title)}${x.is_bonus ? ' <span class="chip chip-volt">Papildoma</span>' : ''}</span>
          </label>
          <button class="btn btn-ghost btn-sm u-dienos-red" type="button" data-id="${esc(x.id)}">Redaguoti užduotį</button>
        </li>`;
      }).join('')}
    </ul>` : '<p class="muted">Šiam klientui įjungtų užduočių nėra.</p>';
  for (const b of $$('.u-dienos-red')) {
    b.addEventListener('click', () => {
      $('#u-dienos-dialogas').close();
      redaguojama = b.dataset.id;
      aktyvusSkirtukas = 'uzduotys';
      atviros.set('forma', true);
      pieskKliento();
      $('#u-forma').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
  $('#u-dienos-dialogas').showModal();
}

async function issaugokDiena() {
  const diena = redaguojamaDiena;
  const pazymetos = new Set($$('input[name="u-dienos-uzduotis"]:checked').map((i) => i.value));
  const pakeitimai = [];
  for (const x of uzduotys.filter((u) => u.active)) {
    const buvo = x.weekdays.includes(diena);
    const bus = pazymetos.has(x.id);
    if (buvo === bus) continue;
    const dienos = bus
      ? [...x.weekdays, diena]
      : x.weekdays.filter((d) => d !== diena);
    if (!dienos.length) {
      pranesk($('#u-dienos-klaida'), `Užduotis „${x.title}“ liktų be nė vienos dienos. Palik jai bent vieną dieną arba išjunk ją pačią.`, 'error');
      return;
    }
    pakeitimai.push({ id: x.id, weekdays: [...new Set(dienos)].sort((a, b) => a - b) });
  }
  if (!pakeitimai.length) { $('#u-dienos-dialogas').close(); return; }

  const mygtukas = $('#u-dienos-issaugoti');
  mygtukas.disabled = true;
  const rezultatai = await Promise.all(pakeitimai.map((k) =>
    db.from('client_challenges').update({ weekdays: k.weekdays }).eq('id', k.id)));
  mygtukas.disabled = false;
  const klaida = rezultatai.find((r) => r.error)?.error;
  if (klaida) { pranesk($('#u-dienos-klaida'), dbKlaida(klaida), 'error'); return; }
  $('#u-dienos-dialogas').close();
  zinok(`${SAVAITES_DIENOS[diena]}: išsaugota (pakeista užduočių: ${pakeitimai.length}).`, 'ok');
  await ikelkKliento();
}


/**
 * Sulankstoma skiltis. Pavadinimas visada matomas, o turinys atsiveria paspaudus,
 * kad kliento puslapis nebūtų begalinis. Atviros skiltys prisimenamos.
 */
function skiltis(id, pavadinimas, santrauka, turinys, pradziojeAtidaryta = false, priverstinai = false) {
  const atidaryta = priverstinai || (atviros.has(id) ? atviros.get(id) : pradziojeAtidaryta);
  return `
    <details class="u-skiltis card" data-skiltis="${esc(id)}"${atidaryta ? ' open' : ''}>
      <summary><h2>${esc(pavadinimas)}</h2><span class="u-skiltis-santrauka muted">${santrauka || ''}</span></summary>
      <div class="u-skiltis-turinys">${turinys}</div>
    </details>`;
}

function prijunkSkirtukus() {
  for (const b of $$('.u-subtabs [data-skirt]')) {
    b.addEventListener('click', () => {
      aktyvusSkirtukas = b.dataset.skirt;
      for (const t of $$('.u-subtabs [data-skirt]')) t.setAttribute('aria-selected', String(t.dataset.skirt === aktyvusSkirtukas));
      for (const pn of $$('.u-panele')) pn.hidden = pn.dataset.panele !== aktyvusSkirtukas;
    });
  }
}

function prijunkSkiltis() {
  for (const d of $$('details[data-skiltis]')) {
    d.addEventListener('toggle', () => atviros.set(d.dataset.skiltis, d.open));
  }
}

// -----------------------------------------------------------------------------
//  Įpročių vaizdas: kaip sekasi vienu žvilgsniu
// -----------------------------------------------------------------------------
const procTekstas = (p) => (p === null || p === undefined ? '—' : `${p}%`);
const spalvaPagalProc = (p) => (p === null ? 'var(--hair-ink)' : p < 50 ? 'var(--danger)' : p < 80 ? 'var(--volt)' : 'var(--ok)');

function ipociuKortele() {
  const dabar = siandienLT();
  const sia = savaitesPazanga(uzduotys, atlikimai, savPirmadienis(dabar), dabar);
  const praeita = savaitesPazanga(uzduotys, atlikimai, pridek(savPirmadienis(dabar), -7), dabar);
  const st = apskaiciuok(uzduotys.filter((x) => x.active), atlikimai, dabar);
  const v = ipociuVaizdas(uzduotys, atlikimai, ipociuDienos, dabar);

  if (!uzduotys.length) {
    return '<p class="muted">Kai klientas turės užduočių ir jas žymės, čia matysi, kas jam sekasi, o kas sunkiau.</p>';
  }

  // Vidutinė nuotaika paskutinėms 7 dienoms.
  const nuo = pridek(dabar, -6);
  const nuotaikos = uzrasai.filter((n) => n.mood && n.day >= nuo && n.day <= dabar).map((n) => n.mood);
  const vid = nuotaikos.length ? nuotaikos.reduce((a, b) => a + b, 0) / nuotaikos.length : null;
  const vidIkona = vid ? T.nuotaikos[Math.min(4, Math.max(0, Math.round(vid) - 1))].ikona : '—';

  const kat = v.kategorijos;
  let isvada = '';
  if (kat.length >= 2) {
    const blogiausia = kat[0];
    const geriausia = kat[kat.length - 1];
    const vard = (k) => `${KATEGORIJOS[k.kat].ikona} ${KATEGORIJOS[k.kat].pavadinimas}`;
    isvada = blogiausia.proc < 50
      ? `Sunkiausiai sekasi: <strong>${esc(vard(blogiausia))}</strong> (${blogiausia.proc}%). Geriausiai: <strong>${esc(vard(geriausia))}</strong> (${geriausia.proc}%).`
      : `Sekasi gerai. Silpniausia sritis: <strong>${esc(vard(blogiausia))}</strong> (${blogiausia.proc}%), stipriausia: <strong>${esc(vard(geriausia))}</strong> (${geriausia.proc}%).`;
  } else if (kat.length === 1) {
    isvada = `<strong>${esc(KATEGORIJOS[kat[0].kat].ikona + ' ' + KATEGORIJOS[kat[0].kat].pavadinimas)}</strong>: ${kat[0].proc}%.`;
  }

  const kategorijuEilutes = kat.map((k) => {
    const info = KATEGORIJOS[k.kat] || KATEGORIJOS.iprociai;
    const rodykle = k.kryptis > 0 ? '<span class="ip-rodykle gera" title="Pagerėjo, palyginti su ankstesne savaite">▲ geriau</span>'
      : k.kryptis < 0 ? '<span class="ip-rodykle bloga" title="Pablogėjo, palyginti su ankstesne savaite">▼ prasčiau</span>' : '';
    return `
      <div class="ip-kat">
        <span class="ip-kat-pav">${info.ikona} ${esc(info.pavadinimas)}</span>
        <span class="uzd-juosta uzd-juosta-didele ip-juosta"><i style="width:${k.proc}%;background:${spalvaPagalProc(k.proc)}"></i></span>
        <strong class="ip-kat-proc">${k.proc}%</strong>
        ${rodykle}
        ${k.proc < 50 ? '<span class="chip chip-danger">Reikia dėmesio</span>' : ''}
      </div>`;
  }).join('');

  const DIENU = ['Pr', 'An', 'Tr', 'Ke', 'Pe', 'Še', 'Se'];
  const antraste = v.dienos.map((d) => `<span class="ip-d" title="${esc(dataTrumpa(d))}"><i>${DIENU[savaitesDiena(d) - 1]}</i>${Number(d.slice(8))}</span>`).join('');
  const eilutes = v.eilutes.map((e) => {
    const langeliai = e.langeliai.map((l) => {
      const aprasas = { padaryta: 'atlikta', dalinai: 'atlikta dalis', praleista: 'neatlikta', laukia: 'dar neatlikta', nera: 'nenumatyta' }[l.busena];
      return `<span class="ip-c ${l.busena}" style="--a:${l.dalis || 0}" title="${esc(dataTrumpa(l.d) + ': ' + aprasas)}"></span>`;
    }).join('');
    return `
      <div class="ip-eil${e.u.is_bonus ? ' papildoma' : ''}">
        <span class="ip-pav" title="${esc(e.u.title)}">${esc(e.u.title)}${e.u.is_bonus ? ' <em>(papild.)</em>' : ''}</span>
        <span class="ip-proc" style="color:${!e.u.is_bonus && e.proc !== null && e.proc < 50 ? 'var(--danger)' : 'inherit'}">${procTekstas(e.proc)}</span>
        ${langeliai}
      </div>`;
  }).join('');

  const nuotaikuJuosta = nuotaikaVeikia ? `
    <div class="ip-nuotaikos" style="--n:${v.dienos.length}">
      ${v.dienos.map((d) => {
        const u = uzrasai.find((n) => n.day === d);
        const m = T.nuotaikos.find((n) => n.v === u?.mood);
        return `<span class="ip-nu" title="${esc(dataTrumpa(d) + (m ? ': ' + m.pavadinimas : ''))}"><b>${m ? m.ikona : '·'}</b>${u?.note ? '<i title="Yra užrašas">💬</i>' : ''}</span>`;
      }).join('')}
    </div>` : '<p class="muted" style="font-size:.8125rem;margin-top:var(--s-200)">Nuotaikos funkcija dar neįjungta: Supabase SQL Editor paleisk failą uzduotys-nuotaika-paketai.sql.</p>';

  const turinys = `
      <div class="uzd-statai" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
        <div class="uzd-stat"><strong>${procTekstas(sia.proc)}</strong><span>Ši savaitė</span></div>
        <div class="uzd-stat"><strong>${procTekstas(praeita.proc)}</strong><span>Praėjusi savaitė</span></div>
        <div class="uzd-stat"><strong>${vidIkona}</strong><span>Nuotaika (7 d.)</span></div>
      </div>
      ${isvada ? `<p class="ip-isvada">${isvada}</p>` : ''}
      ${kategorijuEilutes ? `<div class="ip-kategorijos">${kategorijuEilutes}</div>` : ''}
      ${nuotaikuJuosta}
      <details class="u-ip-fold" data-skiltis="heatmap"${atviros.get('heatmap') ? ' open' : ''}>
        <summary>Kiekviena užduotis, diena po dienos</summary>
        <div class="u-ip-fold-turinys">
          <div class="field" style="max-width:200px;margin-bottom:var(--s-100)">
            <label for="u-ip-dienos" class="sr-only">Laikotarpis</label>
            <select id="u-ip-dienos">
              ${[14, 28].map((n) => `<option value="${n}"${n === ipociuDienos ? ' selected' : ''}>Paskutinės ${n} d.</option>`).join('')}
            </select>
          </div>
          <div class="ip-lentele-wrap">
            <div class="ip-lentele" style="--n:${v.dienos.length}">
              <div class="ip-eil ip-antraste"><span></span><span></span>${antraste}</div>
              ${eilutes}
            </div>
          </div>
          <div class="ip-legenda">
            <span><i class="ip-c padaryta"></i> atlikta</span>
            <span><i class="ip-c dalinai"></i> dalis</span>
            <span><i class="ip-c praleista"></i> neatlikta</span>
            <span><i class="ip-c laukia"></i> šiandien dar laukia</span>
          </div>
        </div>
      </details>`;
  return turinys;
}

// -----------------------------------------------------------------------------
//  Žinutė klientui (rodoma jo puslapio viršuje)
// -----------------------------------------------------------------------------
function pieskZinute() {
  const vieta = $('#u-zinute-vieta');
  if (!vieta) return;
  if (!nuotaikaVeikia) { vieta.innerHTML = ''; return; }
  const paskutine = [...uzrasai].reverse().find((n) => n.coach_reply);
  vieta.innerHTML = `
      <p class="muted" style="margin-bottom:var(--s-100);font-size:.875rem">Iki 300 simbolių. Klientas ją mato savo puslapio viršuje 7 dienas.</p>
      <div class="field">
        <label for="u-zinute" class="sr-only">Žinutė</label>
        <textarea id="u-zinute" maxlength="300" rows="2" placeholder="Pavyzdžiui: Labai didžiuojuosi tavo žingsniais!"></textarea>
      </div>
      <div class="form-actions" style="margin-top:var(--s-100)">
        <button class="btn btn-primary btn-sm" type="button" id="u-zinute-siusti">Siųsti</button>
      </div>
      ${paskutine ? `<p class="muted" style="margin-top:var(--s-200);font-size:.8125rem">Paskutinė žinutė (${esc(dataTrumpa(paskutine.day))}): „${esc(paskutine.coach_reply)}“ · ${paskutine.coach_reply_read_at ? 'klientas perskaitė ✓' : 'dar neperskaityta'}</p>` : ''}
      ${paskutine?.client_reply ? `<blockquote class="u-kliento-atsakymas"><strong>Klientas atsakė:</strong> ${esc(paskutine.client_reply)}</blockquote>` : ''}`;
  $('#u-zinute-siusti').addEventListener('click', () => {
    const tekstas = $('#u-zinute').value.trim();
    if (!tekstas) { zinok('Parašyk žinutę.', 'error'); return; }
    issiuskAtsakyma(siandienLT(), tekstas);
  });
}

// -----------------------------------------------------------------------------
//  Paketai kliento skiltyje
// -----------------------------------------------------------------------------
function paketuKontekstas() {
  return {
    klientoId: () => pasirinktas,
    turi: () => new Set(uzduotys.filter((x) => x.active).map((x) => x.title.trim().toLowerCase())),
    poPriskyrimo: () => ikelkKliento(),
    zinok,
  };
}

async function issaugokKaipPaketa() {
  const aktyvios = uzduotys.filter((x) => x.active).length;
  if (!aktyvios) { zinok('Šis klientas neturi įjungtų užduočių, nėra ką išsaugoti.', 'error'); return; }
  const vardas = (window.prompt(`Kaip pavadinti paketą? Bus išsaugota užduočių: ${aktyvios}.`) || '').trim();
  if (!vardas) return;
  const { error } = await db.rpc('admin_issaugoti_paketa', { p_client: pasirinktas, p_name: vardas, p_description: '' });
  if (error) { zinok(dbKlaida(error), 'error'); return; }
  await gaukPaketus();
  piesPaketuPanele($('#u-paketu-vieta'), paketuKontekstas());
  zinok(`Paketas „${vardas}“ išsaugotas. Jį galima redaguoti skiltyje „Paketai“.`, 'ok');
}

function pieskKliento() {
  const st = apskaiciuok(uzduotys.filter((x) => x.active), atlikimai, siandienLT());
  const r = redaguojama ? uzduotys.find((x) => x.id === redaguojama) : null;
  const dienuPasirinkimas = [1, 2, 3, 4, 5, 6, 7].map((d) => `
    <label class="chip-opt"><input type="checkbox" name="u-diena" value="${d}"${(r ? r.weekdays.includes(d) : true) ? ' checked' : ''}><span>${SAVAITES_DIENOS_TRUMPOS[d]}</span></label>`).join('');

  const aktyviu = uzduotys.filter((x) => x.active).length;
  const arTuscias = !uzduotys.length;
  const filtruojama = Object.values(filtrai).some(Boolean);
  if (arTuscias && aktyvusSkirtukas === 'apzvalga' && paketai.length) aktyvusSkirtukas = 'paketai';

  const skirtukai = [
    ['apzvalga', 'Apžvalga'],
    ['istorija', 'Istorija'],
    ['uzduotys', `Užduotys (${uzduotys.length})`],
    ['planas', 'Savaitės planas'],
    ['paketai', 'Paketai'],
  ];
  const panele = (id, turinys) => `<section class="u-panele" data-panele="${id}"${aktyvusSkirtukas === id ? '' : ' hidden'}>${turinys}</section>`;

  $('#u-turinys').innerHTML = `
    <div class="tabs tabs-maza u-subtabs" role="tablist" aria-label="Kliento užduotys">
      ${skirtukai.map(([id, pav]) => `<button class="tab" role="tab" type="button" data-skirt="${id}" aria-selected="${aktyvusSkirtukas === id}">${esc(pav)}</button>`).join('')}
    </div>

    ${panele('apzvalga', `
      <div class="card">
        <h3 class="u-panele-antraste">Kaip sekasi</h3>
        ${ipociuKortele(st)}
      </div>
      <div class="card" style="margin-top:var(--s-200)">
        <h3 class="u-panele-antraste">Žinutė klientui</h3>
        <div id="u-zinute-vieta"></div>
      </div>`)}

    ${panele('istorija', `
      <div class="card">
        <div class="card-head">
          <h3 class="u-panele-antraste">Ką klientas atliko</h3>
          <div class="u-savaite row-end">
            <button class="kal-rodykle" type="button" id="sav-atgal" aria-label="Ankstesnė savaitė">‹</button>
            <span id="sav-etikete" aria-live="polite"></span>
            <button class="kal-rodykle" type="button" id="sav-pirmyn" aria-label="Kita savaitė">›</button>
          </div>
        </div>
        <div id="u-istorija"></div>
      </div>`)}

    ${panele('uzduotys', `
      ${skiltis('forma', r ? 'Redaguoti užduotį' : '+ Nauja užduotis', '', `
      <form id="u-forma" novalidate>
        ${r ? '' : `
        <div class="field">
          <label for="u-sablonas">Greita pradžia <span class="hint">(neprivaloma, užpildo laukus)</span></label>
          <select id="u-sablonas">
            <option value="">Pasirink pavyzdį</option>
            ${['judejimas', 'proto_ramybe', 'mityba', 'vanduo', 'miegas'].map((k) => `
              <optgroup label="${esc(KATEGORIJOS[k].ikona + ' ' + KATEGORIJOS[k].pavadinimas)}">
                ${SABLONAI.map((s, i) => (s.category === k ? `<option value="${i}">${esc(s.title)}</option>` : '')).join('')}
              </optgroup>`).join('')}
          </select>
        </div>`}
        <div class="field">
          <label for="u-pavadinimas">Pavadinimas</label>
          <input id="u-pavadinimas" type="text" maxlength="160" required placeholder="Pavyzdžiui, Išgerk 2 litrus vandens" value="${esc(r?.title || '')}">
        </div>
        <div class="field">
          <label for="u-aprasas">Aprašymas <span class="hint">(neprivaloma, klientas jį mato po pavadinimu)</span></label>
          <input id="u-aprasas" type="text" placeholder="Pavyzdžiui, Pusę iki pietų, pusę po pietų" value="${esc(r?.description || '')}">
        </div>
        <div class="field-row" style="margin-top:var(--s-300)">
          <div class="field">
            <label for="u-kategorija">Kategorija</label>
            <select id="u-kategorija">
              ${Object.entries(KATEGORIJOS).map(([k, v]) => `<option value="${k}"${(r?.category || 'iprociai') === k ? ' selected' : ''}>${v.ikona} ${esc(v.pavadinimas)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="u-tipas">Tipas</label>
            <select id="u-tipas">
              <option value="0"${r?.is_bonus ? '' : ' selected'}>Privaloma (reikia, kad diena būtų pilna)</option>
              <option value="1"${r?.is_bonus ? ' selected' : ''}>Papildoma (neprivaloma)</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="u-video">Video nuoroda <span class="hint">(neprivaloma, YouTube arba Vimeo)</span></label>
          <input id="u-video" type="url" maxlength="500" placeholder="https://www.youtube.com/watch?v=..." value="${esc(r?.video_url || '')}">
          <span class="hint">Klientas prie užduoties matys mygtuką „Žiūrėti video“. Filmuok telefonu, įkelk į YouTube kaip „Unlisted“ (nematomas paieškoje) ir įklijuok nuorodą čia.</span>
        </div>
        <div class="field-row" style="margin-top:var(--s-300)">
          <div class="field">
            <label for="u-kiekis">Kiek per dieną <span class="hint">(1 = paprasta užduotis)</span></label>
            <input id="u-kiekis" type="number" min="1" max="100000" value="${r?.target ?? 1}">
          </div>
          <div class="field">
            <label for="u-vienetas">Kas skaičiuojama <span class="hint">(neprivaloma)</span></label>
            <input id="u-vienetas" type="text" maxlength="30" placeholder="stiklinių, žingsnių..." value="${esc(r?.unit || '')}">
          </div>
          <div class="field">
            <label for="u-zingsnis">Vienas paspaudimas prideda</label>
            <input id="u-zingsnis" type="number" min="1" max="100000" value="${r?.step ?? 1}">
          </div>
        </div>
        <p class="muted" style="font-size:.8125rem;margin-top:var(--s-100)">
          Pavyzdžiui, 10 stiklinių vandens: kiekis 10, vienetas „stiklinių“, žingsnis 1. Klientas gali pažymėti 2 stiklines iš ryto, o likusias vėliau.
        </p>
        <div class="field">
          <span class="legend-inline">Kuriomis dienomis</span>
          <div class="chips" role="group" aria-label="Savaitės dienos">${dienuPasirinkimas}</div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${r ? 'Išsaugoti' : 'Pridėti užduotį'}</button>
          ${r ? '<button class="btn btn-ghost" type="button" id="u-atsaukti">Atšaukti</button>' : ''}
        </div>
      </form>`, false, !!r)}
      <div class="card" style="margin-top:var(--s-200)">
        <div class="card-head"><h3 class="u-panele-antraste">Visos užduotys</h3><span class="row-end muted" id="u-skaicius"></span></div>
        ${uzduotys.length ? `
        <details class="u-filtrai-fold" data-skiltis="filtrai"${atviros.get('filtrai') || filtruojama ? ' open' : ''}>
          <summary>Filtrai${filtruojama ? ' (įjungti)' : ''}</summary>
          ${filtruBlokas()}
        </details>` : ''}
        <div id="u-rezultatai"></div>
      </div>`)}

    ${panele('planas', `
      <div class="card">
        <h3 class="u-panele-antraste">Savaitės planas</h3>
        <p class="muted" style="margin-bottom:var(--s-200);font-size:.875rem">Kokios užduotys priskirtos kiekvienai savaitės dienai. „Redaguoti dieną“ keičia, kurios užduotys tą dieną.</p>
        ${savaitesPlanas()}
      </div>`)}

    ${panele('paketai', `
      <div class="card">
        <div class="card-head">
          <h3 class="u-panele-antraste">Užduočių paketai</h3>
          <button class="btn btn-ghost btn-sm row-end" type="button" id="u-paketas-issaugoti">Išsaugoti kliento užduotis kaip paketą</button>
        </div>
        <p class="muted" style="margin-bottom:var(--s-200);font-size:.875rem">Atidaryk paketą, kad pamatytum, kas jame yra ir kuriomis dienomis. Čia pat gali jį pridėti šiam klientui arba redaguoti.</p>
        <div id="u-paketu-vieta"></div>
      </div>`)}

    <dialog id="u-dienos-dialogas" aria-labelledby="u-dienos-antraste">
      <div class="dialog-in">
        <h2 id="u-dienos-antraste"></h2>
        <p class="muted" style="margin-bottom:var(--s-200);font-size:.875rem">Pažymėtos užduotys bus šią dieną. Nuimk varnelę, jei užduoties tą dieną nebereikia.</p>
        <p class="note note-error" id="u-dienos-klaida" hidden></p>
        <div id="u-dienos-sarasas"></div>
        <div class="form-actions">
          <button class="btn btn-primary" type="button" id="u-dienos-issaugoti">Išsaugoti</button>
          <button class="btn btn-ghost" type="button" id="u-dienos-uzdaryti">Atšaukti</button>
        </div>
      </div>
    </dialog>`;

  $('#u-sablonas')?.addEventListener('change', (e) => {
    const s = SABLONAI[Number(e.target.value)];
    if (!s) return;
    $('#u-pavadinimas').value = s.title;
    $('#u-kategorija').value = s.category;
    $('#u-kiekis').value = s.target || 1;
    $('#u-vienetas').value = s.unit || '';
    $('#u-zingsnis').value = s.step || 1;
    $('#u-aprasas').value = s.description || '';
  });
  $('#u-forma').addEventListener('submit', issaugok);
  $('#u-atsaukti')?.addEventListener('click', () => { redaguojama = null; pieskKliento(); });
  for (const b of $$('.u-plano-red')) b.addEventListener('click', () => atidarykDienosRedagavima(Number(b.dataset.diena)));
  $('#u-dienos-uzdaryti').addEventListener('click', () => $('#u-dienos-dialogas').close());
  $('#u-dienos-issaugoti').addEventListener('click', issaugokDiena);
  prijunkSkiltis();
  prijunkSkirtukus();
  piesPaketuPanele($('#u-paketu-vieta'), paketuKontekstas());
  $('#u-paketas-issaugoti').addEventListener('click', issaugokKaipPaketa);
  $('#u-ip-dienos')?.addEventListener('change', (e) => { ipociuDienos = Number(e.target.value); pieskKliento(); });
  pieskZinute();
  prijunkFiltrus();
  pieskRezultatus();
  $('#sav-atgal').addEventListener('click', () => { savaitesPradzia = pridek(savaitesPradzia, -7); pieskIstorija(); });
  $('#sav-pirmyn').addEventListener('click', () => { savaitesPradzia = pridek(savaitesPradzia, 7); pieskIstorija(); });
  pieskIstorija();
}

async function issaugok(ev) {
  ev.preventDefault();
  const pavadinimas = $('#u-pavadinimas').value.trim();
  const dienos = $$('input[name="u-diena"]:checked').map((i) => Number(i.value));
  const kiekis = Number($('#u-kiekis').value);
  const zingsnis = Number($('#u-zingsnis').value);
  if (!pavadinimas) { zinok('Įrašyk užduoties pavadinimą.', 'error'); return; }
  if (!dienos.length) { zinok('Pasirink bent vieną savaitės dieną.', 'error'); return; }

  if (!Number.isInteger(kiekis) || kiekis < 1 || kiekis > 100000) { zinok('Kiekis per dieną turi būti skaičius nuo 1 iki 100 000.', 'error'); return; }
  if (!Number.isInteger(zingsnis) || zingsnis < 1 || zingsnis > kiekis) { zinok('Žingsnis turi būti skaičius nuo 1 iki dienos kiekio.', 'error'); return; }

  const video = $('#u-video').value.trim();
  if (video && !videoIterpimas(video)) {
    zinok('Video nuoroda netinka. Įklijuok pilną YouTube arba Vimeo nuorodą, prasidedančią https://.', 'error');
    return;
  }

  const eilute = {
    video_url: video,
    target: kiekis,
    unit: $('#u-vienetas').value.trim(),
    step: zingsnis,
    title: pavadinimas,
    description: $('#u-aprasas').value.trim(),
    category: $('#u-kategorija').value,
    is_bonus: $('#u-tipas').value === '1',
    weekdays: dienos,
  };
  const { error } = redaguojama
    ? await db.from('client_challenges').update(eilute).eq('id', redaguojama)
    : await db.from('client_challenges').insert({ ...eilute, client_id: pasirinktas, position: uzduotys.length });
  if (error) { zinok(dbKlaida(error), 'error'); return; }
  zinok(redaguojama ? 'Užduotis išsaugota.' : 'Užduotis pridėta.', 'ok');
  redaguojama = null;
  await ikelkKliento();
}

async function perjunkAktyvuma(id) {
  const x = uzduotys.find((u) => u.id === id);
  if (!x) return;
  const { error } = await db.from('client_challenges').update({ active: !x.active }).eq('id', id);
  if (error) { zinok(dbKlaida(error), 'error'); return; }
  zinok(x.active ? 'Užduotis išjungta, klientas jos nebemato.' : 'Užduotis įjungta.', 'ok');
  await ikelkKliento();
}

async function trink(id) {
  const x = uzduotys.find((u) => u.id === id);
  if (!x) return;
  if (!confirm(`Ištrinti užduotį "${x.title}"?\n\nKartu dings jos atlikimų istorija ir su ja surinkti taškai. Jei nori tik paslėpti nuo kliento, geriau spausk „Išjungti“.`)) return;
  const { error } = await db.from('client_challenges').delete().eq('id', id);
  if (error) { zinok(dbKlaida(error), 'error'); return; }
  zinok('Užduotis ištrinta.', 'ok');
  await ikelkKliento();
}
