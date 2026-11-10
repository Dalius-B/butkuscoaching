// =============================================================================
//  TRENERIO SKYDELIS: UŽDUOČIŲ PAKETAI
//  Paruošti, redaguojami užduočių rinkiniai (pvz. „Švelnus startas“). Paketas
//  klientui priskiriamas kliento užduočių skiltyje (valdymas-uzduotys.js).
//  Klientai paketų nemato ir jų neskaito: lentelės tik treneriui.
// =============================================================================
import { db, $, $$, esc, klaidaLT, pranesk } from './app.js?v=20261110';
import {
  KATEGORIJOS, SAVAITES_DIENOS_TRUMPOS, dienuSuvestine,
} from './tekstai.js?v=20261110';
import { videoIterpimas } from './uzduociu-logika.js?v=20261110';

export const PAKETAI_PASIKEITE = 'paketai-pasikeite';

/** Visi paketai su savo užduotimis. Importuojantys failai mato naujausią reikšmę. */
export let paketai = [];
let paketuKlaida = null;
let atvertas = null;     // atverto paketo id
let redaguojama = null;  // { pack, item } redaguojamas paketo elementas

function zinok(tekstas, tipas) {
  const el = $('#pranesimas');
  pranesk(el, tekstas, tipas);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function dbKlaida(error) {
  const t = String(error?.message || '').toLowerCase();
  if (error?.code === 'PGRST205' || t.includes('could not find the table') || t.includes('task_pack')) {
    return 'Paketų lentelių dar nėra. Supabase skiltyje SQL Editor paleisk failą uzduotys-nuotaika-paketai.sql.';
  }
  if (error?.code === '23505') return 'Paketas tokiu pavadinimu jau yra.';
  return klaidaLT(error);
}

// 1 užduotis, 2 užduotys, 10 užduočių
const uzduociuVard = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'užduotis' : (n % 10 === 0 || (n % 100 >= 11 && n % 100 <= 19)) ? 'užduočių' : 'užduotys');

export async function gaukPaketus() {
  const [p, i] = await Promise.all([
    db.from('task_packs').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
    db.from('task_pack_items').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
  ]);
  paketuKlaida = p.error || i.error || null;
  const elementai = i.data || [];
  paketai = (p.data || []).map((x) => ({ ...x, items: elementai.filter((it) => it.pack_id === x.id) }));
  return paketai;
}

function pranesk_pasikeitimas() {
  document.dispatchEvent(new CustomEvent(PAKETAI_PASIKEITE));
}

// -----------------------------------------------------------------------------
//  Piešimas
// -----------------------------------------------------------------------------
export async function piesPaketus() {
  const vieta = $('#kortele-paketai');
  if (!vieta) return;
  await gaukPaketus();
  pieskPaketus();
}

function elementoEilute(pk, it) {
  const kat = KATEGORIJOS[it.category] || KATEGORIJOS.iprociai;
  const kiekis = it.target > 1 ? ` <span class="muted">${esc(Number(it.target).toLocaleString('lt-LT'))}${it.unit ? ' ' + esc(it.unit) : ''}</span>` : '';
  return `
    <tr>
      <td><strong>${esc(it.title)}</strong>${kiekis}
        ${it.description ? `<div class="muted" style="font-size:.8125rem">${esc(it.description)}</div>` : ''}
        ${it.video_url ? '<div class="muted" style="font-size:.8125rem">&#9654; Su video</div>' : ''}</td>
      <td>${kat.ikona} ${esc(kat.pavadinimas)}</td>
      <td>${esc(dienuSuvestine(it.weekdays))}</td>
      <td><span class="chip ${it.is_bonus ? 'chip-volt' : 'chip-quiet'}">${it.is_bonus ? 'Papildoma' : 'Privaloma'}</span></td>
      <td><div class="row">
        <button class="btn btn-ghost btn-sm" type="button" data-act="red-elem" data-pack="${esc(pk.id)}" data-item="${esc(it.id)}">Redaguoti</button>
        <button class="btn btn-danger btn-sm" type="button" data-act="trinti-elem" data-pack="${esc(pk.id)}" data-item="${esc(it.id)}">Trinti</button>
      </div></td>
    </tr>`;
}

function elementoForma(pk) {
  const r = redaguojama && redaguojama.pack === pk.id ? pk.items.find((x) => x.id === redaguojama.item) : null;
  const dienos = [1, 2, 3, 4, 5, 6, 7].map((d) => `
    <label class="chip-opt"><input type="checkbox" name="pi-diena" value="${d}"${(r ? r.weekdays.includes(d) : true) ? ' checked' : ''}><span>${SAVAITES_DIENOS_TRUMPOS[d]}</span></label>`).join('');
  return `
    <form class="pi-forma" data-pack="${esc(pk.id)}" novalidate>
      <h4>${r ? 'Redaguoti užduotį' : 'Pridėti užduotį į paketą'}</h4>
      <div class="field">
        <label for="pi-pav-${esc(pk.id)}">Pavadinimas</label>
        <input id="pi-pav-${esc(pk.id)}" name="title" type="text" maxlength="160" required value="${esc(r?.title || '')}">
      </div>
      <div class="field">
        <label for="pi-apr-${esc(pk.id)}">Aprašymas <span class="hint">(neprivaloma)</span></label>
        <input id="pi-apr-${esc(pk.id)}" name="description" type="text" value="${esc(r?.description || '')}">
      </div>
      <div class="field-row" style="margin-top:var(--s-200)">
        <div class="field">
          <label>Kategorija</label>
          <select name="category">
            ${Object.entries(KATEGORIJOS).map(([k, v]) => `<option value="${k}"${(r?.category || 'iprociai') === k ? ' selected' : ''}>${v.ikona} ${esc(v.pavadinimas)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Tipas</label>
          <select name="is_bonus">
            <option value="0"${r?.is_bonus ? '' : ' selected'}>Privaloma</option>
            <option value="1"${r?.is_bonus ? ' selected' : ''}>Papildoma</option>
          </select>
        </div>
      </div>
      <div class="field-row" style="margin-top:var(--s-200)">
        <div class="field"><label>Kiek per dieną <span class="hint">(1 = paprasta)</span></label><input name="target" type="number" min="1" max="100000" value="${r?.target ?? 1}"></div>
        <div class="field"><label>Kas skaičiuojama</label><input name="unit" type="text" maxlength="30" placeholder="stiklinių, žingsnių..." value="${esc(r?.unit || '')}"></div>
        <div class="field"><label>Vienas paspaudimas prideda</label><input name="step" type="number" min="1" max="100000" value="${r?.step ?? 1}"></div>
      </div>
      <div class="field">
        <span class="legend-inline">Kuriomis dienomis</span>
        <div class="chips" role="group" aria-label="Savaitės dienos">${dienos}</div>
      </div>
      <div class="field">
        <label>Video nuoroda <span class="hint">(neprivaloma, YouTube arba Vimeo)</span></label>
        <input name="video_url" type="url" maxlength="500" placeholder="https://www.youtube.com/watch?v=..." value="${esc(r?.video_url || '')}">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-sm" type="submit">${r ? 'Išsaugoti' : 'Pridėti'}</button>
        ${r ? `<button class="btn btn-ghost btn-sm" type="button" data-act="atsaukti-elem">Atšaukti</button>` : ''}
      </div>
    </form>`;
}

function pieskPaketus() {
  const vieta = $('#kortele-paketai');
  if (paketuKlaida) {
    vieta.innerHTML = `<div class="card"><div class="card-head"><h2>Užduočių paketai</h2></div><p class="note note-error">${esc(dbKlaida(paketuKlaida))}</p></div>`;
    return;
  }

  const blokai = paketai.map((pk) => `
    <details class="u-ist-diena pi-paketas" data-pack="${esc(pk.id)}"${atvertas === pk.id ? ' open' : ''}>
      <summary>
        <span class="u-ist-data">${esc(pk.name)}</span>
        <span class="u-ist-santrauka muted">${pk.items.length} ${uzduociuVard(pk.items.length)}</span>
      </summary>
      <div class="pi-turinys">
        <form class="pi-pavadinimo-forma" data-pack="${esc(pk.id)}" novalidate>
          <div class="field">
            <label for="pk-vardas-${esc(pk.id)}">Paketo pavadinimas</label>
            <input id="pk-vardas-${esc(pk.id)}" name="name" type="text" maxlength="80" value="${esc(pk.name)}">
          </div>
          <div class="field">
            <label for="pk-apr-${esc(pk.id)}">Aprašymas <span class="hint">(tik tau)</span></label>
            <textarea id="pk-apr-${esc(pk.id)}" name="description" maxlength="400" rows="2">${esc(pk.description || '')}</textarea>
          </div>
          <div class="row" style="margin-top:var(--s-100)">
            <button class="btn btn-ghost btn-sm" type="submit">Išsaugoti pavadinimą</button>
            <button class="btn btn-danger btn-sm" type="button" data-act="trinti-paketa" data-pack="${esc(pk.id)}">Trinti paketą</button>
          </div>
        </form>
        ${pk.items.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Užduotis</th><th>Kategorija</th><th>Dienos</th><th>Tipas</th><th></th></tr></thead>
          <tbody>${pk.items.map((it) => elementoEilute(pk, it)).join('')}</tbody>
        </table></div>` : '<p class="muted">Šiame pakete užduočių dar nėra.</p>'}
        ${elementoForma(pk)}
      </div>
    </details>`).join('');

  $('#kortele-paketai').innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Užduočių paketai</h2><span class="row-end muted">${paketai.length}</span></div>
      <p class="muted" style="margin-bottom:var(--s-200)">
        Paruošti užduočių rinkiniai. Redaguok juos čia, o klientui pridėk skiltyje „Užduotys“ (pasirink klientą, kortelė „Užduočių paketai“).
        Pakeitimai paketuose neveikia klientų, kurie paketą jau gavo.
      </p>
      <div class="u-ist-dienos">${blokai || '<p class="muted">Paketų dar nėra. Sukurk pirmą žemiau.</p>'}</div>
    </div>
    <div class="card" style="margin-top:var(--s-300)">
      <div class="card-head"><h2>Naujas paketas</h2></div>
      <form id="pk-naujas" novalidate>
        <div class="field">
          <label for="pk-n-vardas">Pavadinimas</label>
          <input id="pk-n-vardas" type="text" maxlength="80" placeholder="Pavyzdžiui, Ramesnė savaitė">
        </div>
        <div class="field">
          <label for="pk-n-apr">Aprašymas <span class="hint">(neprivaloma, tik tau)</span></label>
          <input id="pk-n-apr" type="text" maxlength="400">
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Sukurti paketą</button></div>
      </form>
      <p class="muted" style="margin-top:var(--s-200);font-size:.875rem">Arba atidaryk klientą skiltyje „Užduotys“ ir spausk „Išsaugoti šias užduotis kaip paketą“.</p>
    </div>`;

  prijunkValdikli();
}

function prijunkValdikli() {
  const vieta = $('#kortele-paketai');
  for (const d of $$('.pi-paketas', vieta)) {
    d.addEventListener('toggle', () => { if (d.open) atvertas = d.dataset.pack; else if (atvertas === d.dataset.pack) atvertas = null; });
  }
  for (const b of $$('[data-act]', vieta)) b.addEventListener('click', () => veiksmas(b));
  for (const f of $$('.pi-forma', vieta)) f.addEventListener('submit', issaugokElementa);
  for (const f of $$('.pi-pavadinimo-forma', vieta)) f.addEventListener('submit', issaugokPavadinima);
  $('#pk-naujas').addEventListener('submit', sukurkPaketa);
}

async function perkrauk(zinute) {
  await gaukPaketus();
  pieskPaketus();
  pranesk_pasikeitimas();
  if (zinute) zinok(zinute, 'ok');
}

async function veiksmas(b) {
  const act = b.dataset.act;
  if (act === 'red-elem') {
    redaguojama = { pack: b.dataset.pack, item: b.dataset.item };
    atvertas = b.dataset.pack;
    pieskPaketus();
    $(`.pi-forma[data-pack="${b.dataset.pack}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (act === 'atsaukti-elem') {
    redaguojama = null;
    pieskPaketus();
  } else if (act === 'trinti-elem') {
    if (!window.confirm('Ištrinti šią užduotį iš paketo? Klientų, kurie paketą jau gavo, užduotys nesikeičia.')) return;
    const { error } = await db.from('task_pack_items').delete().eq('id', b.dataset.item);
    if (error) { zinok(dbKlaida(error), 'error'); return; }
    atvertas = b.dataset.pack;
    await perkrauk('Užduotis pašalinta iš paketo.');
  } else if (act === 'trinti-paketa') {
    const pk = paketai.find((x) => x.id === b.dataset.pack);
    if (!window.confirm(`Ištrinti visą paketą „${pk?.name}“? Klientų, kurie jį jau gavo, užduotys nesikeičia.`)) return;
    const { error } = await db.from('task_packs').delete().eq('id', b.dataset.pack);
    if (error) { zinok(dbKlaida(error), 'error'); return; }
    atvertas = null;
    await perkrauk('Paketas ištrintas.');
  }
}

async function sukurkPaketa(ev) {
  ev.preventDefault();
  const vardas = $('#pk-n-vardas').value.trim();
  if (!vardas) { zinok('Įrašyk paketo pavadinimą.', 'error'); return; }
  const { data, error } = await db.from('task_packs')
    .insert({ name: vardas, description: $('#pk-n-apr').value.trim(), position: paketai.length })
    .select('id').single();
  if (error) { zinok(dbKlaida(error), 'error'); return; }
  atvertas = data.id;
  await perkrauk(`Paketas „${vardas}“ sukurtas. Pridėk į jį užduočių.`);
}

async function issaugokPavadinima(ev) {
  ev.preventDefault();
  const f = ev.target;
  const vardas = f.elements.name.value.trim();
  if (!vardas) { zinok('Paketo pavadinimas negali būti tuščias.', 'error'); return; }
  const { error } = await db.from('task_packs')
    .update({ name: vardas, description: f.elements.description.value.trim() }).eq('id', f.dataset.pack);
  if (error) { zinok(dbKlaida(error), 'error'); return; }
  atvertas = f.dataset.pack;
  await perkrauk('Paketas išsaugotas.');
}

async function issaugokElementa(ev) {
  ev.preventDefault();
  const f = ev.target;
  const packId = f.dataset.pack;
  const e = f.elements;
  const title = e.title.value.trim();
  const dienos = $$('input[name="pi-diena"]:checked', f).map((i) => Number(i.value));
  const target = Number(e.target.value);
  const step = Number(e.step.value);
  const video = e.video_url.value.trim();
  if (!title) { zinok('Įrašyk užduoties pavadinimą.', 'error'); return; }
  if (!dienos.length) { zinok('Pasirink bent vieną savaitės dieną.', 'error'); return; }
  if (!Number.isInteger(target) || target < 1 || target > 100000) { zinok('Kiekis per dieną turi būti skaičius nuo 1 iki 100 000.', 'error'); return; }
  if (!Number.isInteger(step) || step < 1 || step > target) { zinok('Žingsnis turi būti skaičius nuo 1 iki dienos kiekio.', 'error'); return; }
  if (video && !videoIterpimas(video)) { zinok('Video nuoroda netinka. Įklijuok pilną YouTube arba Vimeo nuorodą, prasidedančią https://.', 'error'); return; }

  const eilute = {
    title,
    description: e.description.value.trim(),
    category: e.category.value,
    is_bonus: e.is_bonus.value === '1',
    target,
    unit: e.unit.value.trim(),
    step,
    weekdays: dienos,
    video_url: video,
  };
  const pk = paketai.find((x) => x.id === packId);
  const keiciama = redaguojama && redaguojama.pack === packId ? redaguojama.item : null;
  const { error } = keiciama
    ? await db.from('task_pack_items').update(eilute).eq('id', keiciama)
    : await db.from('task_pack_items').insert({ ...eilute, pack_id: packId, position: pk?.items.length || 0 });
  if (error) { zinok(dbKlaida(error), 'error'); return; }
  redaguojama = null;
  atvertas = packId;
  await perkrauk(keiciama ? 'Užduotis išsaugota.' : 'Užduotis pridėta į paketą.');
}
