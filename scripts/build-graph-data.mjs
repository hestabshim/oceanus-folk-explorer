// Builds public/graph-data.js from the VAST 2025 MC1 graph.
// Usage: node scripts/build-graph-data.mjs path/to/MC1_graph.json
import { readFile, writeFile } from 'node:fs/promises';

const source = process.argv[2];
if (!source) { console.error('Usage: node scripts/build-graph-data.mjs path/to/MC1_graph.json'); process.exit(1); }
const graph = JSON.parse(await readFile(source, 'utf8'));

const INFLUENCE = ['InStyleOf', 'InterpolatesFrom', 'LyricalReferenceTo', 'CoverOf', 'DirectlySamples'];
const CREDITS = ['PerformerOf', 'ComposerOf', 'LyricistOf']; // a work belongs to everyone credited this way
const FOCUS = 'Oceanus Folk';
const nodes = new Map(graph.nodes.map(node => [node.id, node]));
const isWork = node => node && (node['Node Type'] === 'Song' || node['Node Type'] === 'Album');
const isArtist = node => node && (node['Node Type'] === 'Person' || node['Node Type'] === 'MusicalGroup');
const year = node => Number(node.release_date) || null;

// Credited artists of each work, and works of each artist.
const credited = new Map();
const worksOf = new Map();
const producers = new Map();
for (const edge of graph.links) {
  const artist = nodes.get(edge.source), work = nodes.get(edge.target);
  if (!isArtist(artist) || !isWork(work)) continue;
  const into = CREDITS.includes(edge['Edge Type']) ? credited : edge['Edge Type'] === 'ProducerOf' ? producers : null;
  if (!into) continue;
  if (!into.has(work.id)) into.set(work.id, new Set());
  into.get(work.id).add(artist.id);
  if (into === credited) {
    if (!worksOf.has(artist.id)) worksOf.set(artist.id, new Map());
    worksOf.get(artist.id).set(work.id, work);
  }
}

const genres = [...new Set(graph.nodes.filter(isWork).map(node => node.genre).filter(Boolean))].sort();
const genreIndex = new Map(genres.map((name, index) => [name, index]));
const artistIds = [...worksOf.keys()];
const artistIndex = new Map(artistIds.map((id, index) => [id, index]));
const ownersOf = node => isArtist(node) ? (artistIndex.has(node.id) ? [node.id] : []) : [...(credited.get(node.id) || [])];

// Collaborators: credited on the same work (incl. producers), or group membership.
const collaborators = artistIds.map(() => new Map());
const collaborate = (a, b) => {
  if (a === b || !artistIndex.has(a) || !artistIndex.has(b)) return;
  const [i, j] = [artistIndex.get(a), artistIndex.get(b)];
  collaborators[i].set(j, (collaborators[i].get(j) || 0) + 1);
  collaborators[j].set(i, (collaborators[j].get(i) || 0) + 1);
};
for (const [work, people] of credited) {
  const everyone = [...new Set([...people, ...(producers.get(work) || [])])];
  everyone.forEach((a, index) => everyone.slice(index + 1).forEach(b => collaborate(a, b)));
}
const groupsOf = new Map();
for (const edge of graph.links) if (edge['Edge Type'] === 'MemberOf') {
  collaborate(edge.source, edge.target);
  if (artistIndex.has(edge.source) && artistIndex.has(edge.target)) {
    if (!groupsOf.has(edge.source)) groupsOf.set(edge.source, []);
    groupsOf.get(edge.source).push(artistIndex.get(edge.target));
  }
}
const producedBy = new Map();
for (const [work, people] of producers) people.forEach(id => { if (!producedBy.has(id)) producedBy.set(id, []); producedBy.get(id).push(work); });

// Artist-level influence: when A's work (or A) references B's work (or B), B influenced A.
// Stored inward only; the page derives the outward direction.
const inward = artistIds.map(() => new Map());
// Genre-level flow to and from Oceanus Folk, by year of the referencing work.
const evidence = {outbound:[], inbound:[]};
const evidenceWorks = new Map();
const workRef = node => {
  if (!evidenceWorks.has(node.id)) evidenceWorks.set(node.id, evidenceWorks.size);
  return evidenceWorks.get(node.id);
};

for (const edge of graph.links) {
  const type = INFLUENCE.indexOf(edge['Edge Type']);
  if (type < 0) continue;
  const from = nodes.get(edge.source), to = nodes.get(edge.target);
  for (const a of ownersOf(from)) for (const b of ownersOf(to)) {
    if (a === b) continue;
    const map = inward[artistIndex.get(a)], key = artistIndex.get(b);
    if (!map.has(key)) map.set(key, {types:[0, 0, 0, 0, 0], first:Infinity, refs:[]});
    map.get(key).types[type] += 1;
    // The songs behind the link; -1 when the reference is to or from the artist rather than a work
    map.get(key).refs.push(type, isWork(from) ? workRef(from) : -1, isWork(to) ? workRef(to) : -1);
    if (year(from)) map.get(key).first = Math.min(map.get(key).first, year(from));
  }
  if (!isWork(from) || !isWork(to) || !year(from) || from.genre === to.genre) continue;
  const direction = to.genre === FOCUS ? 'outbound' : from.genre === FOCUS ? 'inbound' : null;
  if (!direction) continue;
  evidence[direction].push([genreIndex.get(direction === 'outbound' ? from.genre : to.genre), year(from), type, workRef(from), workRef(to)]);
}

// Notoriety: average of three log-scaled signals, each relative to the top artist.
const outwardCount = artistIds.map(() => 0);
inward.forEach(map => map.forEach((_, b) => { outwardCount[b] += 1; }));
const stats = artistIds.map((id, index) => {
  const works = [...worksOf.get(id).values()];
  return {works:works.length, notable:works.filter(work => work.notable).length, influenced:outwardCount[index]};
});
const peak = key => Math.log1p(Math.max(...stats.map(item => item[key])));
const peaks = {works:peak('works'), notable:peak('notable'), influenced:peak('influenced')};
const notoriety = item => Math.round(100 * (Math.log1p(item.works) / peaks.works + Math.log1p(item.notable) / peaks.notable + Math.log1p(item.influenced) / peaks.influenced) / 3);

const artists = artistIds.map((id, index) => {
  const node = nodes.get(id);
  const works = [...worksOf.get(id).values()];
  const notableYears = works.map(work => Number(work.notoriety_date) || (work.notable ? year(work) : 0)).filter(Boolean);
  const artist = {
    n:node.name,
    s:notoriety(stats[index]),
    k:[stats[index].works, stats[index].notable, stats[index].influenced],
    w:works.map(work => [year(work) || 0, genreIndex.get(work.genre) ?? -1, work.notable ? 1 : 0, workRef(work)]).sort((a, b) => a[0] - b[0])
  };
  if (node['Node Type'] === 'MusicalGroup') artist.g = 1;
  if (notableYears.length) artist.f = Math.min(...notableYears);
  if (inward[index].size) {
    artist.i = [...inward[index]].map(([b, entry]) => [b, entry.first === Infinity ? 0 : entry.first, ...entry.types]);
    artist.e = [...inward[index].values()].map(entry => entry.refs);
  }
  if (producedBy.has(id)) artist.p = producedBy.get(id).map(work => workRef(nodes.get(work)));
  if (groupsOf.has(id)) artist.m = groupsOf.get(id);
  if (collaborators[index].size) artist.c = [...collaborators[index]].flat();
  return artist;
});

const works = [...evidenceWorks.keys()].map(id => {
  const node = nodes.get(id);
  return [node.name, year(node) || 0, genreIndex.get(node.genre) ?? -1, ownersOf(node).map(artist => artistIndex.get(artist))];
});
const years = Object.values(evidence).flat().map(item => item[1]);

// Career milestones, from first performed release (the graph has no formation dates).
const firstRelease = name => {
  const id = graph.nodes.find(node => node.name === name)?.id;
  const releases = graph.links.filter(edge => edge.source === id && edge['Edge Type'] === 'PerformerOf').map(edge => year(nodes.get(edge.target))).filter(Boolean);
  return releases.length ? Math.min(...releases) : null;
};
const milestones = {ivyEchos:firstRelease('Ivy Echos'), sailorSolo:firstRelease('Sailor Shift')};

const data = {focus:FOCUS, types:INFLUENCE, genres, years:[Math.min(...years), Math.max(...years)], milestones, notorietyPeaks:[peaks.works, peaks.notable, peaks.influenced], evidence, works, artists};
await writeFile(new URL('../public/graph-data.js', import.meta.url), `window.GRAPH_DATA=${JSON.stringify(data)};\n`);
console.log(`${artists.length} artists, ${evidence.outbound.length} outbound and ${evidence.inbound.length} inbound Oceanus Folk references, years ${data.years.join('–')}`);
