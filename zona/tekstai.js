// =============================================================================
//  UŽDUOČIŲ PUSLAPIO TEKSTAI
//  Visi klientui rodomi tekstai gyvena čia, vienoje vietoje. Norint pakeisti
//  formuluotę ar vėliau pridėti kitą kalbą, kitų failų liesti nereikia.
// =============================================================================

export const T = {
  puslapis: 'Užduotys',
  pavadinimas: 'Užduotys | Butkus Coaching',
  kraunama: 'Kraunamos užduotys',
  labas: (vardas) => (vardas ? `Labas, ${vardas}` : 'Labas'),

  siandien: 'Šiandien',
  siandienosUzduotys: 'Šiandienos užduotys',
  papildomosUzduotys: 'Papildomos užduotys',
  papildomosPaaiskinimas: 'Neprivalomos, bet duoda papildomų XP. Serijai jų atlikti nereikia.',
  papildoma: 'Papildoma',
  atlikta: 'Atlikta ✓',
  pazymeti: 'Pažymėti kaip atliktą',
  atsaukti: 'Atšaukti žymėjimą',
  pazanga: 'Pažanga',
  kalendorius: 'Kalendorius',
  pasiekimai: 'Pasiekimai',
  atrakinta: 'Atrakinta',
  uzrakinta: 'Dar užrakinta',

  atlikoIs: (a, is) => `Atlikta ${a} iš ${is}`,
  darLiko: (n) => `Dar liko ${n} ${zodisUzduotis(n)}`,
  visosAtliktos: 'Puiku! Visos šiandienos užduotys atliktos.',
  dienaBaigta: 'Diena baigta!',
  uzduotisAtlikta: (xp) => `Užduotis atlikta! +${xp} XP`,
  zymejimasAtsauktas: 'Žymėjimas atšauktas',
  surinkai: (xp) => `Tu surinkai ${xp} XP`,
  siandienNieko: 'Šiandien dar nieko nesurinkai. Pradėk nuo pirmos užduoties.',

  serija: (n) => (n > 0 ? `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'dienos' : 'dienų'} serija 🔥` : 'Serija dar nepradėta'),
  serijosPasiulymas: 'Atlik visas šiandienos užduotis ir pradėk naują seriją.',
  dabartineSerija: 'Dabartinė serija',
  ilgiausiaSerija: 'Ilgiausia serija',
  visoXp: 'Iš viso XP',
  pilnosDienos: 'Pilnos dienos',
  atliktosUzduotys: 'Atliktos užduotys',
  lygis: (n) => `${n} lygis`,
  iki: (kiek, lygis) => `Dar ${kiek} XP iki ${lygis} lygio`,
  dienos: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'diena' : (n % 10 === 0 || (n % 100 >= 11 && n % 100 <= 19)) ? 'dienų' : 'dienos'}`,

  aiskinimasSerija: 'Diena skaičiuojama į seriją, kai atlieki visas tos dienos privalomas užduotis. Poilsio dienos serijos nenutraukia.',

  tuscia: 'Kol kas užduočių nėra',
  tusciaTekstas: 'Dalius netrukus paruoš tau užduotis. Kai tik jos atsiras, matysi jas čia.',
  poilsioDiena: 'Šiandien poilsio diena',
  poilsioTekstas: 'Šiai dienai privalomų užduočių nėra. Pailsėk, o rytoj vėl į darbą.',
  tikPapildomos: 'Šiandien privalomų užduočių nėra, bet gali atlikti papildomas.',

  kalendoriausLegenda: {
    pilna: 'Visos užduotys atliktos',
    dalinai: 'Atlikta dalis',
    siandien: 'Šiandien',
  },
  ankstesnisMenuo: 'Ankstesnis mėnuo',
  kitasMenuo: 'Kitas mėnuo',

  klaidaIsaugoti: 'Nepavyko išsaugoti žymėjimo. Pabandyk dar kartą.',
  klaidaKrauti: 'Nepavyko įkelti užduočių.',
  neprieigos: 'Ši skiltis tau dar neįjungta. Jei manai, kad tai klaida, parašyk Daliui.',
  bandytiDarKarta: 'Bandyti dar kartą',
};

/** Užduotis / užduotys / užduočių. */
export function zodisUzduotis(n) {
  const p = n % 10;
  const pp = Math.floor(n / 10) % 10;
  if (pp === 1 || p === 0) return 'užduočių';
  if (p === 1) return 'užduotis';
  return 'užduotys';
}

// -----------------------------------------------------------------------------
//  Kategorijos
// -----------------------------------------------------------------------------
export const KATEGORIJOS = {
  judejimas:    { pavadinimas: 'Judėjimas',    ikona: '🏃' },
  mityba:       { pavadinimas: 'Mityba',       ikona: '🥗' },
  vanduo:       { pavadinimas: 'Vanduo',       ikona: '💧' },
  miegas:       { pavadinimas: 'Miegas',       ikona: '😴' },
  proto_ramybe: { pavadinimas: 'Proto ramybė', ikona: '🧘' },
  iprociai:     { pavadinimas: 'Įpročiai',     ikona: '✅' },
};

// -----------------------------------------------------------------------------
//  Savaitės dienos ir mėnesiai
//  Savaitės dienos indeksuojamos ISO tvarka: 1 = pirmadienis ... 7 = sekmadienis.
// -----------------------------------------------------------------------------
export const SAVAITES_DIENOS = {
  1: 'Pirmadienis', 2: 'Antradienis', 3: 'Trečiadienis', 4: 'Ketvirtadienis',
  5: 'Penktadienis', 6: 'Šeštadienis', 7: 'Sekmadienis',
};
export const SAVAITES_DIENOS_TRUMPOS = {
  1: 'Pr', 2: 'An', 3: 'Tr', 4: 'Ke', 5: 'Pe', 6: 'Še', 7: 'Se',
};

// Vardininkas: kalendoriaus antraštei (Rugsėjis 2026).
export const MENESIAI = [
  'Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis',
  'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis',
];
// Kilmininkas: datoms (rugsėjo 29 d.).
export const MENESIAI_KILMININKAS = [
  'sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio',
  'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio',
];

/** 2026-09-29 -> "Antradienis, rugsėjo 29 d." */
export function dataSuDiena(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const diena = d.getUTCDay() || 7;
  return `${SAVAITES_DIENOS[diena]}, ${MENESIAI_KILMININKAS[d.getUTCMonth()]} ${d.getUTCDate()} d.`;
}

/** 2026-09-29 -> "rugsėjo 29 d." */
export function dataTrumpa(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${MENESIAI_KILMININKAS[d.getUTCMonth()]} ${d.getUTCDate()} d.`;
}

/** [1,2,3,4,5,6,7] -> "Kasdien", [1,3,5] -> "Pr, Tr, Pe" */
export function dienuSuvestine(dienos) {
  const d = [...dienos].sort((a, b) => a - b);
  if (d.length === 7) return 'Kasdien';
  if (d.join() === '1,2,3,4,5') return 'Darbo dienomis';
  if (d.join() === '6,7') return 'Savaitgaliais';
  return d.map((x) => SAVAITES_DIENOS_TRUMPOS[x]).join(', ');
}

// -----------------------------------------------------------------------------
//  Pasiekimai. "rodiklis" nurodo, kurį skaičių lyginti su "tikslas".
// -----------------------------------------------------------------------------
export const PASIEKIMAI = [
  { id: 'pirmas',    ikona: '🌱', pavadinimas: 'Pirmas žingsnis',       aprasas: 'Atlik pirmą užduotį',              rodiklis: 'atliktaViso',     tikslas: 1 },
  { id: 'diena',     ikona: '⭐', pavadinimas: 'Pirma pilna diena',     aprasas: 'Atlik visas vienos dienos užduotis', rodiklis: 'pilnosDienos',    tikslas: 1 },
  { id: 'serija3',   ikona: '🔥', pavadinimas: 'Trijų dienų serija',    aprasas: 'Atlik visas užduotis 3 dienas iš eilės', rodiklis: 'ilgiausiaSerija', tikslas: 3 },
  { id: 'serija7',   ikona: '🚀', pavadinimas: 'Savaitės serija',       aprasas: '7 dienų serija',                   rodiklis: 'ilgiausiaSerija', tikslas: 7 },
  { id: 'serija14',  ikona: '💪', pavadinimas: 'Dviejų savaičių serija', aprasas: '14 dienų serija',                  rodiklis: 'ilgiausiaSerija', tikslas: 14 },
  { id: 'serija30',  ikona: '🏆', pavadinimas: 'Mėnesio serija',        aprasas: '30 dienų serija',                  rodiklis: 'ilgiausiaSerija', tikslas: 30 },
  { id: 'xp100',     ikona: '⚡', pavadinimas: 'Pirmi 100 XP',          aprasas: 'Surink 100 XP',                    rodiklis: 'visoXp',          tikslas: 100 },
  { id: 'xp500',     ikona: '💎', pavadinimas: '500 XP',                aprasas: 'Surink 500 XP',                    rodiklis: 'visoXp',          tikslas: 500 },
  { id: 'xp1000',    ikona: '👑', pavadinimas: '1000 XP',               aprasas: 'Surink 1000 XP',                   rodiklis: 'visoXp',          tikslas: 1000 },
  { id: 'dienos10',  ikona: '📅', pavadinimas: 'Dešimt pilnų dienų',    aprasas: 'Turėk 10 pilnų dienų',             rodiklis: 'pilnosDienos',    tikslas: 10 },
  { id: 'papildomos', ikona: '🎯', pavadinimas: 'Ekstra mylia',         aprasas: 'Atlik 10 papildomų užduočių',      rodiklis: 'papildomaAtlikta', tikslas: 10 },
];

// -----------------------------------------------------------------------------
//  Trenerio pagalbinės šablonų užduotys (pasirenkamos kuriant klientui užduotį)
// -----------------------------------------------------------------------------
export const SABLONAI = [
  { title: 'Padaryk 30 pritūpimų',                         category: 'judejimas',    xp: 10 },
  { title: 'Nužingsniuok 6 000 žingsnių',                  category: 'judejimas',    xp: 15 },
  { title: 'Užlipk 50 laiptelių',                          category: 'judejimas',    xp: 10 },
  { title: '10 minučių pasivaikščiok lauke',               category: 'judejimas',    xp: 10 },
  { title: 'Atlik 5 minučių lengvą tempimo pratimą',       category: 'judejimas',    xp: 10 },
  { title: 'Išgerk 2 litrus vandens',                      category: 'vanduo',       xp: 10 },
  { title: 'Suvalgyk 2 kiaušinius',                        category: 'mityba',       xp: 10 },
  { title: 'Suvalgyk 5 šaukštus graikiško jogurto',        category: 'mityba',       xp: 10 },
  { title: 'Sumažink cukraus kiekį kavoje perpus',         category: 'mityba',       xp: 10 },
  { title: 'Šiandien negerk saldžių gėrimų',               category: 'mityba',       xp: 15 },
  { title: 'Eik miegoti iki 23:00',                        category: 'miegas',       xp: 15 },
  { title: 'Prieš miegą 10 minučių be telefono',           category: 'miegas',       xp: 10 },
  { title: 'Ramiai pakvėpuok 5 minutes',                   category: 'proto_ramybe', xp: 10 },
];
