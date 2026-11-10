// =============================================================================
//  UŽDUOČIŲ SKAIČIAVIMAI
//  Grynos funkcijos be jokio ryšio su puslapiu: naudoja ir kliento puslapis,
//  ir trenerio skydelis, tad abu visada rodo tuos pačius skaičius.
// =============================================================================

const VILNIUS = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Vilnius', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Šiandienos data Lietuvoje kaip YYYY-MM-DD (tokią pat skaičiuoja ir duomenų bazė). */
export function siandienLT() {
  return VILNIUS.format(new Date());
}

/** Laiko žymė -> data Lietuvoje kaip YYYY-MM-DD. */
export function dataLT(laikas) {
  return VILNIUS.format(new Date(laikas));
}

/** ISO savaitės diena: 1 = pirmadienis ... 7 = sekmadienis. */
export function savaitesDiena(iso) {
  return new Date(iso + 'T00:00:00Z').getUTCDay() || 7;
}

export function pridek(iso, dienos) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dienos);
  return d.toISOString().slice(0, 10);
}

/** Privalomos (ne papildomos) užduotys, numatytos tai dienai. */
export function privalomosDienai(uzduotys, iso) {
  const wd = savaitesDiena(iso);
  return uzduotys.filter((u) => u.active && !u.is_bonus
    && u.weekdays.includes(wd) && dataLT(u.created_at) <= iso);
}

export function papildomosDienai(uzduotys, iso) {
  const wd = savaitesDiena(iso);
  return uzduotys.filter((u) => u.active && u.is_bonus && u.weekdays.includes(wd));
}

/** Lygio riba: 1 lygis nuo 0 taškų, 2 nuo 50, 3 nuo 200, 4 nuo 450 ... */
export const lygioPradzia = (lygis) => 50 * (lygis - 1) ** 2;

export function lygisPagalXp(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

/**
 * YouTube / Vimeo nuoroda -> įterpiamo grotuvo adresas, arba null, jei nuoroda
 * nepažįstama. Priimamos tik šios dvi svetainės, tad kitų adresų į puslapį
 * neįdedame.
 */
export function videoIterpimas(nuoroda) {
  let u;
  try { u = new URL(String(nuoroda || '').trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www|m)\./, '');
  const id = /^[A-Za-z0-9_-]{6,20}$/;
  if (host === 'youtu.be') {
    const v = u.pathname.slice(1).split('/')[0];
    return id.test(v) ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const dalys = u.pathname.split('/').filter(Boolean);
    const v = u.searchParams.get('v')
      || (['shorts', 'embed', 'live'].includes(dalys[0]) ? dalys[1] : '');
    return id.test(v || '') ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const dalys = u.pathname.split('/').filter(Boolean).filter((x) => x !== 'video');
    const vid = dalys.find((x) => /^\d+$/.test(x));
    if (!vid) return null;
    const h = u.searchParams.get('h') || dalys.find((x) => /^[a-f0-9]{8,}$/i.test(x) && x !== vid);
    return `https://player.vimeo.com/video/${vid}${h ? `?h=${h}` : ''}`;
  }
  return null;
}

/** Kiek užduoties žingsnių (stiklinių, žingsnių...) reikia dienai. */
export const tikslas = (u) => Math.max(1, u.target || 1);

/**
 * Visa statistika iš užduočių sąrašo ir atlikimų.
 * Užduotis laikoma atlikta, kai kiekis pasiekia tikslą. Diena laikoma pilna,
 * kai atlikta kiekviena tos dienos privaloma užduotis.
 */
export function apskaiciuok(uzduotys, atlikimai, siandien = siandienLT()) {
  const pagalId = new Map(uzduotys.map((u) => [u.id, u]));
  const kiekis = new Map();            // "užduotis|diena" -> kiek jau padaryta
  const dienosSuVeikla = new Set();
  let visoXp = 0;
  let atliktaViso = 0;
  let papildomaAtlikta = 0;
  for (const a of atlikimai) {
    kiekis.set(`${a.challenge_id}|${a.day}`, a.amount || 1);
    dienosSuVeikla.add(a.day);
    visoXp += a.xp || 0;
    const u = pagalId.get(a.challenge_id);
    if (u && (a.amount || 1) >= tikslas(u)) {
      atliktaViso += 1;
      if (u.is_bonus) papildomaAtlikta += 1;
    }
  }
  const padaryta = (u, diena) => (kiekis.get(`${u.id}|${diena}`) || 0) >= tikslas(u);

  let pradzia = siandien;
  for (const u of uzduotys) {
    const d = dataLT(u.created_at);
    if (d < pradzia) pradzia = d;
  }
  for (const a of atlikimai) if (a.day < pradzia) pradzia = a.day;
  // Apsauga nuo begalinio ciklo, jei kas nors turi labai seną įrašą.
  if (pradzia < pridek(siandien, -800)) pradzia = pridek(siandien, -800);

  const pilnos = new Set();
  for (let d = pradzia; d <= siandien; d = pridek(d, 1)) {
    const reikia = privalomosDienai(uzduotys, d);
    if (reikia.length && reikia.every((u) => padaryta(u, d))) pilnos.add(d);
  }

  const lygis = lygisPagalXp(visoXp);
  return {
    visoXp,
    atliktaViso,
    papildomaAtlikta,
    pilnosDienos: pilnos.size,
    pilnos,
    dalinos: dienosSuVeikla,
    lygis,
    lygioPradzia: lygioPradzia(lygis),
    kitasLygis: lygioPradzia(lygis + 1),
    kiekis,
    padaryta,
  };
}

// -----------------------------------------------------------------------------
//  Savaitės procentas ir dienų būsenos (be taškų)
// -----------------------------------------------------------------------------

/** Savaitės pirmadienis (YYYY-MM-DD), kurioje yra duota diena. */
export const savaitesPirmadienis = (iso) => pridek(iso, -(savaitesDiena(iso) - 1));

/** Kiek užduoties padaryta tą dieną, 0..1. */
export function dalisPadaryta(u, kiekis, diena) {
  return Math.min(1, (kiekis.get(`${u.id}|${diena}`) || 0) / tikslas(u));
}

/**
 * Savaitės (nuo pirmadienio) pažanga. Skaičiuojamos tik privalomos užduotys.
 * Dalinai atlikta užduotis skaičiuojasi dalimi (3 iš 10 stiklinių = 30%).
 * Šiandiena, kol dar nieko nepadaryta, dar nelaikoma praleista.
 * Grąžina procentą (arba null, jei dar nėra ką vertinti) ir kiekvienos dienos būseną.
 */
export function savaitesPazanga(uzduotys, atlikimai, pirmadienis, siandien = siandienLT()) {
  const st = apskaiciuok(uzduotys, atlikimai, siandien);
  let viso = 0;
  let padaryta = 0;
  const dienos = [];
  for (let i = 0; i < 7; i += 1) {
    const d = pridek(pirmadienis, i);
    if (d > siandien) { dienos.push({ d, busena: 'ateitis' }); continue; }
    const reikia = privalomosDienai(uzduotys, d);
    if (!reikia.length) { dienos.push({ d, busena: 'poilsis' }); continue; }
    const dalys = reikia.map((u) => dalisPadaryta(u, st.kiekis, d));
    const suma = dalys.reduce((a, b) => a + b, 0);
    const pilna = dalys.every((x) => x >= 1);
    const pradetaSiandien = d === siandien && suma === 0;
    if (!pradetaSiandien) { viso += reikia.length; padaryta += suma; }
    dienos.push({ d, busena: pilna ? 'pilna' : suma > 0 ? 'dalinai' : (d === siandien ? 'laukia' : 'nieko'), suma, kiek: reikia.length });
  }
  return { proc: viso ? Math.round((padaryta / viso) * 100) : null, viso, padaryta, dienos };
}

/**
 * Įpročių vaizdas: kiekvienos užduoties būsena kiekvieną dieną per paskutines
 * `dienu` dienų, taip pat kategorijų procentai ir jų kryptis (paskutinės 7 dienos
 * lyginamos su ankstesnėmis 7).
 */
export function ipociuVaizdas(uzduotys, atlikimai, dienu, siandien = siandienLT()) {
  const st = apskaiciuok(uzduotys, atlikimai, siandien);
  let pradzia = pridek(siandien, -(dienu - 1));
  const dienos = [];
  for (let d = pradzia; d <= siandien; d = pridek(d, 1)) dienos.push(d);

  const turiVeiklos = new Set(atlikimai.filter((a) => a.day >= pradzia).map((a) => a.challenge_id));
  const sarasas = uzduotys.filter((u) => u.active || turiVeiklos.has(u.id));

  const eilutes = sarasas.map((u) => {
    const langeliai = dienos.map((d) => {
      const numatyta = u.weekdays.includes(savaitesDiena(d)) && dataLT(u.created_at) <= d;
      const dalis = dalisPadaryta(u, st.kiekis, d);
      if (!numatyta && dalis === 0) return { d, busena: 'nera' };
      if (dalis >= 1) return { d, busena: 'padaryta', dalis, numatyta };
      if (dalis > 0) return { d, busena: 'dalinai', dalis, numatyta };
      if (d === siandien) return { d, busena: 'laukia', dalis: 0, numatyta };
      return { d, busena: 'praleista', dalis: 0, numatyta };
    });
    // Procentas tik iš numatytų dienų, neskaičiuojant dar nepradėtos šiandienos.
    const vertinamos = langeliai.filter((l) => l.numatyta !== false && l.busena !== 'nera' && l.busena !== 'laukia');
    const suma = vertinamos.reduce((a, l) => a + (l.dalis || 0), 0);
    return { u, langeliai, proc: vertinamos.length ? Math.round((suma / vertinamos.length) * 100) : null, numatyta: vertinamos.length };
  });

  const kategorijos = new Map();
  const bendras = (ei, nuo, iki) => {
    let n = 0; let s = 0;
    for (const e of ei) {
      for (const l of e.langeliai) {
        if (l.d < nuo || l.d > iki) continue;
        if (l.busena === 'nera' || l.busena === 'laukia' || l.numatyta === false) continue;
        n += 1; s += l.dalis || 0;
      }
    }
    return n ? { n, proc: Math.round((s / n) * 100) } : null;
  };
  const privalomos = eilutes.filter((e) => !e.u.is_bonus);
  for (const e of privalomos) {
    if (!kategorijos.has(e.u.category)) kategorijos.set(e.u.category, []);
    kategorijos.get(e.u.category).push(e);
  }
  const savaite = pridek(siandien, -6);
  const praeita = [pridek(siandien, -13), pridek(siandien, -7)];
  const kategoriju = [...kategorijos.entries()].map(([kat, ei]) => {
    const viso = bendras(ei, pradzia, siandien);
    const sia = bendras(ei, savaite, siandien);
    const buvo = bendras(ei, praeita[0], praeita[1]);
    let kryptis = 0;
    if (sia && buvo) {
      const skirt = sia.proc - buvo.proc;
      kryptis = skirt >= 10 ? 1 : skirt <= -10 ? -1 : 0;
    }
    return { kat, proc: viso?.proc ?? null, n: viso?.n || 0, kryptis, uzduociu: ei.length };
  }).filter((k) => k.proc !== null).sort((a, b) => a.proc - b.proc);

  // Sunkiausios užduotys viršuje.
  eilutes.sort((a, b) => {
    if (a.u.is_bonus !== b.u.is_bonus) return a.u.is_bonus ? 1 : -1;
    return (a.proc ?? 101) - (b.proc ?? 101);
  });
  return { dienos, eilutes, kategorijos: kategoriju };
}
