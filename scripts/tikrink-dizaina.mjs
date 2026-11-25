#!/usr/bin/env node
// =============================================================================
//  Dizaino ir nuoseklumo patikra (žr. DIZAINO-TAISYKLES.md)
//
//  Paleidimas:   node scripts/tikrink-dizaina.mjs
//  Pagrindas:    node scripts/tikrink-dizaina.mjs --atnaujink   (priima dabartinę būklę)
//
//  Tikrina klientų zonos (zona/) failus:
//   1. Visi ?v=... žymenys (talpyklos versija) turi būti VIENODI. Skirtingos versijos
//      sumaišo senus ir naujus failus telefone, ir puslapis nustoja veikti.
//   2. Nėra naujų confirm(), alert() ar prompt() iššokančių langų. Trynimas
//      patvirtinamas ant paties mygtuko (patvirtink() faile zona/app.js).
//   3. Nėra naujų spalvų, įrašytų tiesiai į puslapius ar skriptus (#fff, rgb(...)).
//      Spalvos imamos iš :root kintamųjų faile zona/stilius.css.
//
//  Senos problemos užfiksuotos faile scripts/dizaino-pagrindas.json, tad patikra
//  nepavyksta tik dėl NAUJŲ pažeidimų. Sutvarkius senus, paleisk su --atnaujink,
//  kad riba nusileistų.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sakninis = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zona = path.join(sakninis, 'zona');
const pagrindoFailas = path.join(sakninis, 'scripts', 'dizaino-pagrindas.json');
const atnaujinti = process.argv.includes('--atnaujink');

const failai = fs.readdirSync(zona)
  .filter((f) => /\.(html|js|css)$/.test(f))
  .sort();

const turinys = new Map(failai.map((f) => [f, fs.readFileSync(path.join(zona, f), 'utf8')]));
const klaidos = [];

// --- 1. talpyklos versijos -------------------------------------------------
const versijos = new Map();
for (const [f, t] of turinys) {
  for (const m of t.matchAll(/\?v=([0-9A-Za-z]+)/g)) {
    if (!versijos.has(m[1])) versijos.set(m[1], new Set());
    versijos.get(m[1]).add(f);
  }
}
if (versijos.size > 1) {
  const sarasas = [...versijos.entries()].map(([v, fs_]) => `    ${v}: ${[...fs_].slice(0, 4).join(', ')}${fs_.size > 4 ? ', ...' : ''}`).join('\n');
  klaidos.push(`Rastos ${versijos.size} skirtingos talpyklos versijos (?v=...). Turi būti viena:\n${sarasas}`);
}

// --- 2 ir 3. skaičiuojami pažeidimai pagal failą ------------------------------
const taisykles = {
  iššokantys_langai: /\b(?:window\.)?(?:confirm|alert|prompt)\s*\(/g,
  spalvos_puslapiuose: /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g,
};

const dabar = {};
for (const [f, t] of turinys) {
  if (f.endsWith('.css')) continue;  // spalvų lentelė gyvena CSS faile
  // Komentarai neskaičiuojami.
  const grynas = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  for (const [pav, re] of Object.entries(taisykles)) {
    const kiek = (grynas.match(re) || []).length;
    if (kiek) {
      dabar[pav] ??= {};
      dabar[pav][f] = kiek;
    }
  }
}

if (atnaujinti) {
  fs.writeFileSync(pagrindoFailas, JSON.stringify(dabar, null, 2) + '\n');
  console.log(`Pagrindas atnaujintas: ${path.relative(sakninis, pagrindoFailas)}`);
}

const pagrindas = fs.existsSync(pagrindoFailas) ? JSON.parse(fs.readFileSync(pagrindoFailas, 'utf8')) : {};
const pavadinimai = {
  iššokantys_langai: 'confirm()/alert()/prompt() iššokantys langai. Trynimui naudok patvirtink() ant mygtuko.',
  spalvos_puslapiuose: 'Spalvos tiesiai puslapyje ar skripte. Naudok kintamuosius iš stilius.css (:root).',
};
let nauju = 0;
for (const [pav, pagalFaila] of Object.entries(dabar)) {
  for (const [f, kiek] of Object.entries(pagalFaila)) {
    const buvo = pagrindas[pav]?.[f] ?? 0;
    if (kiek > buvo) {
      nauju += kiek - buvo;
      klaidos.push(`${f}: +${kiek - buvo} naujų (${pavadinimai[pav]})`);
    }
  }
}

if (klaidos.length && !atnaujinti) {
  console.error('Dizaino patikra: rasta problemų\n');
  for (const k of klaidos) console.error(' - ' + k);
  console.error('\nTaisyklės: DIZAINO-TAISYKLES.md');
  process.exit(1);
}

const sena = Object.values(pagrindas).reduce((n, o) => n + Object.values(o).reduce((a, b) => a + b, 0), 0);
console.log(`Dizaino patikra praėjo. Viena talpyklos versija (${[...versijos.keys()].join(', ') || 'nėra'}), naujų pažeidimų nėra.`);
if (sena) console.log(`Dar ${sena} senų vietų užfiksuota pagrinde ir laukia sutvarkymo.`);
