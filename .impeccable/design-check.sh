#!/usr/bin/env bash
#
# Informe de calidad de diseno de verticedata-web.
#
# Dos pasadas, a proposito:
#   GATE     usa .impeccable/config.json -> solo defectos reales (accesibilidad,
#            legibilidad, semantica). Es el numero que debe llegar a cero.
#   INFORME  ignora la config (--no-config) -> anade los tells de moda de la IA.
#            Nunca bloquea; sirve para saber cuanto queda de "olor a IA".
#
# Uso:  ./.impeccable/design-check.sh
#
# Version fijada a proposito (reproducibilidad): las reglas del detector cambian
# entre versiones y un mismo commit debe dar siempre el mismo resultado.
# Para subir de version, cambiar IMP_VERSION y revisar el delta antes de fijarla.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

IMP_VERSION="3.3.1"
run() { npx --yes "impeccable@${IMP_VERSION}" detect . "$@" 2>&1; }
resumen() { grep -oE '^[[:space:]]+\[[a-z-]+\]' | tr -d ' []' | sort | uniq -c | sort -rn; }

echo "──────────────────────────────────────────────────────────"
echo " GATE — defectos reales (objetivo: 0)"
echo "──────────────────────────────────────────────────────────"
run | resumen
run --quiet | tail -1

echo
echo "──────────────────────────────────────────────────────────"
echo " INFORME — todo, incluidos los tells de IA (no bloquea)"
echo "──────────────────────────────────────────────────────────"
run --no-config | resumen
run --no-config --quiet | tail -1

echo
echo "Detalle de una regla concreta:"
echo "  npx impeccable@${IMP_VERSION} detect . --no-config | grep -A1 'low-contrast'"
echo "Silenciar un caso justificado, en el propio fichero:"
echo "  <!-- impeccable-disable-line overused-font -- razon -->"
