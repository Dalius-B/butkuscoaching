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

  siandienosUzduotys: 'Šiandienos užduotys',
  papildomosUzduotys: 'Papildomos užduotys',
  papildomosPaaiskinimas: 'Neprivalomos. Jei turi jėgų, padaryk, jei ne, nieko tokio.',
  papildoma: 'Papildoma',
  atlikta: 'Atlikta ✓',
  pazymeti: 'Pažymėti kaip atliktą',
  atsaukti: 'Atšaukti žymėjimą',
  pazanga: 'Pažanga',

  atlikoIs: (a, is) => `Atlikta ${a} iš ${is}`,
  darLiko: (n) => `Dar liko ${n} ${zodisUzduotis(n)}`,
  visosAtliktos: 'Puiku! Visos šiandienos užduotys atliktos.',
  dienaBaigta: 'Diena baigta!',
  uzduotisAtlikta: 'Užduotis atlikta!',
  zymejimasAtsauktas: 'Žymėjimas atšauktas',
  pazymeta: 'Pažymėta',
  zidetiVideo: 'Žiūrėti video',
  uzdaryti: 'Uždaryti',
  videoNaujameLange: 'Atidaryti naujame lange',
  prideti: 'Pridėti',
  sumazinti: 'Sumažinti',

  // Savaitės pažanga
  sisSavaite: 'Ši savaitė',
  savaiteProc: (p) => `${p}%`,
  savaiteNauja: 'Nauja savaitė. Pirmas žingsnis šiandien.',
  savaitesPaaiskinimas: 'Kiek planuotų užduočių jau atlikta šią savaitę. Dalinai atliktos skaičiuojasi dalimi.',

  // Nuotaika
  nuotaikaKlausimas: 'Kaip šiandien jautiesi?',
  nuotaikos: [
    { v: 1, ikona: '😞', pavadinimas: 'Labai sunku' },
    { v: 2, ikona: '😕', pavadinimas: 'Sunkoka' },
    { v: 3, ikona: '😐', pavadinimas: 'Šiaip sau' },
    { v: 4, ikona: '🙂', pavadinimas: 'Gerai' },
    { v: 5, ikona: '😄', pavadinimas: 'Puikiai' },
  ],
  nuotaikaTekstas: 'Parašyk, jei nori (neprivaloma). Tai matysime tik tu ir Dalius.',
  nuotaikaIssaugoti: 'Išsaugoti',
  nuotaikaIssaugota: 'Išsaugota ✓',
  nuotaikaKlaida: 'Nepavyko išsaugoti. Pabandyk dar kartą.',
  zinuteNuoDaliaus: 'Žinutė nuo Daliaus',

  // Artimiausios dienos
  artimiausiosDienos: 'Kas laukia artimiausiomis dienomis',
  rytoj: 'Rytoj',
  poilsisZodis: 'Poilsio diena',

  tuscia: 'Kol kas užduočių nėra',
  tusciaTekstas: 'Dalius netrukus paruoš tau užduotis. Kai tik jos atsiras, matysi jas čia.',
  poilsioDiena: 'Šiandien poilsio diena',
  poilsioTekstas: 'Šiai dienai privalomų užduočių nėra. Pailsėk, o rytoj vėl į darbą.',
  tikPapildomos: 'Šiandien privalomų užduočių nėra, bet gali atlikti papildomas.',

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
//  Trenerio pagalbinės šablonų užduotys (pasirenkamos kuriant klientui užduotį)
// -----------------------------------------------------------------------------
export const SABLONAI = [
  // --- Sportas ---
  { title: 'Padaryk 30 pritūpimų',                          category: 'judejimas', xp: 10, target: 30, unit: 'pritūpimų', step: 10 },
  { title: 'Padaryk 15 atsispaudimų',                       category: 'judejimas', xp: 10, target: 15, unit: 'atsispaudimų', step: 5 },
  { title: 'Išlaikyk lentą 45 sekundes',                    category: 'judejimas', xp: 10 },
  { title: 'Padaryk 20 iššokimų iš pritūpimo',              category: 'judejimas', xp: 10 },
  { title: 'Padaryk 20 įpuolimų (kiekviena koja)',          category: 'judejimas', xp: 10 },
  { title: 'Atlik 3 raumenų stiprinimo serijas namuose',    category: 'judejimas', xp: 15 },
  { title: 'Atlik šiandienos treniruotę pagal programą',    category: 'judejimas', xp: 25, description: 'Pagrindinė savaitės treniruotė' },
  { title: 'Nužingsniuok 6 000 žingsnių',                   category: 'judejimas', xp: 15, target: 6000, unit: 'žingsnių', step: 1000 },
  { title: 'Nužingsniuok 10 000 žingsnių',                  category: 'judejimas', xp: 20, target: 10000, unit: 'žingsnių', step: 1000 },
  { title: '10 minučių pasivaikščiok lauke',                category: 'judejimas', xp: 10 },
  { title: '30 minučių greitai pasivaikščiok',              category: 'judejimas', xp: 15 },
  { title: 'Užlipk 50 laiptelių',                           category: 'judejimas', xp: 10, target: 50, unit: 'laiptelių', step: 10 },
  { title: 'Pabėgiok 20 minučių lengvu tempu',              category: 'judejimas', xp: 20 },
  { title: 'Atlik 5 minučių lengvą tempimo pratimą',        category: 'judejimas', xp: 10 },
  { title: 'Atlik 10 minučių mobilumo rutiną',              category: 'judejimas', xp: 10 },
  { title: 'Kas valandą atsistok ir pasitempk (darbe)',     category: 'judejimas', xp: 10 },

  // --- Proto sveikata ---
  { title: 'Ramiai pakvėpuok 5 minutes',                    category: 'proto_ramybe', xp: 10 },
  { title: 'Pamedituok 10 minučių',                         category: 'proto_ramybe', xp: 15 },
  { title: 'Užsirašyk 3 dalykus, už kuriuos esi dėkingas',  category: 'proto_ramybe', xp: 10 },
  { title: 'Parašyk dienoraštyje apie savo dieną',          category: 'proto_ramybe', xp: 10 },
  { title: 'Pabūk 15 minučių be telefono',                  category: 'proto_ramybe', xp: 10 },
  { title: 'Pabūk lauke saulėje bent 15 minučių',           category: 'proto_ramybe', xp: 10 },
  { title: 'Paskambink ar parašyk artimam žmogui',          category: 'proto_ramybe', xp: 10 },
  { title: 'Padaryk vieną dalyką, kuris tau teikia malonumą', category: 'proto_ramybe', xp: 10 },
  { title: 'Užsirašyk 3 svarbiausius šios dienos darbus',   category: 'proto_ramybe', xp: 10 },
  { title: 'Vakare pagirk save už vieną dalyką',            category: 'proto_ramybe', xp: 10 },
  { title: 'Šiandien 1 valandą nežiūrėk socialinių tinklų', category: 'proto_ramybe', xp: 15 },
  { title: 'Perskaityk 10 puslapių knygos',                 category: 'proto_ramybe', xp: 10 },

  // --- Mityba ---
  { title: 'Suvalgyk 2 kiaušinius',                         category: 'mityba', xp: 10, target: 2, unit: 'kiaušiniai', step: 1 },
  { title: 'Suvalgyk 5 šaukštus graikiško jogurto',         category: 'mityba', xp: 10 },
  { title: 'Suvalgyk baltymų kiekvieno valgio metu',        category: 'mityba', xp: 15 },
  { title: 'Suvalgyk bent 2 porcijas daržovių',             category: 'mityba', xp: 10, target: 2, unit: 'porcijos', step: 1 },
  { title: 'Suvalgyk bent 2 vaisius',                       category: 'mityba', xp: 10, target: 2, unit: 'vaisiai', step: 1 },
  { title: 'Pusę lėkštės užpildyk daržovėmis',              category: 'mityba', xp: 10 },
  { title: 'Pusryčiai su baltymais per valandą nuo atsikėlimo', category: 'mityba', xp: 10 },
  { title: 'Sumažink cukraus kiekį kavoje perpus',          category: 'mityba', xp: 10 },
  { title: 'Šiandien negerk saldžių gėrimų',                category: 'mityba', xp: 15 },
  { title: 'Šiandien nevalgyk saldumynų',                   category: 'mityba', xp: 15 },
  { title: 'Šiandien negerk alkoholio',                     category: 'mityba', xp: 15 },
  { title: 'Nevalgyk 2 valandas prieš miegą',               category: 'mityba', xp: 10 },
  { title: 'Valgyk lėtai, be telefono ir televizoriaus',    category: 'mityba', xp: 10 },
  { title: 'Pasiruošk sveiką maistą rytdienai',             category: 'mityba', xp: 15 },
  { title: 'Įsirašyk visą dienos maistą į dienoraštį',      category: 'mityba', xp: 15 },
  { title: 'Sustok valgyti, kai jautiesi sotus (80%)',      category: 'mityba', xp: 10 },

  // --- Vanduo ---
  { title: 'Išgerk 10 stiklinių vandens',                 category: 'vanduo', xp: 15, target: 10, unit: 'stiklinių', step: 1 },
  { title: 'Išgerk 2 litrus vandens',                       category: 'vanduo', xp: 10, target: 8, unit: 'stiklinių', step: 1, description: '1 stiklinė yra 250 ml' },
  { title: 'Išgerk stiklinę vandens iškart atsikėlęs',      category: 'vanduo', xp: 10 },
  { title: 'Išgerk stiklinę vandens prieš kiekvieną valgį', category: 'vanduo', xp: 10 },

  // --- Miegas ---
  { title: 'Eik miegoti iki 23:00',                         category: 'miegas', xp: 15 },
  { title: 'Miegok bent 7 valandas',                        category: 'miegas', xp: 15 },
  { title: 'Prieš miegą 30 minučių be telefono',            category: 'miegas', xp: 10 },
  { title: 'Kelkis kiekvieną dieną tuo pačiu laiku',        category: 'miegas', xp: 10 },
];
