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

/** Lygio riba: 1 lygis nuo 0 XP, 2 nuo 50, 3 nuo 200, 4 nuo 450 ... */
export const lygioPradzia = (lygis) => 50 * (lygis - 1) ** 2;

export function lygisPagalXp(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

/**
 * Visa statistika iš užduočių sąrašo ir atlikimų.
 * Diena laikoma pilna, kai atlikta kiekviena tos dienos privaloma užduotis.
 * Diena be privalomų užduočių (poilsio) serijos nei tęsia, nei nutraukia.
 * Šiandiena, kol nebaigta, serijos nenutraukia.
 */
export function apskaiciuok(uzduotys, atlikimai, siandien = siandienLT()) {
  const atlikta = new Set(atlikimai.map((a) => `${a.challenge_id}|${a.day}`));
  const kiekvienaDiena = new Map();
  let visoXp = 0;
  for (const a of atlikimai) {
    visoXp += a.xp || 0;
    kiekvienaDiena.set(a.day, (kiekvienaDiena.get(a.day) || 0) + 1);
  }
  const papildomiId = new Set(uzduotys.filter((u) => u.is_bonus).map((u) => u.id));
  const papildomaAtlikta = atlikimai.filter((a) => papildomiId.has(a.challenge_id)).length;

  let pradzia = siandien;
  for (const u of uzduotys) {
    const d = dataLT(u.created_at);
    if (d < pradzia) pradzia = d;
  }
  for (const a of atlikimai) if (a.day < pradzia) pradzia = a.day;
  // Apsauga nuo begalinio ciklo, jei kas nors turi labai seną įrašą.
  if (pradzia < pridek(siandien, -800)) pradzia = pridek(siandien, -800);

  const pilnos = new Set();
  let serija = 0;
  let ilgiausia = 0;
  for (let d = pradzia; d <= siandien; d = pridek(d, 1)) {
    const reikia = privalomosDienai(uzduotys, d);
    if (!reikia.length) continue;
    const pilna = reikia.every((u) => atlikta.has(`${u.id}|${d}`));
    if (pilna) {
      pilnos.add(d);
      serija += 1;
      if (serija > ilgiausia) ilgiausia = serija;
    } else if (d !== siandien) {
      serija = 0;
    }
  }

  const lygis = lygisPagalXp(visoXp);
  return {
    visoXp,
    atliktaViso: atlikimai.length,
    papildomaAtlikta,
    pilnosDienos: pilnos.size,
    pilnos,
    dalinos: new Set(kiekvienaDiena.keys()),
    dabartineSerija: serija,
    ilgiausiaSerija: ilgiausia,
    lygis,
    lygioPradzia: lygioPradzia(lygis),
    kitasLygis: lygioPradzia(lygis + 1),
    atlikta,
  };
}
