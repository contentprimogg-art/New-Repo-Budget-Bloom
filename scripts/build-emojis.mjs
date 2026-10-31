// Génère src/data/emojis.json (catalogue allégé pour le choix d'emoji des enveloppes) à partir d'emojibase-data.
// On garde: l'emoji, son groupe, son nom et ses mots-clés en français et en anglais (pour la recherche).
// On écarte les « composants » (tons de peau seuls…) et les emojis trop récents pour être affichés partout.
// Usage: node scripts/build-emojis.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const load = (path) => JSON.parse(readFileSync(new URL(`../node_modules/emojibase-data/${path}`, import.meta.url), 'utf8'))
const fr = load('fr/data.json')
const en = new Map(load('en/data.json').map((e) => [e.hexcode, e]))
const frGroups = load('fr/messages.json').groups
const enGroups = load('en/messages.json').groups

const MAX_VERSION = 15.1 // iOS 17.4+ / Android 14+

const list = fr
  .filter((e) => e.group !== undefined && e.group !== 2 && e.version <= MAX_VERSION)
  .sort((a, b) => a.order - b.order)
  .map((e) => {
    const english = en.get(e.hexcode)
    return [e.emoji, e.group, e.label, (e.tags ?? []).join(' '), english ? `${english.label} ${(english.tags ?? []).join(' ')}` : '']
  })

const groups = frGroups
  .filter((g) => g.order !== 2)
  .map((g) => ({ id: g.order, fr: g.message, en: enGroups.find((x) => x.order === g.order)?.message ?? g.key }))

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../src/data/emojis.json', import.meta.url), JSON.stringify({ groups, list }))
console.log(`${list.length} emojis, ${groups.length} groupes`)
