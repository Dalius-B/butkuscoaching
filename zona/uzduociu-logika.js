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
