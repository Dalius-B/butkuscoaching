// =============================================================================
//  UŽDUOČIŲ PAKETAI (trenerio skydelis)
//  Paruošti, redaguojami užduočių rinkiniai (pvz. „Švelnus startas“).
//  Rodomi kliento užduočių puslapyje, skirtuke „Paketai“: ten juos galima
//  peržiūrėti (kas viduje ir kuriomis dienomis), pridėti klientui ir redaguoti.
//  Klientai paketų nemato ir jų neskaito: lentelės tik treneriui.
// =============================================================================
import { db, $, $$, esc, klaidaLT, pranesk } from './app.js?v=20261115';
import {
  KATEGORIJOS, SAVAITES_DIENOS_TRUMPOS, dienuSuvestine,
} from './tekstai.js?v=20261115';
import { videoIterpimas } from './uzduociu-logika.js?v=20261115';

export const PAKETAI_PASIKEITE = 'paketai-pasikeite';

/** Visi paketai su savo užduotimis. Importuojantys failai mato naujausią reikšmę. */
export let paketai = [];
let paketuKlaida = null;

let vieta = null;        // konteineris, į kurį piešiama
let konteksta = null;    // { klientoId(), turi(), poPriskyrimo(), zinok() }
let redaguojamasPaketas = null;  // paketo id, kuris atvertas redagavimui (null = sąrašas)
let redaguojama = null;          // { pack, item } redaguojamas paketo elementas
const atverti = new Set();       // sąraše išskleisti paketai

function zinok(tekstas, tipas) {
  if (konteksta?.zinok) konteksta.zinok(tekstas, tipas);
  else pranesk($('#pranesimas'), tekstas, tipas);
}

function dbKlaida(error) {
  const t = String(error?.message || '').toLowerCase();
  if (error?.code === 'PGRST205' || t.includes('could not find the table') || t.includes('task_pack')) {
    return 'Paketų lentelių dar nėra. Supabase skiltyje SQL Editor paleisk failą uzduotys-nuotaika-paketai.sql.';
  }
  if (error?.code === 'PGRST202' || (t.includes('function') && t.includes('admin_priskirti_paketa'))) {
    return 'Reikia atnaujinti duomenų bazę: Supabase skiltyje SQL Editor dar kartą paleisk failą uzduotys-nuotaika-paketai.sql.';
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

/** Piešia paketų skirtuko turinį į duotą konteinerį. */
export function piesPaketuPanele(konteineris, kontekstas) {
  vieta = konteineris;
  konteksta = kontekstas;
  piesk();
}

function piesk() {
  if (!vieta) return;
  if (paketuKlaida) {
    vieta.innerHTML = `<p class="note note-error">${esc(dbKlaida(paketuKlaida))}</p>`;
    return;
  }
  const pk = redaguojamasPaketas ? paketai.find((x) => x.id === redaguojamasPaketas) : null;
  if (pk) pieskRedaktoriu(pk);
  else { redaguojamasPaketas = null; pieskSarasa(); }
}

// -----------------------------------------------------------------------------
//  1. Sąrašas: kas viduje, kuriomis dienomis, pridėti klientui
// -----------------------------------------------------------------------------
function dienuPasirinkimasHtml(id) {
  const chips = [1, 2, 3, 4, 5, 6, 7].map((d) => `
    <label class="chip-opt"><input type="checkbox" name="pd-diena-${esc(id)}" value="${d}"><span>${SAVAITES_DIENOS_TRUMPOS[d]}</span></label>`).join('');
  return `
    <fieldset class="pk-dienos">
      <legend>Kuriomis dienomis pridėti klientui?</legend>
      <label class="check-opt"><input type="radio" name="pd-${esc(id)}" value="paketas" checked><span>Kaip nurodyta sąraše aukščiau</span></label>
      <label class="check-opt"><input type="radio" name="pd-${esc(id)}" value="kasdien"><span>Visas užduotis kasdien</span></label>
      <label class="check-opt"><input type="radio" name="pd-${esc(id)}" value="pasirinkti"><span>Pasirinkti dienas (visoms užduotims)</span></label>
      <div class="chips pk-dienu-chips" hidden>${chips}</div>
    </fieldset>`;
}

function pieskSarasa() {
  const klientas = konteksta?.klientoId?.() || null;
  const turi = klientas ? konteksta.turi() : new Set();

  const korteles = paketai.map((pk) => {
    const naujos = pk.items.filter((it) => !turi.has(it.title.trim().toLowerCase())).length;
    const pavadinimai = pk.items.map((it) => it.title);
    const trumpai = pavadinimai.length
      ? pavadinimai.slice(0, 3).join(' · ') + (pavadinimai.length > 3 ? ` · dar ${pavadinimai.length - 3}` : '')
      : 'Tuščias paketas';
    const eilutes = pk.items.map((it) => {
      const kat = KATEGORIJOS[it.category] || KATEGORIJOS.iprociai;
      const kiekis = it.target > 1 ? `<span class="muted"> · ${esc(Number(it.target).toLocaleString('lt-LT'))}${it.unit ? ' ' + esc(it.unit) : ''}</span>` : '';
      const jauYra = turi.has(it.title.trim().toLowerCase());
      return `
        <li class="${jauYra ? 'jau-yra' : ''}">
          <span aria-hidden="true">${kat.ikona}</span>
          <span class="u-pak-pav">${esc(it.title)}${kiekis}
            ${it.is_bonus ? '<span class="chip chip-volt">Papildoma</span>' : ''}
            ${jauYra ? '<span class="chip chip-ok">jau yra klientui</span>' : ''}</span>
          <span class="u-pak-dienos"><span class="muted">Dienos:</span> <strong>${esc(dienuSuvestine(it.weekdays))}</strong></span>
        </li>`;
    }).join('');
    return `
      <details class="u-ist-diena u-pak" data-pack="${esc(pk.id)}"${atverti.has(pk.id) ? ' open' : ''}>
        <summary>
          <span class="u-pak-galva">
            <span class="u-ist-data">${esc(pk.name)} <span class="muted">(${pk.items.length} ${uzduociuVard(pk.items.length)})</span></span>
            <span class="u-pak-trumpai muted">${esc(trumpai)}</span>
          </span>
        </summary>
        <div class="u-pak-turinys">
          ${pk.description ? `<p class="muted" style="font-size:.875rem">${esc(pk.description)}</p>` : ''}
          <ul class="u-pak-sarasas">${eilutes || '<li class="muted">Šiame pakete užduočių dar nėra.</li>'}</ul>
          ${klientas && pk.items.length ? dienuPasirinkimasHtml(pk.id) : ''}
          <div class="row" style="margin-top:var(--s-100)">
            ${klientas ? `<button class="btn btn-primary btn-sm" type="button" data-act="prideti" data-pack="${esc(pk.id)}"${naujos ? '' : ' disabled'}>
              ${naujos ? `Pridėti klientui (${naujos} ${naujos === 1 ? 'nauja' : 'naujos'})` : 'Viskas jau pridėta'}</button>` : ''}
            <button class="btn btn-ghost btn-sm" type="button" data-act="redaguoti" data-pack="${esc(pk.id)}">Redaguoti paketą</button>
          </div>
        </div>
      </details>`;
  }).join('');

  vieta.innerHTML = `
    <div class="u-ist-dienos">${korteles || '<p class="muted">Paketų dar nėra. Sukurk pirmą žemiau.</p>'}</div>
    <details class="u-ist-diena" style="margin-top:var(--s-200)">
      <summary><span class="u-ist-data">+ Naujas paketas</span></summary>
      <form id="pk-naujas" class="pi-turinys" novalidate>
        <div class="field">
          <label for="pk-n-vardas">Pavadinimas</label>
          <input id="pk-n-vardas" type="text" maxlength="80" placeholder="Pavyzdžiui, Ramesnė savaitė">
        </div>
        <div class="field">
          <label for="pk-n-apr">Aprašymas <span class="hint">(neprivaloma, tik tau)</span></label>
          <input id="pk-n-apr" type="text" maxlength="400">
        </div>
        <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Sukurti paketą</button></div>
        <p class="muted" style="font-size:.8125rem">Tuščią paketą užpildysi spausdamas „Redaguoti paketą“. Arba greičiau: kliento skirtuke „Užduotys“ spausk „Išsaugoti kliento užduotis kaip paketą“.</p>
      </form>
    </details>`;

  for (const d of $$('.u-pak', vieta)) {
    d.addEventListener('toggle', () => { if (d.open) atverti.add(d.dataset.pack); else atverti.delete(d.dataset.pack); });
  }
  for (const r of $$('.pk-dienos input[type="radio"]', vieta)) {
    r.addEventListener('change', () => {
      const f = r.closest('.pk-dienos');
      $('.pk-dienu-chips', f).hidden = f.querySelector('input[type="radio"]:checked').value !== 'pasirinkti';
    });
  }
  for (const b of $$('[data-act]', vieta)) b.addEventListener('click', () => veiksmas(b));
  $('#pk-naujas').addEventListener('submit', sukurkPaketa);
}

async function priskirk(packId) {
  const pk = paketai.find((x) => x.id === packId);
  const klientas = konteksta?.klientoId?.();
  if (!pk || !klientas) return;
  const korta = $(`.u-pak[data-pack="${packId}"]`, vieta);
  const budas = korta.querySelector('.pk-dienos input[type="radio"]:checked')?.value || 'paketas';
  let dienos = null;
  let dienuTekstas = 'kaip nurodyta pakete';
  if (budas === 'kasdien') { dienos = [1, 2, 3, 4, 5, 6, 7]; dienuTekstas = 'kasdien'; }
  if (budas === 'pasirinkti') {
    dienos = $$(`input[name="pd-diena-${packId}"]:checked`, korta).map((i) => Number(i.value));
    if (!dienos.length) { zinok('Pažymėk bent vieną savaitės dieną.', 'error'); return; }
    dienuTekstas = dienuSuvestine(dienos);
  }
  const { data: kiek, error } = await db.rpc('admin_priskirti_paketa', { p_client: klientas, p_pack: packId, p_weekdays: dienos });
  if (error) { zinok(dbKlaida(error), 'error'); return; }
  zinok(kiek > 0
    ? `Paketas „${pk.name}“ pridėtas: nauja užduočių ${kiek} (dienos: ${dienuTekstas}). Dienas bet kada gali pakeisti skirtuke „Savaitės planas“.`
    : `Visos paketo „${pk.name}“ užduotys šiam klientui jau yra.`, 'ok');
  await konteksta.poPriskyrimo();
}

// -----------------------------------------------------------------------------
//  2. Paketo redaktorius (ta pati vieta, „sub-puslapis“ su grįžimo mygtuku)
// -----------------------------------------------------------------------------
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
        <label for="pi-pav">Pavadinimas</label>
        <input id="pi-pav" name="title" type="text" maxlength="160" required value="${esc(r?.title || '')}">
      </div>
      <div class="field">
        <label for="pi-apr">Aprašymas <span class="hint">(neprivaloma)</span></label>
        <input id="pi-apr" name="description" type="text" value="${esc(r?.description || '')}">
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
        ${r ? '<button class="btn btn-ghost btn-sm" type="button" data-act="atsaukti-elem">Atšaukti</button>' : ''}
      </div>
    </form>`;
}

function pieskRedaktoriu(pk) {
  vieta.innerHTML = `
    <button class="btn btn-ghost btn-sm" type="button" data-act="atgal">← Visi paketai</button>
    <h3 class="pi-antraste">${esc(pk.name)}</h3>
    <p class="muted" style="font-size:.875rem;margin-bottom:var(--s-200)">Pakeitimai paketuose neveikia klientų, kurie paketą jau gavo.</p>

    ${pk.items.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Užduotis</th><th>Kategorija</th><th>Dienos</th><th>Tipas</th><th></th></tr></thead>
      <tbody>${pk.items.map((it) => elementoEilute(pk, it)).join('')}</tbody>
    </table></div>` : '<p class="muted">Šiame pakete užduočių dar nėra. Pridėk pirmą žemiau.</p>'}

    ${elementoForma(pk)}

    <details class="u-ist-diena" style="margin-top:var(--s-200)">
      <summary><span class="u-ist-data">Pakeisti pavadinimą ar ištrinti paketą</span></summary>
      <form class="pi-pavadinimo-forma pi-turinys" data-pack="${esc(pk.id)}" novalidate>
        <div class="field">
          <label for="pk-vardas">Paketo pavadinimas</label>
          <input id="pk-vardas" name="name" type="text" maxlength="80" value="${esc(pk.name)}">
        </div>
        <div class="field">
          <label for="pk-apr">Aprašymas <span class="hint">(tik tau)</span></label>
          <textarea id="pk-apr" name="description" maxlength="400" rows="2">${esc(pk.description || '')}</textarea>
        </div>
        <div class="row">
          <button class="btn btn-ghost btn-sm" type="submit">Išsaugoti</button>
          <button class="btn btn-danger btn-sm" type="button" data-act="trinti-paketa" data-pack="${esc(pk.id)}">Trinti paketą</button>
        </div>
      </form>
    </details>`;

  for (const b of $$('[data-act]', vieta)) b.addEventListener('click', () => veiksmas(b));
  for (const f of $$('.pi-forma', vieta)) f.addEventListener('submit', issaugokElementa);
  for (const f of $$('.pi-pavadinimo-forma', vieta)) f.addEventListener('submit', issaugokPavadinima);
}

async function perkrauk(zinute) {
  await gaukPaketus();
  piesk();
  document.dispatchEvent(new CustomEvent(PAKETAI_PASIKEITE));
  if (zinute) zinok(zinute, 'ok');
}

async function veiksmas(b) {
  const act = b.dataset.act;
  if (act === 'prideti') {
    await priskirk(b.dataset.pack);
  } else if (act === 'redaguoti') {
    redaguojamasPaketas = b.dataset.pack;
    redaguojama = null;
    piesk();
  } else if (act === 'atgal') {
    redaguojamasPaketas = null;
    redaguojama = null;
    piesk();
  } else if (act === 'red-elem') {
    redaguojama = { pack: b.dataset.pack, item: b.dataset.item };
    piesk();
    $('.pi-forma', vieta)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (act === 'atsaukti-elem') {
    redaguojama = null;
    piesk();
  } else if (act === 'trinti-elem') {
    if (!window.confirm('Ištrinti šią užduotį iš paketo? Klientų, kurie paketą jau gavo, užduotys nesikeičia.')) return;
    const { error } = await db.from('task_pack_items').delete().eq('id', b.dataset.item);
    if (error) { zinok(dbKlaida(error), 'error'); return; }
    await perkrauk('Užduotis pašalinta iš paketo.');
  } else if (act === 'trinti-paketa') {
    const pk = paketai.find((x) => x.id === b.dataset.pack);
    if (!window.confirm(`Ištrinti visą paketą „${pk?.name}“? Klientų, kurie jį jau gavo, užduotys nesikeičia.`)) return;
    const { error } = await db.from('task_packs').delete().eq('id', b.dataset.pack);
    if (error) { zinok(dbKlaida(error), 'error'); return; }
    redaguojamasPaketas = null;
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
  redaguojamasPaketas = data.id;
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
  await perkrauk(keiciama ? 'Užduotis išsaugota.' : 'Užduotis pridėta į paketą.');
}
