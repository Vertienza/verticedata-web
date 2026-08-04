#!/usr/bin/env node
/**
 * build-tokens.mjs — deriva assets/tokens.css desde el canonico de marca.
 *
 * El canonico vive FUERA de este repo:
 *   vertice-main/Marca/vertienza-design-tokens.json   (formato DTCG del W3C)
 *
 * Este script NO decide nada: traduce. Los valores se editan alli, jamas aqui.
 * El CSS derivado SI se commitea, porque Netlify despliega este repo tal cual
 * y no tiene acceso al repo del canonico.
 *
 * Uso:
 *   node scripts/build-tokens.mjs                 # ruta por defecto
 *   node scripts/build-tokens.mjs --check         # falla si el CSS esta desfasado
 *   TOKENS_SRC=/otra/ruta.json node scripts/build-tokens.mjs
 *
 * Salida: exit 0 si todo bien, 1 si el canonico no existe o --check falla.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SRC = process.env.TOKENS_SRC
  ? resolve(process.env.TOKENS_SRC)
  : resolve(ROOT, '../vertice-main/Marca/vertienza-design-tokens.json');

const OUT = resolve(ROOT, 'assets/tokens.css');
const CHECK = process.argv.includes('--check');

if (!existsSync(SRC)) {
  console.error(`ERROR: no encuentro el canonico de marca.\n  Esperaba: ${SRC}`);
  console.error('  Clona vertice-main junto a este repo, o pasa TOKENS_SRC=/ruta/al.json');
  process.exit(1);
}

const tk = JSON.parse(readFileSync(SRC, 'utf8'));

/** Recorre el arbol DTCG y devuelve [{ name, value, description }]. */
function flatten(node, path = []) {
  if (node && typeof node === 'object' && '$value' in node) {
    return [{ name: path.join('-'), value: node.$value, description: node.$description ?? '' }];
  }
  if (node && typeof node === 'object') {
    return Object.entries(node)
      .filter(([k]) => !k.startsWith('$') && !k.startsWith('_'))
      .flatMap(([k, v]) => flatten(v, [...path, k]));
  }
  return [];
}

const GRUPOS = [
  ['Color', flatten(tk.color, ['color'])],
  ['Tipografia — familias', flatten(tk.typography?.fontFamily ?? {}, ['font'])],
  ['Tipografia — escala fluida', flatten(tk.typography?.scale ?? {}, ['fs'])],
  ['Tipografia — interlineado', flatten(tk.typography?.lineHeight ?? {}, ['leading'])],
  ['Tipografia — pesos', flatten(tk.typography?.weight ?? {}, ['weight'])],
  ['Espaciado (escala de 4px)', flatten(tk.space ?? {}, ['space'])],
  ['Radios', flatten(tk.radius ?? {}, ['radius'])],
  ['Sombras', flatten(tk.shadow ?? {}, ['shadow'])],
];

/** `color-brand-600` -> `--vz-brand-600` (se cae el prefijo de categoria redundante). */
const varName = (name) => `--vz-${name.replace(/^color-/, '')}`;

const block = (rows) =>
  rows
    .map(({ name, value, description }) => {
      const decl = `  ${varName(name)}: ${value};`;
      if (!description) return decl;
      const short = description.split(/(?<=\.)\s|\s—\s/)[0].trim();
      return `${decl.padEnd(56)} /* ${short} */`;
    })
    .join('\n');

const secciones = GRUPOS.filter(([, rows]) => rows.length)
  .map(([titulo, rows]) => `  /* --- ${titulo} ${'-'.repeat(Math.max(2, 62 - titulo.length))} */\n${block(rows)}`)
  .join('\n\n');

const total = GRUPOS.reduce((n, [, rows]) => n + rows.length, 0);
const provisionales = GRUPOS.flatMap(([, rows]) => rows).filter((r) =>
  /PROVISIONAL/i.test(r.description ?? '')
).length;

const css = `/* =========================================================================
 * tokens.css — GENERADO. NO EDITAR A MANO.
 *
 * Fuente:   ${SRC.replace(process.env.HOME ?? '~', '~')}
 * Marca:    ${tk.name} v${tk.version}
 * Regenera: node scripts/build-tokens.mjs
 *
 * Cualquier cambio hecho aqui se pierde en la siguiente regeneracion.
 * Los valores de marca se editan en el canonico, y solo alli.
 *
 * Estas variables son PRIMITIVAS (que tiene la marca). El mapeo semantico
 * (que papel juega cada una en la web) vive en service.css: eso es una
 * decision de diseno, no una derivacion, y por eso no se genera.
 * ========================================================================= */

:root {
${secciones}
}
`;

if (CHECK) {
  const actual = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (actual !== css) {
    console.error('ERROR: assets/tokens.css esta desfasado respecto al canonico.');
    console.error('  Ejecuta: node scripts/build-tokens.mjs');
    process.exit(1);
  }
  console.log('OK: tokens.css al dia.');
  process.exit(0);
}

writeFileSync(OUT, css, 'utf8');
console.log(`OK: assets/tokens.css <- ${tk.name} v${tk.version}`);
console.log(`    ${total} tokens (${provisionales} provisionales, del brandbook los demas).`);
