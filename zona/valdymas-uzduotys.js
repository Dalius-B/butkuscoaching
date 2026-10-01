// =============================================================================
//  TRENERIO SKYDELIS: KLIENTŲ UŽDUOTYS
//  Trenerio pusė privačiai užduočių skilčiai. Klientas ją mato tik tada, kai
//  čia jam įjungta (Klientai skiltyje).
// =============================================================================
import { db, $, $$, esc, klaidaLT, pranesk } from './app.js?v=20261003';
import {
  KATEGORIJOS, SABLONAI, taskai, SAVAITES_DIENOS, SAVAITES_DIENOS_TRUMPOS, dienuSuvestine, dataTrumpa,
} from './tekstai.js?v=20261003';
import { apskaiciuok, siandienLT, pridek, privalomosDienai } from './uzduociu-logika.js?v=20261003';

let pasirinktas = null;   // kliento id
let uzduotys = [];
let atlikimai = [];
let redaguojama = null;   // užduoties id arba null

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
    <div class="card">
      <div class="card-head"><h2>Klientų užduotys</h2></div>
      <div class="field" style="max-width:420px">
        <label for="u-klientas">Klientas</label>
        <select id="u-klientas">
          ${klientai.map((k) => `<option value="${esc(k.id)}"${k.id === pasirinktas ? ' selected' : ''}>${esc(k.full_name || k.email)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="u-turinys" style="margin-top:var(--s-300)"><div class="loading"><span class="spinner" aria-hidden="true"></span><span>Kraunama</span></div></div>`;

  $('#u-klientas').addEventListener('change', (e) => {
    pasirinktas = e.target.value;
    redaguojama = null;
    ikelkKliento();
  });
  await ikelkKliento();
}

async function ikelkKliento() {
  const zinute = $('#pranesimas');
  const [u, a] = await Promise.all([
    db.from('client_challenges').select('*').eq('client_id', pasirinktas)
      .order('position', { ascending: true }).order('created_at', { ascending: true }),
    db.from('challenge_completions').select('id, challenge_id, day, xp').eq('client_id', pasirinktas)
      .order('day', { ascending: true }),
  ]);
  if (u.error || a.error) {
    pranesk(zinute, klaidaLT(u.error || a.error), 'error');
    $('#u-turinys').innerHTML = '';
    return;
  }
  uzduotys = u.data || [];
  atlikimai = a.data || [];
  pieskKliento();
}

function pieskKliento() {
  const dabar = siandienLT();
  const st = apskaiciuok(uzduotys.filter((x) => x.active), atlikimai, dabar);
  const eilutes = uzduotys.map((x) => {
    const kat = KATEGORIJOS[x.category] || KATEGORIJOS.iprociai;
    return `
      <tr>
        <td>
          <strong>${esc(x.title)}</strong>
          ${x.description ? `<div class="muted" style="font-size:.8125rem">${esc(x.description)}</div>` : ''}
          ${x.target > 1 ? `<div class="muted" style="font-size:.8125rem">Per dieną: ${esc(Number(x.target).toLocaleString('lt-LT'))}${x.unit ? ' ' + esc(x.unit) : ''}, vienas paspaudimas +${esc(Number(x.step).toLocaleString('lt-LT'))}</div>` : ''}
        </td>
        <td>${kat.ikona} ${esc(kat.pavadinimas)}</td>
        <td>${esc(taskai(x.xp))}</td>
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

  // Paskutinių 14 dienų juosta: pilna / dalinė / praleista.
  const dienos = [];
  for (let i = 13; i >= 0; i -= 1) dienos.push(pridek(dabar, -i));
  const juosta = dienos.map((d) => {
    const reikia = privalomosDienai(uzduotys, d).length;
    let klase = 'kal-diena';
    if (st.pilnos.has(d)) klase += ' pilna';
    else if (st.dalinos.has(d)) klase += ' dalinai';
    else if (!reikia) klase += ' ateitis';
    const wd = new Date(d + 'T00:00:00Z').getUTCDay() || 7;
    return `<div style="text-align:center;min-width:0"><div class="kal-antraste">${SAVAITES_DIENOS_TRUMPOS[wd]}</div><span class="${klase}" title="${esc(dataTrumpa(d))}">${Number(d.slice(8))}</span></div>`;
  }).join('');

  const r = redaguojama ? uzduotys.find((x) => x.id === redaguojama) : null;
  const dienuPasirinkimas = [1, 2, 3, 4, 5, 6, 7].map((d) => `
    <label class="chip-opt"><input type="checkbox" name="u-diena" value="${d}"${(r ? r.weekdays.includes(d) : true) ? ' checked' : ''}><span>${SAVAITES_DIENOS_TRUMPOS[d]}</span></label>`).join('');

  $('#u-turinys').innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Pažanga</h2></div>
      <div class="uzd-statai" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
        <div class="uzd-stat"><strong>${st.visoXp}</strong><span>Iš viso taškų</span></div>
        <div class="uzd-stat"><strong>${st.pilnosDienos}</strong><span>Pilnos dienos</span></div>
      </div>
      <p class="muted" style="margin:var(--s-300) 0 var(--s-100);font-size:.8125rem">Paskutinės 14 dienų (geltona: visos užduotys atliktos, rėmelis: atlikta dalis)</p>
      <div style="display:grid;grid-template-columns:repeat(14,minmax(0,1fr));gap:4px">${juosta}</div>
    </div>

    <div class="card" style="margin-top:var(--s-300)">
      <div class="card-head"><h2>Užduotys</h2><span class="row-end muted">${uzduotys.length}</span></div>
      ${uzduotys.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Užduotis</th><th>Kategorija</th><th>Taškai</th><th>Dienos</th><th>Tipas</th><th></th></tr></thead>
          <tbody>${eilutes}</tbody>
        </table></div>` : '<p class="muted">Šiam klientui užduočių dar nėra. Pridėk pirmą žemiau.</p>'}
    </div>

    <div class="card" style="margin-top:var(--s-300)">
      <div class="card-head"><h2>${r ? 'Redaguoti užduotį' : 'Nauja užduotis'}</h2></div>
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
            <label for="u-xp">Taškai</label>
            <input id="u-xp" type="number" min="1" max="500" value="${r?.xp ?? 10}">
          </div>
          <div class="field">
            <label for="u-tipas">Tipas</label>
            <select id="u-tipas">
              <option value="0"${r?.is_bonus ? '' : ' selected'}>Privaloma (reikia, kad diena būtų pilna)</option>
              <option value="1"${r?.is_bonus ? ' selected' : ''}>Papildoma (tik papildomi taškai)</option>
            </select>
          </div>
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
          Pavyzdžiui, 10 stiklinių vandens: kiekis 10, vienetas „stiklinių“, žingsnis 1. Klientas gali pažymėti 2 stiklines iš ryto, o likusias vėliau. Taškai gaunami proporcingai.
        </p>
        <div class="field">
          <span class="legend-inline">Kuriomis dienomis</span>
          <div class="chips" role="group" aria-label="Savaitės dienos">${dienuPasirinkimas}</div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${r ? 'Išsaugoti' : 'Pridėti užduotį'}</button>
          ${r ? '<button class="btn btn-ghost" type="button" id="u-atsaukti">Atšaukti</button>' : ''}
        </div>
      </form>
    </div>`;

  $('#u-sablonas')?.addEventListener('change', (e) => {
    const s = SABLONAI[Number(e.target.value)];
    if (!s) return;
    $('#u-pavadinimas').value = s.title;
    $('#u-kategorija').value = s.category;
    $('#u-xp').value = s.xp;
    $('#u-kiekis').value = s.target || 1;
    $('#u-vienetas').value = s.unit || '';
    $('#u-zingsnis').value = s.step || 1;
    $('#u-aprasas').value = s.description || '';
  });
  $('#u-forma').addEventListener('submit', issaugok);
  $('#u-atsaukti')?.addEventListener('click', () => { redaguojama = null; pieskKliento(); });
  for (const b of $$('.u-red')) b.addEventListener('click', () => { redaguojama = b.dataset.id; pieskKliento(); $('#u-forma').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  for (const b of $$('.u-jungti')) b.addEventListener('click', () => perjunkAktyvuma(b.dataset.id));
  for (const b of $$('.u-trinti')) b.addEventListener('click', () => trink(b.dataset.id));
}

async function issaugok(ev) {
  ev.preventDefault();
  const zinute = $('#pranesimas');
  const pavadinimas = $('#u-pavadinimas').value.trim();
  const dienos = $$('input[name="u-diena"]:checked').map((i) => Number(i.value));
  const xp = Number($('#u-xp').value);
  const kiekis = Number($('#u-kiekis').value);
  const zingsnis = Number($('#u-zingsnis').value);
  if (!pavadinimas) { pranesk(zinute, 'Įrašyk užduoties pavadinimą.', 'error'); return; }
  if (!dienos.length) { pranesk(zinute, 'Pasirink bent vieną savaitės dieną.', 'error'); return; }
  if (!Number.isInteger(xp) || xp < 1 || xp > 500) { pranesk(zinute, 'Taškai turi būti skaičius nuo 1 iki 500.', 'error'); return; }

  if (!Number.isInteger(kiekis) || kiekis < 1 || kiekis > 100000) { pranesk(zinute, 'Kiekis per dieną turi būti skaičius nuo 1 iki 100 000.', 'error'); return; }
  if (!Number.isInteger(zingsnis) || zingsnis < 1 || zingsnis > kiekis) { pranesk(zinute, 'Žingsnis turi būti skaičius nuo 1 iki dienos kiekio.', 'error'); return; }

  const eilute = {
    target: kiekis,
    unit: $('#u-vienetas').value.trim(),
    step: zingsnis,
    title: pavadinimas,
    description: $('#u-aprasas').value.trim(),
    category: $('#u-kategorija').value,
    xp,
    is_bonus: $('#u-tipas').value === '1',
    weekdays: dienos,
  };
  const { error } = redaguojama
    ? await db.from('client_challenges').update(eilute).eq('id', redaguojama)
    : await db.from('client_challenges').insert({ ...eilute, client_id: pasirinktas, position: uzduotys.length });
  if (error) { pranesk(zinute, klaidaLT(error), 'error'); return; }
  pranesk(zinute, redaguojama ? 'Užduotis išsaugota.' : 'Užduotis pridėta.', 'ok');
  redaguojama = null;
  await ikelkKliento();
}

async function perjunkAktyvuma(id) {
  const x = uzduotys.find((u) => u.id === id);
  if (!x) return;
  const { error } = await db.from('client_challenges').update({ active: !x.active }).eq('id', id);
  if (error) { pranesk($('#pranesimas'), klaidaLT(error), 'error'); return; }
  pranesk($('#pranesimas'), x.active ? 'Užduotis išjungta, klientas jos nebemato.' : 'Užduotis įjungta.', 'ok');
  await ikelkKliento();
}

async function trink(id) {
  const x = uzduotys.find((u) => u.id === id);
  if (!x) return;
  if (!confirm(`Ištrinti užduotį "${x.title}"?\n\nKartu dings jos atlikimų istorija ir su ja surinkti taškai. Jei nori tik paslėpti nuo kliento, geriau spausk „Išjungti“.`)) return;
  const { error } = await db.from('client_challenges').delete().eq('id', id);
  if (error) { pranesk($('#pranesimas'), klaidaLT(error), 'error'); return; }
  pranesk($('#pranesimas'), 'Užduotis ištrinta.', 'ok');
  await ikelkKliento();
}
