// =============================================================================
//  BUTKUS COACHING, KLIENTŲ ZONA
//  Bendras sluoksnis: duomenų bazės ryšys, sesija, klaidų vertimas, pagalbininkai.
//  Visi puslapiai importuoja būtent šį failą, todėl Supabase klientas sukuriamas
//  tik vieną kartą viename puslapyje.
// =============================================================================

// Biblioteka įkeliama paprastu skriptu kiekvieno puslapio galvutėje, tad čia
// ji jau yra. Importo iš CDN nebėra tyčia: viena priklausomybė mažiau, ir
// zona veikia bet kuriame hostinge be išorinių užklausų.
const { createClient } = window.supabase ?? {};
if (typeof createClient !== 'function') {
  throw new Error('Nepavyko įkelti Supabase bibliotekos. Patikrink, ar puslapyje '
    + 'yra <script src="vendor/supabase-2.116.0.umd.js"> eilutė.');
}
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
} from './konfig.js';

// -----------------------------------------------------------------------------
//  Konfigūracijos patikra
//  Jei konfig.js dar neužpildytas, puslapiai parodo aiškų paaiškinimą, o ne
//  neaiškią tinklo klaidą.
// -----------------------------------------------------------------------------
// Tikri Supabase adresai visada yra mažosiomis raidėmis, todėl raidžių dydis
// tikrinamas tyčia: taip nepraeina šablono reikšmė PROJEKTO-ID, ir žmogus
// pamato aiškų paaiškinimą, o ne neaiškią tinklo klaidą.
export const KONFIGURUOTA =
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes('PROJEKTO') &&
  typeof SUPABASE_PUBLISHABLE_KEY === 'string' &&
  SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');

export const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Atkūrimo ir patvirtinimo nuorodos grįžta su žymenimis adreso eilutėje.
    // Šis nustatymas leidžia bibliotekai jas paversti sesija.
    detectSessionInUrl: true,
    // Numatytasis srautas ir vienintelis tinkamas statinei svetainei.
    // PKCE atveju kodo tikrintuvas liktų tame įrenginyje, kuris paprašė
    // atkūrimo, tad laiškas, atidarytas telefone vietoj kompiuterio, tyliai
    // nustotų veikti. Visi puslapiai privalo naudoti tą patį srautą.
    flowType: 'implicit',
    // Savas raktas, kad zona nesimaišytų su kitais tame pačiame domene
    // veikiančiais projektais.
    storageKey: 'butkuscoaching-zona-auth',
  },
});

// -----------------------------------------------------------------------------
//  Smulkūs pagalbininkai
// -----------------------------------------------------------------------------

/** Saugus teksto įdėjimas į HTML. Visur, kur rodomas vartotojo įvestas tekstas. */
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Rodo pranešimą pilkame, žaliame arba raudoname langelyje. */
export function pranesk(el, tekstas, tipas = 'info') {
  if (!el) return;
  el.className = 'note note-' + tipas;
  el.textContent = tekstas || '';
  el.hidden = !tekstas;
}

export function valyk(el) {
  if (el) {
    el.textContent = '';
    el.hidden = true;
  }
}

/** ISO data į lietuvišką formą, pavyzdžiui 2026 m. rugsėjo 8 d. */
const MENESIAI = [
  'sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio',
  'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio',
];

export function data(iso, suLaiku = false) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let out = `${d.getFullYear()} m. ${MENESIAI[d.getMonth()]} ${d.getDate()} d.`;
  if (suLaiku) {
    out += ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return out;
}


/**
 * Lietuviška daugiskaita: 1 failas, 2 failai, 10 failų, 11 failų, 21 failas.
 * Dvinaris klausimas ar vienas čia netinka, todėl ši funkcija yra viena
 * visiems puslapiams.
 */
export function zodis(n, vienas, keli, daug) {
  const paskutinis = n % 10;
  const priespaskutinis = Math.floor(n / 10) % 10;
  if (priespaskutinis === 1) return daug;
  if (paskutinis === 0) return daug;
  if (paskutinis === 1) return vienas;
  return keli;
}

/** Atsitiktinis raktas kvietimams. */
export function atsitiktinis(ilgis = 32) {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const baitai = new Uint8Array(ilgis);
  crypto.getRandomValues(baitai);
  return Array.from(baitai, (b) => abc[b % abc.length]).join('');
}

// -----------------------------------------------------------------------------
//  Klaidų vertimas
//  Supabase grąžina angliškus pranešimus. Klientas neturi jų matyti.
// -----------------------------------------------------------------------------
export function klaidaLT(klaida) {
  if (!klaida) return '';

  const zinute = String(klaida.message || klaida || '').toLowerCase();
  const kodas = String(klaida.code || klaida.status || '');

  // Tikroji angliška klaida lieka naršyklės konsolėje, kad ją būtų galima rasti
  // derinant, o žmogui rodomas tik lietuviškas paaiškinimas.
  try { console.warn('Zonos klaida:', klaida); } catch {}

  if (kodas === '540' || zinute.includes('project is paused')) {
    return 'Duomenų bazė laikinai nepasiekiama. Pabandyk po kelių minučių, o jei kartojasi, parašyk Daliui.';
  }
  if (zinute.includes('permission denied for table')) {
    return 'Zona dar nebaigta paruošti. Parašyk Daliui, jis tai sutvarkys.';
  }
  if (zinute.includes('failed to fetch') || zinute.includes('networkerror') || zinute.includes('load failed')) {
    return 'Nepavyko susisiekti su serveriu. Patikrink interneto ryšį ir bandyk dar kartą.';
  }
  if (zinute.includes('invalid login credentials')) {
    return 'Neteisingas el. paštas arba slaptažodis.';
  }
  if (zinute.includes('email not confirmed')) {
    return 'El. paštas dar nepatvirtintas. Patikrink pašto dėžutę, taip pat šlamšto aplanką.';
  }
  if (zinute.includes('user already registered') || zinute.includes('already been registered')) {
    return 'Šis el. paštas jau užregistruotas. Prisijunk arba atkurk slaptažodį.';
  }
  if (zinute.includes('password should be at least') || zinute.includes('password is too short')) {
    return 'Slaptažodis per trumpas. Reikia bent 8 simbolių.';
  }
  if (zinute.includes('weak password') || zinute.includes('password is known to be weak')) {
    return 'Slaptažodis per silpnas. Pasirink ilgesnį ir mažiau įprastą.';
  }
  if (zinute.includes('new password should be different')) {
    return 'Naujas slaptažodis turi skirtis nuo senojo.';
  }
  if (zinute.includes('unable to validate email') || zinute.includes('invalid email')) {
    return 'El. pašto adresas atrodo neteisingas.';
  }
  if (zinute.includes('for security purposes') || zinute.includes('rate limit') || zinute.includes('too many requests') || kodas === '429') {
    return 'Per daug bandymų iš eilės. Palauk minutę ir bandyk dar kartą.';
  }
  if (zinute.includes('auth session missing') || zinute.includes('session_not_found') || zinute.includes('jwt expired')) {
    return 'Sesija baigėsi. Prisijunk iš naujo.';
  }
  if (zinute.includes('token has expired') || zinute.includes('otp_expired') || zinute.includes('link is invalid')) {
    return 'Nuoroda nebegalioja. Paprašyk naujo laiško.';
  }
  if (kodas === '42501' || zinute.includes('row-level security') || zinute.includes('violates row-level security')) {
    return 'Neturi teisių šiam veiksmui.';
  }
  if (kodas === '23505' || zinute.includes('duplicate key')) {
    return 'Toks įrašas jau yra.';
  }
  if (kodas === '23503' || zinute.includes('foreign key')) {
    return 'Įrašas susietas su kitais duomenimis, todėl neištrinamas.';
  }
  if (kodas === 'PGRST205' || zinute.includes('could not find the table') || zinute.includes('schema cache')) {
    return 'Zona dar nebaigta paruošti. Parašyk Daliui, jis tai sutvarkys.';
  }
  if (zinute.includes('prieiga sustabdyta')) return 'Tavo prieiga sustabdyta. Parašyk Daliui.';
  if (zinute.includes('kitam el. pašto adresui')) {
    return 'Šis kvietimas skirtas kitam el. pašto adresui. Registruokis tuo adresu, kuriuo gavai nuorodą.';
  }
  if (zinute.includes('kvietimas nerastas')) return 'Kvietimas nerastas. Patikrink, ar nuoroda nukopijuota iki galo.';
  if (zinute.includes('kvietimas jau panaudotas')) return 'Šis kvietimas jau panaudotas.';
  if (zinute.includes('kvietimo galiojimas')) return 'Kvietimo galiojimas pasibaigė. Paprašyk Daliaus naujo.';
  if (zinute.includes('bucket not found')) {
    return 'Failų saugykla dar neparuošta. Parašyk Daliui, jis tai sutvarkys.';
  }
  if (kodas === '404' || zinute.includes('object not found')) {
    return 'Failo nebėra. Greičiausiai jis buvo pakeistas nauju, parašyk Daliui.';
  }
  if (zinute.includes('exceeded the maximum allowed size') || zinute.includes('payload too large')) {
    return 'Failas per didelis. Nemokamo plano riba yra 50 MB vienam failui.';
  }
  if (zinute.includes('mime type') && zinute.includes('not supported')) {
    return 'Tokio tipo failo įkelti negalima. Tinka PDF, nuotraukos, MP4, Word, Excel ir tekstiniai failai.';
  }
  if (zinute.includes('the resource already exists') || zinute.includes('duplicate')) {
    return 'Toks failas jau įkeltas.';
  }

  // Angliško teksto klientui nerodome niekada, jis jau nuėjo į konsolę.
  return 'Kažkas nepavyko. Pabandyk dar kartą, o jei kartojasi, parašyk Daliui.';
}

// -----------------------------------------------------------------------------
//  Sesija
// -----------------------------------------------------------------------------

/**
 * Grąžina esamą sesiją arba null. Nenukreipia niekur.
 * getSession skaito iš naršyklės atminties, todėl veikia iškart ir be tinklo.
 */
export let sesijosKlaida = null;

export async function sesija() {
  const { data: d, error } = await db.auth.getSession();
  // Nepavęs žetono atnaujinimas grąžina tą patį null, kaip ir visiškai
  // neprisijungęs žmogus. Be šios eilutės dinges internetas atrodytų kaip
  // atsijungimas, o žmogus būtų tyliai išmestas be jokio paaiškinimo.
  sesijosKlaida = error ?? null;
  return d?.session ?? null;
}

/**
 * Puslapio apsauga. Kviečiama kiekvieno vidinio puslapio pradžioje.
 *
 * Svarbu suprasti, ko ši funkcija NEDARO: ji nėra apsauga. Naršyklės atmintį
 * galima redaguoti ranka, tad ji tik nusprendžia, ką rodyti. Tikroji apsauga
 * visa yra duomenų bazės taisyklėse, kurios žetoną tikrina serveryje.
 *
 * Eiga:
 *   1. Ar yra išsaugota sesija. Jei ne, nukreipiame į prisijungimą.
 *   2. Paimame profilį ir trenerio požymį. Ši užklausa kartu parodo, ar
 *      serveris žetoną dar pripažįsta.
 *   3. Sustabdytą klientą išleidžiame lauk.
 */
export async function reikiaSesijos({ tikTreneriui = false } = {}) {
  if (!KONFIGURUOTA) {
    rodykKonfigKlaida();
    return null;
  }

  const s = await sesija();
  if (!s) {
    if (sesijosKlaida) {
      location.replace('index.html?priezastis=rysys');
      return null;
    }
    iPrisijungima();
    return null;
  }

  const vartotojas = s.user;

  // Viena užklausa atlieka du darbus: paima profilį ir kartu patikrina, ar
  // serveris dar pripažįsta žetoną. Atskiro getUser kvietimo nereikia, o kiekvienas
  // puslapio atidarymas sutaupo vieną kelionę į serverį.
  const [profilioAtsakas, trenerioAtsakas] = await Promise.all([
    db.from('profiles')
      .select('id, email, full_name, phone, status, created_at')
      .eq('id', vartotojas.id)
      .maybeSingle(),
    db.rpc('ar_treneris'),
  ]);

  const pKlaida = profilioAtsakas.error;
  const profilis = profilioAtsakas.data;

  if (pKlaida) {
    // Nebegaliojantis žetonas reiškia, kad sesija pasibaigė. Bet koks kitas
    // gedimas, pavyzdžiui dingęs internetas, vartotojo iš zonos neišmeta.
    const zinute = String(pKlaida.message || '').toLowerCase();
    const kodas = String(pKlaida.code || pKlaida.status || '');
    if (kodas === '401' || zinute.includes('jwt') || zinute.includes('token is expired')) {
      await db.auth.signOut({ scope: 'local' });
      iPrisijungima();
      return null;
    }
    return { vartotojas, profilis: null, arTreneris: false, klaida: pKlaida };
  }

  const arTreneris = trenerioAtsakas.data === true;

  // maybeSingle be eilutės grąžina null be klaidos. Toks vartotojas neturi
  // profilio, tad visos būsenų patikros jį praleistų kaip tvarkingą.
  if (!profilis) {
    return {
      vartotojas, profilis: null, arTreneris,
      klaida: { message: 'Profilis nerastas', code: 'PROFILIS_NERASTAS' },
    };
  }

  if (profilis.status === 'blocked') {
    await db.auth.signOut({ scope: 'local' });
    location.replace('index.html?priezastis=blocked');
    return null;
  }

  if (tikTreneriui && !arTreneris) {
    location.replace('mano.html');
    return null;
  }

  return { vartotojas, profilis, arTreneris, klaida: null };
}

/**
 * Kvietimo panaudojimas po el. pašto patvirtinimo.
 *
 * Kai projekte įjungtas patvirtinimas, registracijos metu sesijos dar nėra,
 * todėl kvietimo panaudoti negalime. Token lieka naršyklės atmintyje, o čia
 * jis panaudojamas per pirmą prisijungimą.
 *
 * Grąžina true, jei profilis buvo aktyvuotas ir duomenis verta perskaityti iš naujo.
 */
export const KVIETIMO_RAKTAS = 'butkuscoaching-kvietimas';

export async function panaudokLaukiantiKvietima(profilis) {
  if (!profilis || profilis.status !== 'pending') return false;

  let token = null;
  try {
    token = localStorage.getItem(KVIETIMO_RAKTAS);
  } catch {
    return false;
  }
  if (!token) return false;

  const { error } = await db.rpc('redeem_invite', { p_token: token });

  if (error) {
    // Laikinas gedimas: žymenį paliekame, kitas prisijungimas pabandys vėl.
    // Jei kvietimas negrįžtamai netinkamas, žymenį išvalome, kad jis niekada
    // neaktyvuotų kito žmogaus paskyros.
    const kodas = String(error.code || '');
    if (kodas === 'P0001' || kodas === 'P0002') {
      try { localStorage.removeItem(KVIETIMO_RAKTAS); } catch {}
    }
    return false;
  }

  try { localStorage.removeItem(KVIETIMO_RAKTAS); } catch {}
  return true;
}

export function iPrisijungima() {
  const dabar = location.pathname.split('/').pop() || 'index.html';
  const grazinti = dabar === 'index.html' ? '' : `?toliau=${encodeURIComponent(dabar + location.search)}`;
  location.replace('index.html' + grazinti);
}

export async function atsijungti() {
  try {
    await db.auth.signOut({ scope: 'local' });
  } catch {
    // Net jei serveris neatsako, vietinę sesiją reikia išvalyti.
  }
  location.replace('index.html');
}

/** Adresas, į kurį grįžtama iš el. laiško nuorodos. */
export function absoliutus(failas) {
  return new URL(failas, location.href).href;
}

// -----------------------------------------------------------------------------
//  Bendri puslapio elementai
// -----------------------------------------------------------------------------

export function rodykNav(profilis, aktyvus = '', arTreneris = false) {
  const holder = $('#nav-right');
  if (!holder) return;

  const treneris = arTreneris === true;
  const vardas = profilis?.full_name?.trim() || profilis?.email || '';

  const nuorodos = [{ href: 'mano.html', tekstas: 'Mano programa' }];
  // Savaitinė ataskaita yra kliento savaitinis pildomas dalykas -- treneriui
  // savęs tikrinti nereikia, tad jam šios nuorodos meniu nerodome.
  if (!treneris) nuorodos.push({ href: 'patikrinimas.html', tekstas: 'Savaitinė ataskaita' });
  if (treneris) nuorodos.push({ href: 'valdymas.html', tekstas: 'Valdymas' });
  nuorodos.push({ href: 'paskyra.html', tekstas: 'Paskyra' });

  holder.innerHTML = `
    <nav class="nav-links" aria-label="Zonos meniu">
      ${nuorodos.map((n) => `<a href="${n.href}"${n.href === aktyvus ? ' aria-current="page"' : ''}>${esc(n.tekstas)}</a>`).join('')}
    </nav>
    <span class="nav-user">${esc(vardas)}</span>
    <button class="btn btn-ghost btn-sm" type="button" id="atsijungti">Atsijungti</button>
  `;

  $('#atsijungti')?.addEventListener('click', atsijungti);
}

export function rodykKonfigKlaida() {
  const kur = $('#turinys') || document.body;
  kur.innerHTML = `
    <div class="shell page">
      <div class="note note-error" style="max-width:64ch">
        <strong>Zona dar neprijungta prie duomenų bazės.</strong><br>
        Faile <code>zona/konfig.js</code> įrašyk savo Supabase projekto adresą į
        <code>SUPABASE_URL</code>. Jį rasi Supabase skydelyje:
        Project Settings, tada Data API, laukas Project URL.
      </div>
    </div>
  `;
}

/** Trumpas įkrovimo užrašas. */
export function kraunasi(el, tekstas = 'Kraunama') {
  if (!el) return;
  el.innerHTML = `<div class="loading"><span class="spinner" aria-hidden="true"></span><span>${esc(tekstas)}</span></div>`;
}

export const BUSENOS = {
  active: 'Aktyvi',
  pending: 'Laukia kvietimo',
  blocked: 'Sustabdyta',
};
