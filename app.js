'use strict';

/* ---------- Stockage local ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const REGLAGES_DEFAUT = { cle: '', modele: '', autoGemini: true, autoEnvoi: true };
/* ---------- Mes valeurs ---------- */
// Textes cités mot pour mot (Légifrance / conseil-constitutionnel.fr).
const VALEURS_DEFAUT = [
  { id: 'democratie', nom: 'Démocratie', def: "Le pouvoir appartient au peuple, pas seulement le jour du vote : son choix doit être respecté et il doit pouvoir décider plus souvent.",
    texte: "« La souveraineté nationale appartient au peuple qui l'exerce par ses représentants et par la voie du référendum. »", source: 'Constitution de 1958, article 3' },
  { id: 'egalite', nom: 'Égalité et équité', def: "Les mêmes droits pour tous, et corriger les écarts pour que ces droits soient réels : chacun contribue selon ses moyens.",
    texte: "« Les hommes naissent et demeurent libres et égaux en droits. » Et l'impôt « doit être également réparti entre tous les citoyens, en raison de leurs facultés ».", source: 'Déclaration de 1789, articles 1 et 13' },
  { id: 'personne', nom: 'Personne laissé derrière', def: "Une société se juge à la façon dont elle traite les plus fragiles : personne ne doit crever la dalle quand on a les moyens de l'éviter.",
    texte: "Tout être humain qui se trouve dans l'incapacité de travailler « a le droit d'obtenir de la collectivité des moyens convenables d'existence ».", source: 'Préambule de la Constitution de 1946, alinéa 11' },
  { id: 'ecologie', nom: 'Écologie', def: "Préserver un monde vivable, en faisant payer d'abord ceux qui polluent le plus.",
    texte: "« Chacun a le droit de vivre dans un environnement équilibré et respectueux de la santé. »", source: "Charte de l'environnement de 2004, article 1er" },
  { id: 'laicite', nom: 'Laïcité', def: "Liberté de croire ou de ne pas croire, et un État neutre qui protège tout le monde de la même façon.",
    texte: "« La République assure la liberté de conscience. » « La République ne reconnaît, ne salarie ni ne subventionne aucun culte. »", source: 'Loi du 9 décembre 1905, articles 1 et 2' },
  { id: 'paix', nom: 'Paix', def: "La diplomatie avant les armes, et le refus des guerres d'agression, d'où qu'elles viennent.",
    texte: "La République « n'entreprendra aucune guerre dans des vues de conquête et n'emploiera jamais ses forces contre la liberté d'aucun peuple ».", source: 'Préambule de la Constitution de 1946, alinéa 14' },
  { id: 'libertes', nom: 'Libertés publiques', def: "Pouvoir s'exprimer, manifester, faire grève, sans surveillance ni répression abusives.",
    texte: "« La libre communication des pensées et des opinions est un des droits les plus précieux de l'Homme. »", source: 'Déclaration de 1789, article 11' },
  { id: 'services', nom: 'Services publics', def: "École, hôpital, transports accessibles partout et à tous : c'est le patrimoine de ceux qui n'en ont pas.",
    texte: "« La Nation garantit l'égal accès de l'enfant et de l'adulte à l'instruction, à la formation professionnelle et à la culture. »", source: 'Préambule de la Constitution de 1946, alinéa 13' }
];
const NUANCES_DEFAUT = "LFI me semble aujourd'hui le parti le plus proche de ces valeurs pour 2027, sans attachement particulier : je veux savoir quand LFI a tort.";

const state = {
  base: [],
  valeurs: LS.get('argu.valeurs', null) || VALEURS_DEFAUT.map(v => ({ ...v })),
  nuances: LS.get('argu.nuances', NUANCES_DEFAUT),
  gardees: LS.get('argu.gardees', []),
  atraiter: LS.get('argu.atraiter', []),
  recents: LS.get('argu.recents', []),
  reglages: Object.assign({}, REGLAGES_DEFAUT, LS.get('argu.reglages', {})),
  index: [],
  idf: new Map(),
  themeFiltre: 'tous'
};

const THEMES = {
  economie: 'Économie', immigration: 'Immigration', securite: 'Sécurité', social: 'Social',
  retraites: 'Retraites', ecologie: 'Écologie', 'services-publics': 'Services publics',
  lfi: 'LFI & gauche', votes: 'Votes', valeurs: 'Valeurs & fond', autre: 'Autre'
};
const nomTheme = t => THEMES[t] || 'Autre';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const urlSure = u => /^https?:\/\//i.test(u || '') ? u : '';
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/* ---------- Recherche locale ---------- */
const MOTS_VIDES = new Set(('le la les un une des de du d l et ou a au aux en dans sur veux veut voulez voulais pour par avec sans ce ces cet cette c ca est sont etre ete on il ils elle elles nous vous je j tu te t me m se s y que qui quoi quand comment pourquoi ne n pas plus moins tres trop tout tous toute toutes fait font va vont aller mais donc car si comme leur leurs son sa ses mon ma mes ton ta tes notre nos votre vos lui eux meme deja encore bien alors aussi juste vraiment avoir ont avait ai as sera serait faut peut peuvent dit dire quand meme the oui non hein bah ben enfin genre voila maintenant partout aujourd hui franchement carrement cousin pote mec disent pense crois trouve vois sais tellement chez gars type mere pere oncle tante beau frere soeur coup fait truc machin bref quoi style').split(' '));

function normaliser(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, ' ').replace(/[^a-z0-9%€ ]/g, ' ').replace(/\s+/g, ' ').trim();
}
const SIGLES = new Set(['rn', 'fn', 'ps', 'lr', 'ue', 'pc']);
const IRREGULIERS = { payent: 'pay', paient: 'pay', paie: 'pay', paye: 'pay', payer: 'pay', paies: 'pay', payes: 'pay' };
function racine(m) {
  if (IRREGULIERS[m]) return IRREGULIERS[m];
  const s1 = m.replace(/(ements|ement|ations|ation|atrices|ateurs|ateur|euses|euse|ites|ite|iques|ique|ismes|isme|istes|iste|ables|able)$/, '');
  if (s1.length >= 4) m = s1;
  m = m.replace(/aux$/, 'al');
  const s2 = m.replace(/(aient|ait|ent|ez|ons|er)$/, '');
  if (s2.length >= 4 || (s2.length === 3 && /er$/.test(m))) m = s2;   // taxer → tax, comme taxe / taxé
  m = m.replace(/(es|s|x|e)$/, '');
  return m.slice(0, 7);
}
function mots(s) {
  return normaliser(s).split(' ').filter(m => (m.length > 2 || SIGLES.has(m)) && !MOTS_VIDES.has(m)).map(m => SIGLES.has(m) ? m : racine(m)).filter(m => m.length > 2 || SIGLES.has(m));
}

function indexer() {
  const toutes = [...state.base, ...state.gardees];
  state.index = toutes.map(f => {
    const poids = new Map();
    const ajoute = (texte, w) => mots(texte).forEach(r => poids.set(r, Math.max(poids.get(r) || 0, w)));
    ajoute(f.replique, 0.3);
    ajoute(f.titre, 2);
    (f.variantes || []).forEach(v => ajoute(v, 2));
    (f.motsCles || []).forEach(k => ajoute(k, 3));
    const phrases = [f.titre, ...(f.variantes || [])].map(normaliser).filter(p => p.length > 14 && p.split(' ').length >= 3);
    return { fiche: f, poids, phrases };
  });
  const df = new Map();
  state.index.forEach(e => e.poids.forEach((_, r) => df.set(r, (df.get(r) || 0) + 1)));
  const N = Math.max(state.index.length, 1);
  state.idf = new Map([...df].map(([r, n]) => [r, Math.log(1 + N / n)]));
}

function chercher(texte, n = 5) {
  const q = [...new Set(mots(texte))];
  if (!q.length) return [];
  const N = Math.max(state.index.length, 1);
  const idfInconnu = Math.log(1 + N) * 0.25;
  const tn = normaliser(texte);
  const max = q.reduce((s, r) => s + 3 * (state.idf.get(r) ?? idfInconnu), 0);
  return state.index.map(e => {
    let s = 0;
    for (const r of q) {
      let w = e.poids.get(r) || 0;
      if (!w && r.length >= 4) {
        for (const [k, v] of e.poids) {
          if (k.length >= 4 && (k.startsWith(r) || r.startsWith(k))) { w = Math.max(w, v * 0.6); }
        }
      }
      s += w * (state.idf.get(r) ?? idfInconnu);
    }
    let conf = max ? s / max : 0;
    conf = Math.min(conf, 1);
    if (e.phrases.some(p => p === tn)) conf = 1.1;
    else if (e.phrases.some(p => tn.includes(p) || (tn.length > 12 && p.includes(tn)))) conf = Math.max(conf, 0.95) + 0.03;
    return { fiche: e.fiche, conf };
  }).filter(r => r.conf > 0.08).sort((a, b) => b.conf - a.conf).slice(0, n);
}
const SEUIL_SUR = 0.55;      // hors ligne / sans clé : fiche affichée directement
const SEUIL_DIRECT = 0.85;   // avec Gemini : au-dessus, pas besoin d'aiguillage
const SEUIL_PROCHE = 0.28;   // sans Gemini : fiche la plus proche affichée, signalée « à vérifier »

/* ---------- Gemini ---------- */
function consignes() {
  return `Tu es l'assistant de débat d'un utilisateur qui défend des VALEURS, pas un parti. On lui oppose un argument pendant une discussion ORALE (famille, amis). Nous sommes le ${aujourdhui()}.

Ses valeurs :
${state.valeurs.map(v => `- ${v.nom} : ${v.def}`).join('\n')}
Ce qu'il précise : ${state.nuances}
Juge chaque position, y compris celles de LFI ou de la gauche, à l'aune de ces valeurs et des faits. Quand les faits donnent tort à LFI, dis-le clairement et mets "lfiATort": true. Quand deux de ses valeurs tirent dans des sens opposés (par exemple écologie et personne laissé derrière), dis franchement qu'il y a un dilemme dans "desaccordValeurs" et propose la piste qui sert les deux.

Ta mission : lui donner une réponse FACTUELLE, vérifiée avec la recherche Google, appuyée sur des sources fiables (INSEE, DREES, DARES, Cour des comptes, COR, OFCE, IPP, Banque de France, Eurostat, OCDE, ministères, Assemblée nationale, Sénat, Datan, HowTheyVote.eu, Les Décodeurs, AFP Factuel, CheckNews, études académiques).

Règles :
1. HONNÊTETÉ ABSOLUE. Si l'argument est vrai ou en partie vrai, dis-le dans "ceQuiEstVrai" et recadre au lieu de nier. Si l'argument est solide, la réplique le reconnaît.
2. N'invente aucun chiffre, vote, citation ou URL. Chaque preuve doit venir d'une page trouvée par ta recherche Google dans CETTE réponse, avec son URL copiée exactement. Une citation entre guillemets n'est permise que si la page la reproduit mot pour mot. Sources interdites comme preuve : réseaux sociaux, forums, blogs, sites militants ou partisans (sauf pour citer le programme d'un parti lui-même), Wikipédia. Si tu ne trouves pas de source fiable pour un fait, ne le mets pas. Si tu ne sais pas, dis-le : mieux vaut une réponse courte et sûre qu'une réponse complète et fausse. Utilise les données les plus récentes. Tes réponses seront vérifiées une à une par un second contrôle : tout fait non confirmé sera supprimé.
3. "simple" : UNE phrase de moins de 140 caractères que n'importe qui comprend du premier coup, quels que soient sa culture et son niveau d'études : mots de tous les jours, aucun sigle, au plus un chiffre arrondi prudemment. "replique" : la version précise, 1 à 2 phrases, moins de 280 caractères, dicible à l'oral, ton posé et factuel, sans attaque personnelle, avec les chiffres exacts.
4. Pour un vote : précise la date, le scrutin et le vote du groupe.
5. "enFace" : seulement si l'argument est en partie vrai ET que l'autre camp a fait PIRE sur ce MÊME point, prouvé par des faits sourcés. L'autre camp, c'est la droite au sens large : RN, LR, et la Macronie (gouvernements depuis 2017), ainsi que les politiques sociales-libérales (mandat Hollande : CICE, loi Travail ; positions et votes de Raphaël Glucksmann et de Place publique). Juge-les par leurs ACTES (votes datés, mesures, chiffres), jamais par une étiquette. Si l'autre camp a fait mieux, ou si la comparaison est tirée par les cheveux, mets "enFace": null : la concession reste telle quelle.
6. "question" : une question courte à retourner à l'interlocuteur, qui l'oblige à assumer la conséquence morale de sa position (ex. « Tu trouves juste qu'un milliardaire paie moins, en proportion, qu'une infirmière ? »). Jamais insultante.
8. "arbitrage" : seulement quand l'argument exprime un ras-le-bol ou une envie légitime (trop d'impôts, trop de fonctionnaires, marre des grèves…). {"accueil":"une phrase qui reconnaît que c'est légitime de le ressentir","choix":["2 à 4 renoncements concrets que ça impliquerait, chiffrés et sourcés"]} ; sinon null.
7. "desaccordValeurs" : seulement si le fond du désaccord n'est pas factuel mais moral (liberté contre égalité, mérite, propriété, rôle de l'État…). Dis-le honnêtement : chacun peut avoir raison selon ses valeurs. Puis assume la position de l'utilisateur (le bien commun, la dignité, la justice sociale) en l'ancrant dans des textes que la droite invoque aussi : Déclaration de 1789 (art. 13 : contribution « en raison de leurs facultés »), Préambule de 1946, article 1er de la Constitution (« République sociale »), Déclaration universelle de 1948. Sinon chaîne vide.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de cette forme :
{"titre":"« formulation courte de l'argument »","simple":"...","theme":"economie|immigration|securite|social|retraites|ecologie|services-publics|lfi|votes|valeurs|autre","replique":"...","ceQuiEstVrai":"... ou chaîne vide","preuves":[{"fait":"fait chiffré précis","source":"Organisme, année","url":"https://..."}],"enFace":{"texte":"1 à 2 phrases","preuves":[{"fait":"...","source":"...","url":"https://..."}]} ou null,"question":"...","lfiATort":false,"desaccordValeurs":"... ou chaîne vide","arbitrage":{"accueil":"...","choix":["..."]} ou null,"pourAllerPlusLoin":"3 à 5 phrases","variantes":["3 à 5 autres formulations courantes de l'argument"],"motsCles":["6 à 10 mots simples sans accents"]}`;
}

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
function meilleurModele(liste) {
  const version = id => parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const note = id => version(id) * 10 + (/flash/.test(id) ? 5 : 0) - (/lite/.test(id) ? 3 : 0) - (/preview|exp/.test(id) ? 2 : 0) - (/latest/.test(id) ? 1 : 0);
  return [...liste].sort((a, b) => note(b.id) - note(a.id))[0]?.id || '';
}
async function choisirModele() {
  const l = await listerModeles(); LS.set('argu.modeles', l);
  const m = meilleurModele(l);
  if (!m) throw new Error('Aucun modèle Gemini disponible avec cette clé.');
  state.reglages.modele = m; LS.set('argu.reglages', state.reglages);
  if ($('#modele')) remplirModeles(l);
  return m;
}
// Un seul point d'appel. Modèle retiré : on prend le plus récent disponible.
// Modèle saturé ou quota atteint : on réessaie une fois, puis on passe aux modèles suivants (sans changer le réglage).
const SATURE = /high demand|overloaded|unavailable|try again later|resource.?exhausted|quota/i;
function classement() {
  const l = LS.get('argu.modeles', null) || [];
  const version = id => parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const note = id => version(id) * 10 + (/flash/.test(id) ? 5 : 0) - (/lite/.test(id) ? 3 : 0) - (/preview|exp/.test(id) ? 2 : 0) - (/latest/.test(id) ? 1 : 0) - (/pro/.test(id) ? 20 : 0);
  return l.map(m => m.id).sort((x, y) => note(y) - note(x));
}
async function appelGemini(corps) {
  const r = state.reglages;
  if (!r.modele) await choisirModele();
  const delai = corps.tools ? 60000 : 20000;   // une recherche web peut prendre 30 s ; au-delà, on abandonne ce modèle
  const essai = async m => {
    const stop = new AbortController(), minuteur = setTimeout(() => stop.abort(), delai);
    try {
      const rep = await fetch(`${API}/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': r.cle }, body: JSON.stringify(corps), signal: stop.signal
      });
      return { rep, data: await rep.json().catch(() => ({})) };
    } catch (e) {
      if (e.name !== 'AbortError') throw e;
      return { rep: { ok: false, status: 504 }, data: { error: { message: 'timeout' } } };
    } finally { clearTimeout(minuteur); }
  };
  const signaler = t => state.surAvancement?.(t);
  const retire = x => !x.rep.ok && (x.rep.status === 404 || /no longer available|not found|is not supported|deprecated/i.test(x.data?.error?.message || ''));
  const sature = x => !x.rep.ok && ([429, 500, 503, 504].includes(x.rep.status) || SATURE.test(x.data?.error?.message || '') || x.data?.error?.message === 'timeout');
  let x = await essai(state.reglages.modele);
  if (retire(x)) { await choisirModele(); x = await essai(state.reglages.modele); }
  if (sature(x) && ![429, 504].includes(x.rep.status)) { signaler('Gemini est saturé, je réessaie…'); await new Promise(ok => setTimeout(ok, 1500)); x = await essai(state.reglages.modele); }
  if (sature(x)) {
    if (!LS.get('argu.modeles', null)) { try { LS.set('argu.modeles', await listerModeles()); } catch {} }
    for (const m of classement().filter(m => m !== state.reglages.modele).slice(0, 3)) {
      signaler(`Gemini est saturé, j'essaie ${m}…`);
      const y = await essai(m);
      if (y.rep.ok) return { ...y, modele: m };
      if (!sature(y) && !retire(y)) { x = y; break; }
    }
  }
  const brutGoogle = (x.data?.error?.message || '').replace(/\s+/g, ' ').slice(0, 300);
  if (sature(x)) x.data = { error: { detail: brutGoogle, message: x.rep.status === 504 && x.data?.error?.message === 'timeout'
    ? 'Gemini ne répond pas (réseau lent ou serveurs saturés) : réessaie dans une minute. Tes fiches marchent toujours.'
    : x.rep.status === 429
    ? 'Quota gratuit de Gemini atteint pour l\'instant : réessaie dans une minute. Tes fiches marchent toujours.'
    : 'Gemini est saturé en ce moment (forte demande chez Google) : réessaie dans une minute. Tes fiches marchent toujours.' } };
  return { ...x, modele: state.reglages.modele };
}

async function demanderGemini(argument, proches) {
  const r = state.reglages;
  if (!r.cle) throw new Error('Ajoute ta clé Gemini dans Réglages.');
  if (!navigator.onLine) throw new Error('Pas de réseau : seules les fiches marchent hors ligne.');
  let texte = `Argument entendu : « ${argument} »`;
  if (proches.length) {
    texte += `\n\nFiches proches déjà dans la base (réutilise-les si elles répondent vraiment, sinon ignore-les) :\n` +
      proches.map(p => `- ${p.fiche.titre} → ${p.fiche.replique}`).join('\n');
  }
  const { rep, data } = await appelGemini({
      systemInstruction: { parts: [{ text: consignes() }] },
      contents: [{ role: 'user', parts: [{ text: texte }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3 }
  });
  if (!rep.ok) {
    const msg = (data?.error?.message || `Erreur ${rep.status}`) + (data?.error?.detail && data.error.detail !== 'timeout' ? ` [Google : ${data.error.detail}]` : '');
    if (rep.status === 429 || rep.status === 503) throw new Error(msg);
    if (rep.status === 400 && /API key/i.test(msg)) throw new Error('Clé Gemini refusée : vérifie-la dans Réglages.');
    throw new Error(msg);
  }
  const cand = data.candidates?.[0];
  const brut = (cand?.content?.parts || []).map(p => p.text || '').join('');
  const fiche = extraireJSON(brut);
  if (!fiche || !fiche.replique) throw new Error('Réponse illisible de Gemini, réessaie.');
  const vus = new Set();
  fiche.sourcesWeb = (cand?.groundingMetadata?.groundingChunks || [])
    .map(c => c.web).filter(w => w && w.uri && !vus.has(w.uri) && vus.add(w.uri))
    .map(w => ({ titre: w.title || w.uri, url: w.uri }));
  fiche.origine = 'gemini';
  fiche.verifieLe = aujourdhui();
  fiche.argumentEntendu = argument;
  if (typeof fiche.question !== 'string') fiche.question = '';
  return fiche;
}

/* ---------- Vérification des réponses Gemini ---------- */
const DOMAINES_SURS = ['gouv.fr', 'insee.fr', 'ccomptes.fr', 'senat.fr', 'assemblee-nationale.fr', 'legifrance.gouv.fr', 'vie-publique.fr',
  'conseil-constitutionnel.fr', 'conseil-etat.fr', 'cour-de-cassation.fr', 'banque-france.fr', 'cor-retraites.fr', 'strategie.gouv.fr', 'cae-eco.fr',
  'ofce.sciences-po.fr', 'ipp.eu', 'drees.solidarites-sante.gouv.fr', 'dares.travail-emploi.gouv.fr', 'securite-sociale.fr', 'caf.fr', 'ameli.fr',
  'francetravail.org', 'urssaf.fr', 'rte-france.com', 'ademe.fr', 'citepa.org', 'hautconseilclimat.fr', 'europa.eu', 'oecd.org', 'imf.org',
  'worldbank.org', 'un.org', 'who.int', 'ilo.org', 'ipcc.ch', 'howtheyvote.eu', 'datan.fr', 'nosdeputes.fr', 'elysee.fr',
  'lemonde.fr', 'afp.com', 'liberation.fr', 'mediapart.fr', 'franceinfo.fr', 'radiofrance.fr', 'lesechos.fr', 'alternatives-economiques.fr',
  'cairn.info', 'hal.science', 'persee.fr', 'nber.org', 'inegalites.fr', 'oxfamfrance.org', 'transparency-france.org'];
const domaine = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const estSur = u => { const d = domaine(u); return !!d && DOMAINES_SURS.some(x => d === x || d.endsWith('.' + x)); };

async function verifierGemini(fiche) {
  const r = state.reglages;
  const numerotees = (fiche.preuves || []).map((p, i) => `${i + 1}. ${p.fait} (source annoncée : ${p.source || '?'}, ${p.url || 'sans lien'})`).join('\n');
  const consigne = `Tu es un vérificateur de faits très strict. Une autre IA a produit cette réponse pour un débat. Ton travail : ne laisser passer QUE ce qui est sûr.

Phrase simple proposée : ${fiche.simple || '(vide)'}
Réplique proposée : ${fiche.replique}
Ce qui est vrai en face : ${fiche.ceQuiEstVrai || '(vide)'}
Bloc « en face c'est pire » : ${fiche.enFace?.texte || '(vide)'}
Preuves :
${numerotees || '(aucune)'}

Pour CHAQUE preuve, fais ta propre recherche Google, en priorité sur la source annoncée, puis sur une seconde source indépendante fiable (organisme public, institution, étude, média reconnu ; jamais réseaux sociaux, forums, blogs ou Wikipédia).
- "confirme" : une source fiable que tu as trouvée dit la même chose, avec les mêmes chiffres et la même date.
- "inexact" : une source fiable dit autre chose (chiffre, date, auteur, vote).
- "introuvable" : tu n'as rien trouvé de fiable. Dans le doute, c'est "introuvable".
Ensuite :
- réécris la réplique (1 à 2 phrases, moins de 280 caractères, ton posé) en n'utilisant QUE des faits confirmés ; si rien n'est confirmé, mets "".
- réécris "simple" : une phrase de moins de 140 caractères, compréhensible par n'importe qui, tirée uniquement des faits confirmés (ou "" si rien n'est confirmé).
- garde "ceQuiEstVrai" en retirant tout ce qui n'est pas confirmé.
- garde "enFace" seulement si son contenu est confirmé, sinon null.
Réponds UNIQUEMENT par ce JSON :
{"preuves":[{"n":1,"verdict":"confirme|inexact|introuvable","note":"courte explication","source2":"organisme, document, date de la source qui confirme","url2":"https://..."}],"simple":"...","replique":"...","ceQuiEstVrai":"...","enFace":{"texte":"...","preuves":[]} ou null}`;
  const { rep, data } = await appelGemini({ contents: [{ role: 'user', parts: [{ text: consigne }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } });
  if (!rep.ok) {
    if ([429, 500, 503, 504].includes(rep.status)) throw new Error(`Pendant la vérification : ${data?.error?.message || 'Gemini indisponible'} Rien n'est affiché tant que ce n'est pas vérifié.`);
    throw new Error('La vérification a échoué : rien n\'est affiché tant que ce n\'est pas vérifié.');
  }
  const v = extraireJSON((data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''));
  if (!v || !Array.isArray(v.preuves)) throw new Error('Vérification illisible : rien n\'est affiché tant que ce n\'est pas vérifié.');
  const verdicts = new Map(v.preuves.map(x => [Number(x.n), x]));
  const gardees = [], ecartees = [];
  (fiche.preuves || []).forEach((p, i) => {
    const x = verdicts.get(i + 1);
    if (x && x.verdict === 'confirme') {
      const u2 = urlSure(x.url2);
      gardees.push({ ...p, recoupe: { source: x.source2 || '', url: u2 }, officielle: estSur(p.url) || estSur(u2) });
    } else ecartees.push({ fait: p.fait, verdict: x?.verdict || 'introuvable', note: x?.note || '' });
  });
  return {
    ...fiche,
    replique: (v.replique || '').trim(),
    simple: (v.simple || '').trim(),
    ceQuiEstVrai: v.ceQuiEstVrai || '',
    enFace: v.enFace && v.enFace.texte ? v.enFace : null,
    preuves: gardees,
    ecartees,
    verifiee: true
  };
}

async function aiguiller(argument, candidats) {
  const r = state.reglages;
  const liste = candidats.map((c, i) => `${i + 1}. ${c.fiche.titre}`).join('\n');
  const { rep, data } = await appelGemini({
      contents: [{ role: 'user', parts: [{ text: `Dans un débat, quelqu'un dit : « ${argument} »\n\nVoici des fiches de réponse :\n${liste}\n\nQuelle fiche répond DIRECTEMENT à cet argument précis (même idée, pas juste le même sujet) ? Réponds uniquement par son numéro, ou 0 si aucune ne convient.` }] }],
      generationConfig: { temperature: 0 }
  });
  if (!rep.ok) return null;
  const t = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  const n = parseInt((t.match(/\d+/) || ['0'])[0], 10);
  return n >= 1 && n <= candidats.length ? candidats[n - 1] : 0;
}

function extraireJSON(t) {
  if (!t) return null;
  t = t.replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

async function listerModeles() {
  const r = state.reglages;
  if (!r.cle) throw new Error('Colle d\'abord ta clé.');
  const rep = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': r.cle } });
  const data = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(data?.error?.message || `Erreur ${rep.status}`);
  return (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/.test(m.name) && !/embedding|tts|image|audio|live/.test(m.name))
    .map(m => ({ id: m.name.replace('models/', ''), nom: m.displayName || m.name }));
}

/* ---------- Rendu d'une carte ---------- */
function blocArbitrage(a) {
  if (!a || !a.accueil || !(a.choix || []).length) return '';
  return `<div class="arbitrage"><strong>Tu as le droit de le penser. Mais…</strong><p>${esc(a.accueil)}</p><ul>${a.choix.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
}

function blocEnFace(e) {
  if (!e || !e.texte) return '';
  const src = (e.preuves || []).map(p => {
    const u = urlSure(p.url);
    return `<li>${esc(p.fait)}<span class="src">${esc(p.source || '')}${u ? ` · <a href="${esc(u)}" target="_blank" rel="noopener">lien</a>` : ''}</span></li>`;
  }).join('');
  return `<div class="en-face"><strong>Oui, mais en face c'est pire</strong><p>${esc(e.texte)}</p>${src ? `<ul>${src}</ul>` : ''}</div>`;
}

function carte(f, { autres = [], question = '', approx = false } = {}) {
  const origine = f.origine === 'gemini' ? (state.gardees.some(g => g.id === f.id) ? 'gardee' : 'gemini') : 'fiche';
  const badge = origine === 'fiche' ? `<span class="badge fiche">Fiche · ${esc(nomTheme(f.theme))}</span>`
    : origine === 'gardee' ? `<span class="badge gardee">Gardée · à vérifier</span>`
    : `<span class="badge gemini">Gemini · ${f.verifiee ? 'faits recoupés' : 'non vérifié'}</span>`;
  const preuves = (f.preuves || []).map(p => {
    const u = urlSure(p.url);
    const rc = p.recoupe ? `<span class="src recoupe">Recoupé : ${esc(p.recoupe.source || 'seconde source')}${urlSure(p.recoupe.url) ? ` · <a href="${esc(p.recoupe.url)}" target="_blank" rel="noopener">lien</a>` : ''}${p.officielle ? '' : ' · source non officielle, à garder prudent'}</span>` : '';
    return `<li>${esc(p.fait)}<span class="src">${esc(p.source || '')}${u ? ` · <a href="${esc(u)}" target="_blank" rel="noopener">lien</a>` : ''}</span>${rc}</li>`;
  }).join('');
  const ecartees = (f.ecartees || []).length ? `<p class="fragile"><strong>Écarté par la vérification :</strong> ${f.ecartees.length} fait(s) non confirmé(s), retiré(s) de la réponse.</p>` : '';
  const web = (f.sourcesWeb || []).filter(s => urlSure(s.url)).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a></li>`).join('');
  const nbPreuves = (f.preuves || []).length;

  const el = document.createElement('div');
  el.innerHTML = `
  <article class="carte">
    <div class="carte-tete">${badge}${f.desaccordValeurs ? '<span class="badge valeurs">Désaccord de valeurs</span>' : ''}${f.lfiATort ? '<span class="badge lfi-tort">Là, LFI a tort</span>' : ''}${approx ? '<span class="approx">Fiche la plus proche</span>' : ''}</div>
    ${f.titre ? `<h2 class="titre-arg">${esc(f.titre)}</h2>` : ''}
    ${f.simple ? `<p class="replique">${esc(f.simple)}</p><div class="precis"><strong>Plus précis</strong><p>${esc(f.replique)}</p></div>` : `<p class="replique">${esc(f.replique)}</p>`}
    ${f.question ? `<div class="question"><strong>Retourne-lui la question</strong><p>${esc(f.question)}</p></div>` : ''}
    ${(() => {
      const blocs = [
        ['vrai', 'Ce qui est vrai en face', f.ceQuiEstVrai ? `<div class="nuance"><strong>Ce qui est vrai en face</strong>${esc(f.ceQuiEstVrai)}</div>` : ''],
        ['pire', 'Mais en face, c\'est pire', blocEnFace(f.enFace)],
        ['fond', 'Sur le fond', f.desaccordValeurs ? `<div class="fond"><strong>Sur le fond, c'est une question de valeurs</strong>${esc(f.desaccordValeurs)}</div>` : ''],
        ['arbitrage', 'Tu renoncerais à quoi ?', blocArbitrage(f.arbitrage)]
      ].filter(x => x[2]);
      if (!blocs.length) return '';
      return `<div class="puces bascules">${blocs.map(([k, l]) => `<button class="puce" data-bascule="${k}" aria-expanded="false">${l}</button>`).join('')}</div>`
        + blocs.map(([k, , h]) => `<div class="bloc-bascule" data-bloc="${k}" hidden>${h}</div>`).join('');
    })()}
    <button class="btn-preuves" aria-expanded="false">Preuves${nbPreuves ? ` (${nbPreuves})` : ''}</button>
    <div class="preuves" hidden>
      ${preuves ? `<ol>${preuves}</ol>` : ''}
      ${f.pourAllerPlusLoin ? `<p class="plus-loin">${esc(f.pourAllerPlusLoin)}</p>` : ''}
      ${web ? `<div class="sources-web">Sources consultées par Gemini :<ul>${web}</ul></div>` : ''}
      ${ecartees}
      ${f.fragile ? `<p class="fragile"><strong>À recouper :</strong> ${esc(f.fragile)}</p>` : ''}
      ${f.verifieLe ? `<p class="date-verif">Vérifié le ${esc(f.verifieLe.split('-').reverse().join('/'))}</p>` : ''}
    </div>
    <div class="carte-actions">
      <button class="btn-second" data-act="copier">Copier</button>
      ${origine === 'fiche' && question ? `<button class="btn-second" data-act="gemini">Demander à Gemini</button>` : ''}
      ${origine === 'gemini' ? `<button class="btn-principal" data-act="garder">Garder en fiche</button>` : ''}
      ${question ? `<button class="btn-second" data-act="noter">À traiter</button>` : ''}
      ${(() => { const s = chercherSujets((question || '') + ' ' + (f.titre || ''))[0]; return s ? `<button class="btn-second" data-act="comparer" data-sujet="${esc(s.sujet.id)}">Comparer les partis</button>` : ''; })()}
    </div>
  </article>
  ${autres.length ? `<div class="autres"><p>Ça ressemble aussi à :</p><div class="puces">${autres.map((a, i) => `<button class="puce" data-autre="${i}">${esc(a.fiche.titre)}</button>`).join('')}</div></div>` : ''}`;

  el.querySelector('.btn-preuves').onclick = e => {
    const zone = el.querySelector('.preuves');
    zone.hidden = !zone.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!zone.hidden));
    e.currentTarget.textContent = zone.hidden ? `Preuves${nbPreuves ? ` (${nbPreuves})` : ''}` : 'Masquer les preuves';
  };
  el.querySelectorAll('[data-bascule]').forEach(b => b.onclick = () => {
    const z = el.querySelector(`[data-bloc="${b.dataset.bascule}"]`);
    z.hidden = !z.hidden; b.classList.toggle('actif', !z.hidden); b.setAttribute('aria-expanded', String(!z.hidden));
  });
  el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const act = b.dataset.act;
    if (act === 'copier') copier(texteFiche(f), b);
    if (act === 'gemini') lancerGemini(question, []);
    if (act === 'garder') { garder(f); b.textContent = 'Gardée ✓'; b.disabled = true; }
    if (act === 'comparer') ouvrirComparateur(b.dataset.sujet);
    if (act === 'noter') { noterATraiter(question, 'Noté à la main : la réponse ne convient pas', f.titre ? `Fiche montrée : ${f.titre}` : ''); b.textContent = 'Noté ✓'; b.disabled = true; }
  });
  el.querySelectorAll('[data-autre]').forEach(b => b.onclick = () => {
    const a = autres[+b.dataset.autre];
    afficher(carte(a.fiche, { autres: autres.filter(x => x !== a), question }));
  });
  return el;
}

function texteFiche(f) {
  let t = f.simple ? `${f.simple}\n\n${f.replique}` : f.replique;
  (f.preuves || []).forEach(p => { t += `\n• ${p.fait} (${p.source || ''}${p.url ? ' ' + p.url : ''})`; });
  return t;
}
async function copier(texte, bouton) {
  try { await navigator.clipboard.writeText(texte); if (bouton) { const t = bouton.textContent; bouton.textContent = 'Copié ✓'; setTimeout(() => bouton.textContent = t, 1500); } }
  catch { prompt('Copie ce texte :', texte); }
}

function afficher(noeud) {
  const z = $('#resultat');
  z.replaceChildren(noeud);
  z.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function message(texte, classe = '') {
  const d = document.createElement('div');
  d.className = `message ${classe}`;
  d.innerHTML = texte;
  return d;
}

/* ---------- Flux principal ---------- */
async function repondre(texte) {
  texte = texte.trim();
  if (!texte) return;
  ajouterRecent(texte);
  const res = chercher(texte, 8);
  const meilleur = res[0];
  const geminiDispo = state.reglages.autoGemini && state.reglages.cle && navigator.onLine;
  const montrer = (choix) => afficher(carte(choix.fiche, { autres: res.filter(r => r !== choix && r.conf >= 0.42).slice(0, 3), question: texte }));

  if (meilleur && meilleur.conf >= (geminiDispo ? SEUIL_DIRECT : SEUIL_SUR)) return montrer(meilleur);

  if (geminiDispo) {
    if (res.length) {
      afficher(message('<span class="chargement">Je cherche la bonne fiche…</span>'));
      let choix = null;
      try { choix = await aiguiller(texte, res); } catch { choix = null; }
      if (choix) return montrer(choix);
      if (choix === null && meilleur.conf >= SEUIL_SUR) return montrer(meilleur);
    }
    return lancerGemini(texte, res.slice(0, 3));
  }
  if (meilleur && meilleur.conf >= SEUIL_PROCHE) {
    const autres = res.filter(r => r !== meilleur && r.conf >= meilleur.conf * 0.6).slice(0, 3);
    return afficher(carte(meilleur.fiche, { autres, question: texte, approx: true }));
  }
  const d = document.createElement('div');
  const raison = !state.reglages.cle ? 'Ajoute ta clé Gemini dans Réglages pour couvrir les trous.'
    : !navigator.onLine ? 'Pas de réseau pour demander à Gemini.' : '';
  noterATraiter(texte, 'Aucune fiche ne correspond' + (raison ? ' (sans Gemini)' : ''));
  d.append(message(`Aucune fiche ne correspond vraiment. ${esc(raison)} Noté dans « À traiter ».`));
  if (state.reglages.cle && navigator.onLine) {
    const b = document.createElement('button');
    b.className = 'btn-principal'; b.style.marginTop = '10px'; b.style.width = '100%';
    b.textContent = 'Demander à Gemini'; b.onclick = () => lancerGemini(texte, res.slice(0, 3));
    d.append(b);
  }
  if (res.length) {
    const wrap = document.createElement('div');
    wrap.className = 'autres';
    wrap.innerHTML = `<p>Fiches les plus proches :</p><div class="puces">${res.slice(0, 4).map((r, i) => `<button class="puce" data-i="${i}">${esc(r.fiche.titre)}</button>`).join('')}</div>`;
    wrap.querySelectorAll('[data-i]').forEach(b => b.onclick = () => afficher(carte(res[+b.dataset.i].fiche, { question: texte })));
    d.append(wrap);
  }
  afficher(d);
}

async function lancerGemini(texte, proches) {
  afficher(message('<span class="chargement">Gemini cherche des sources…</span>'));
  state.surAvancement = t => afficher(message(`<span class="chargement">${esc(t)}</span>`));
  try {
    const brut = await demanderGemini(texte, proches);
    afficher(message('<span class="chargement">Vérification des faits, un par un…</span>'));
    const f = await verifierGemini(brut);
    if (!f.replique || !f.preuves.length) {
      noterATraiter(texte, 'Gemini : rien de sûr trouvé', f.ecartees.map(x => `${x.verdict} : ${x.fait}`).join(' | '));
      const d = message(`Gemini n'a rien trouvé de sûr sur ce point${f.ecartees.length ? ` : ${f.ecartees.length} fait(s) écarté(s) à la vérification` : ''}. Mieux vaut ne pas avancer de chiffre. Noté dans « À traiter ».`);
      return afficher(d);
    }
    f.id = 'g-' + Date.now();
    afficher(carte(f, { autres: proches.filter(p => p.conf >= 0.15), question: texte }));
  } catch (e) {
    noterATraiter(texte, 'Gemini indisponible', e.message);
    const d = message(esc(e.message) + ' Noté dans « À traiter ».', 'erreur');
    afficher(d);
  } finally { state.surAvancement = null; }
}

/* ---------- Récents ---------- */
function ajouterRecent(t) {
  state.recents = [t, ...state.recents.filter(x => x !== t)].slice(0, 12);
  LS.set('argu.recents', state.recents);
  rendreRecents();
}
function rendreRecents() {
  const z = $('#recents');
  if (!state.recents.length) { z.innerHTML = ''; return; }
  z.innerHTML = `<h2>Récents</h2><div class="puces">${state.recents.map((r, i) => `<button class="puce" data-i="${i}">${esc(r.length > 60 ? r.slice(0, 58) + '…' : r)}</button>`).join('')}</div>`;
  z.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const t = state.recents[+b.dataset.i]; $('#argument').value = t; repondre(t); });
}

/* ---------- Gardées ---------- */
function garder(f) {
  const copie = { ...f, origine: 'gemini' };
  if (!copie.theme || !THEMES[copie.theme]) copie.theme = 'autre';
  state.gardees = [copie, ...state.gardees.filter(g => g.id !== copie.id)];
  LS.set('argu.gardees', state.gardees);
  indexer(); rendreGardees(); majEtat();
}
function rendreGardees() {
  const ul = $('#liste-gardees');
  if (!state.gardees.length) { ul.innerHTML = '<li class="message" style="cursor:default">Rien de gardé pour l\'instant.</li>'; return; }
  ul.innerHTML = state.gardees.map((g, i) => `<li data-i="${i}"><div class="l-titre">${esc(g.titre || g.argumentEntendu || '')}</div><div class="l-sous">${esc(g.replique)}</div><div class="l-actions"><button class="btn-lien" data-suppr="${i}">Supprimer</button></div></li>`).join('');
  ul.querySelectorAll('li[data-i]').forEach(li => li.onclick = e => {
    if (e.target.dataset.suppr !== undefined) {
      e.stopPropagation();
      const b = e.target;
      if (b.dataset.confirme) {
        state.gardees.splice(+b.dataset.suppr, 1); LS.set('argu.gardees', state.gardees); indexer(); rendreGardees(); majEtat();
      } else { b.dataset.confirme = '1'; b.textContent = 'Confirmer la suppression'; }
      return;
    }
    montrerVue('repondre');
    afficher(carte(state.gardees[+li.dataset.i]));
  });
}
/* ---------- À traiter ---------- */
function noterATraiter(texte, raison, detail = '') {
  texte = String(texte || '').trim(); if (!texte) return;
  const ex = state.atraiter.find(x => x.texte === texte);
  if (ex) { ex.raison = raison; ex.detail = detail; ex.date = aujourdhui(); }
  else state.atraiter.unshift({ texte, raison, detail, date: aujourdhui() });
  LS.set('argu.atraiter', state.atraiter);
}
function rendreATraiter() {
  const ul = $('#liste-atraiter');
  $('#compte-atraiter').textContent = state.atraiter.length ? `(${state.atraiter.length})` : '';
  if (!state.atraiter.length) { ul.innerHTML = '<li class="message" style="cursor:default">Rien en attente.</li>'; return; }
  ul.innerHTML = state.atraiter.map((x, i) => `<li><div class="l-titre">${esc(x.texte)}</div><div class="l-sous">${esc(x.raison)} · ${esc(x.date.split('-').reverse().join('/'))}</div><div class="l-actions"><button class="btn-lien" data-reessayer="${i}">Réessayer</button><button class="btn-lien" data-suppr-t="${i}">Supprimer</button></div></li>`).join('');
  ul.querySelectorAll('[data-reessayer]').forEach(b => b.onclick = () => { const t = state.atraiter[+b.dataset.reessayer].texte; montrerVue('repondre'); $('#argument').value = t; repondre(t); });
  ul.querySelectorAll('[data-suppr-t]').forEach(b => b.onclick = () => {
    if (b.dataset.confirme) { state.atraiter.splice(+b.dataset.supprT, 1); LS.set('argu.atraiter', state.atraiter); rendreATraiter(); }
    else { b.dataset.confirme = '1'; b.textContent = 'Confirmer la suppression'; }
  });
}

async function exporter() {
  const json = JSON.stringify({ app: 'Réplique', exporteLe: aujourdhui(), aTraiter: state.atraiter, gardees: state.gardees }, null, 2);
  if (navigator.share) {
    try { await navigator.share({ title: 'Carnet Réplique : à traiter et fiches gardées', text: json }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(json); $('#retour-reglages').textContent = ''; alerteGardees('Copié dans le presse-papiers.'); return; } catch {}
  $('#zone-echange').hidden = false; $('#texte-echange').value = json; $('#btn-valider-import').hidden = true;
}
function alerteGardees(t) {
  const p = document.createElement('p'); p.className = 'aide'; p.textContent = t;
  $('#liste-gardees').before(p); setTimeout(() => p.remove(), 2500);
}
function importer() {
  try {
    const d = JSON.parse($('#texte-echange').value);
    const arr = Array.isArray(d) ? d : (d.gardees || []);
    if (!Array.isArray(arr)) throw 0;
    if (!Array.isArray(d) && Array.isArray(d.aTraiter)) {
      d.aTraiter.forEach(x => x && x.texte && !state.atraiter.some(y => y.texte === x.texte) && state.atraiter.push(x));
      LS.set('argu.atraiter', state.atraiter); rendreATraiter();
    }
    const ids = new Set(state.gardees.map(g => g.id));
    arr.filter(f => f && f.replique && !ids.has(f.id)).forEach(f => state.gardees.push({ ...f, id: f.id || 'g-' + Date.now() + Math.random(), origine: 'gemini' }));
    LS.set('argu.gardees', state.gardees); indexer(); rendreGardees(); majEtat();
    $('#zone-echange').hidden = true;
  } catch { alerteGardees('Texte illisible : colle un export de Réplique.'); }
}

/* ---------- Fiches ---------- */
function rendreFiltres() {
  const presents = [...new Set(state.base.map(f => f.theme))].filter(Boolean);
  const ordre = Object.keys(THEMES).filter(t => presents.includes(t));
  $('#filtres-themes').innerHTML = ['tous', ...ordre].map(t => `<button class="puce ${t === state.themeFiltre ? 'actif' : ''}" data-t="${t}">${t === 'tous' ? 'Tout' : esc(nomTheme(t))}</button>`).join('');
  $('#filtres-themes').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { state.themeFiltre = b.dataset.t; rendreFiltres(); rendreFiches(); });
}
function rendreFiches() {
  const q = $('#recherche-fiches').value.trim();
  let liste;
  if (q) liste = chercher(q, 40).map(r => r.fiche).filter(f => f.origine !== 'gemini');
  else liste = state.base;
  if (state.themeFiltre !== 'tous') liste = liste.filter(f => f.theme === state.themeFiltre);
  $('#compte-fiches').textContent = `${liste.length} fiche${liste.length > 1 ? 's' : ''}`;
  $('#liste-fiches').innerHTML = liste.map(f => `<li data-id="${esc(f.id)}"><div class="l-titre">${esc(f.titre)}</div><div class="l-sous">${esc(f.replique)}</div></li>`).join('');
  $('#liste-fiches').querySelectorAll('li').forEach(li => li.onclick = () => {
    const f = state.base.find(x => x.id === li.dataset.id);
    montrerVue('repondre');
    afficher(carte(f));
  });
}

/* ---------- Dictée ---------- */
function initMicro() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('#btn-micro');
  if (!SR) { btn.onclick = () => afficher(message('La dictée n\'est pas disponible ici. Sur Android, ouvre l\'appli dans Chrome (en HTTPS), ou utilise le micro de ton clavier.')); return; }
  const rec = new SR();
  rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let actif = false, base = '';
  const stop = () => { actif = false; btn.classList.remove('ecoute'); $('#micro-texte').textContent = 'Dicter'; };
  rec.onresult = e => {
    let t = '';
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    $('#argument').value = (base ? base + ' ' : '') + t;
  };
  rec.onerror = e => {
    stop();
    if (e.error === 'not-allowed') afficher(message('Micro refusé : autorise-le dans les réglages du navigateur.', 'erreur'));
    else if (e.error !== 'no-speech' && e.error !== 'aborted') afficher(message(`Dictée interrompue (${esc(e.error)}).`, 'erreur'));
  };
  rec.onend = () => {
    const etaitActif = actif; stop();
    if (etaitActif && state.reglages.autoEnvoi && $('#argument').value.trim()) repondre($('#argument').value);
  };
  btn.onclick = () => {
    if (actif) { rec.stop(); return; }
    base = ''; $('#argument').value = '';
    try { rec.start(); actif = true; btn.classList.add('ecoute'); $('#micro-texte').textContent = 'J\'écoute…'; }
    catch { stop(); }
  };
}

/* ---------- Réglages ---------- */
function remplirModeles(liste) {
  const sel = $('#modele');
  const courant = state.reglages.modele;
  const ids = [...(liste || [])];
  if (courant && !ids.some(m => m.id === courant)) ids.unshift({ id: courant, nom: courant });
  ids.unshift({ id: '', nom: 'Automatique (le plus récent)' });
  sel.innerHTML = ids.map(m => `<option value="${esc(m.id)}">${esc(m.nom)}${m.id && m.nom !== m.id ? ` (${esc(m.id)})` : ''}</option>`).join('');
  sel.value = courant;
}
function initReglages() {
  $('#cle').value = state.reglages.cle;
  $('#auto-gemini').checked = state.reglages.autoGemini;
  $('#auto-envoi').checked = state.reglages.autoEnvoi;
  remplirModeles(LS.get('argu.modeles', null));
  const lire = () => {
    state.reglages = { cle: $('#cle').value.trim(), modele: $('#modele').value || state.reglages.modele || '', autoGemini: $('#auto-gemini').checked, autoEnvoi: $('#auto-envoi').checked };
    LS.set('argu.reglages', state.reglages); majEtat();
  };
  $('#form-reglages').onsubmit = e => { e.preventDefault(); lire(); $('#retour-reglages').textContent = 'Enregistré.'; };
  $('#btn-modeles').onclick = async () => {
    lire(); $('#retour-reglages').textContent = 'Chargement des modèles…';
    try { const l = await listerModeles(); LS.set('argu.modeles', l); remplirModeles(l); $('#retour-reglages').textContent = `${l.length} modèles disponibles.`; }
    catch (e) { $('#retour-reglages').textContent = e.message; }
  };
  $('#btn-tester').onclick = async () => {
    lire(); $('#retour-reglages').textContent = 'Test en cours…';
    state.surAvancement = t => { $('#retour-reglages').textContent = t; };
    try {
      const { rep, data: d, modele } = await appelGemini({ contents: [{ parts: [{ text: 'Réponds juste OK.' }] }] });
      $('#retour-reglages').textContent = rep.ok ? `La clé marche ✓ (${modele})` : (d?.error?.message || `Erreur ${rep.status}`) + (d?.error?.detail ? ` [Google : ${d.error.detail}]` : '');
    } catch (e) { $('#retour-reglages').textContent = e.message; }
    finally { state.surAvancement = null; }
  };
}

/* ---------- Navigation ---------- */
function montrerVue(v) {
  document.querySelectorAll('.vue').forEach(s => s.hidden = s.id !== `vue-${v}`);
  document.querySelectorAll('#onglets button').forEach(b => b.classList.toggle('actif', b.dataset.vue === v));
  if (v === 'fiches') rendreFiches();
  if (v === 'gardees') { rendreGardees(); rendreATraiter(); }
  if (v === 'valeurs') rendreValeurs();
  if (v === 'programmes') rendreProgrammes();
  window.scrollTo(0, 0);
}
function majEtat() {
  $('#etat').textContent = `${state.base.length} fiches${state.gardees.length ? ` + ${state.gardees.length} gardées` : ''}${state.reglages.cle ? ' · Gemini' : ''}`;
}

/* ---------- Onglet 2027 : comparateur des programmes ---------- */
const POSITIONS = { pour: 'Pour', contre: 'Contre', nuance: 'Nuancé', inconnu: 'Pas de position trouvée' };
function chercherSujets(texte) {
  const q = [...new Set(mots(texte))];
  if (!q.length || !state.comparateur) return [];
  return state.comparateur.sujets.map(s => {
    const champ = new Set(mots([s.titre, s.question, ...(s.motsCles || [])].join(' ')));
    const titre = new Set(mots(s.titre));
    const corps = new Set(mots(Object.values(s.partis).map(p => p.resume + ' ' + (p.mesures || []).join(' ')).join(' ')));
    let sc = 0;
    q.forEach(r => { if (titre.has(r)) sc += 1;
      if (champ.has(r)) sc += 3; else if ([...champ].some(k => k.length >= 4 && (k.startsWith(r) || r.startsWith(k)))) sc += 1.5; else if (corps.has(r)) sc += 0.5; });
    return { sujet: s, score: sc / q.length };
  }).filter(x => x.score >= 0.6).sort((a, b) => b.score - a.score);
}
function rendreProgrammes() {
  const c = state.comparateur, z = $('#zone-programmes');
  if (!c || !c.sujets.length) { z.innerHTML = '<p class="message">Le comparateur se remplit : les recherches sur les programmes sont en cours.</p>'; $('#sujets-programmes').innerHTML = ''; return; }
  $('#sujets-programmes').innerHTML = c.sujets.map(s => `<button class="puce ${state.sujetActif === s.id ? 'actif' : ''}" data-s="${s.id}">${esc(s.titre)}</button>`).join('');
  $('#sujets-programmes').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { state.sujetActif = b.dataset.s; rendreProgrammes(); });
  const s = c.sujets.find(x => x.id === state.sujetActif);
  if (!s) { z.innerHTML = `<p class="aide">Tape un sujet ou choisis-en un. Version du ${esc(c.version.split('-').reverse().join('/'))}.</p>`; return; }
  z.innerHTML = `<h2 class="titre-sujet">${esc(s.titre)}</h2><p class="aide">${esc(s.question || '')}</p>` +
    Object.keys(c.partis).map(k => {
      const p = s.partis[k] || { position: 'inconnu', resume: '' };
      const src = (p.sources || []).filter(x => urlSure(x.url)).map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.source || x.url)}</a></li>`).join('');
      return `<article class="parti pos-${esc(p.position)}">
        <button class="parti-tete" aria-expanded="false"><span class="parti-nom">${esc(c.partis[k])}</span><span class="pos">${esc(POSITIONS[p.position] || p.position)}</span></button>
        <p class="parti-resume">${esc(p.resume || '')}</p>
        <div class="parti-detail" hidden>
          ${(p.mesures || []).length ? `<ul>${p.mesures.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
          ${p.vote ? `<p class="parti-vote"><strong>Ce qu'il a voté :</strong> ${esc(p.vote.fait)}<span class="src">${esc(p.vote.source || '')}${urlSure(p.vote.url) ? ` · <a href="${esc(p.vote.url)}" target="_blank" rel="noopener">lien</a>` : ''}</span></p>` : ''}
          ${p.ecart ? `<p class="parti-ecart"><strong>Promesse et vote ne collent pas :</strong> ${esc(p.ecart)}</p>` : ''}
          ${src ? `<div class="sources-web">Sources :<ul>${src}</ul></div>` : ''}
        </div>
      </article>`;
    }).join('') + (s.fragile ? `<p class="fragile"><strong>À recouper :</strong> ${esc(s.fragile)}</p>` : '') +
    `<p class="date-verif">Vérifié le ${esc((s.verifieLe || '').split('-').reverse().join('/'))}. Les programmes 2027 ne sont pas tous publiés : les positions viennent aussi des programmes 2022 et 2024 et des votes.</p>`;
  z.querySelectorAll('.parti-tete').forEach(b => b.onclick = () => {
    const d = b.parentElement.querySelector('.parti-detail'); d.hidden = !d.hidden; b.setAttribute('aria-expanded', String(!d.hidden));
  });
}
function initProgrammes() {
  $('#recherche-programmes').oninput = e => {
    const r = chercherSujets(e.target.value);
    if (r.length) { state.sujetActif = r[0].sujet.id; rendreProgrammes(); }
  };
}
function ouvrirComparateur(id) { state.sujetActif = id; montrerVue('programmes'); }

/* ---------- Onglet Mes valeurs ---------- */
function rendreValeurs() {
  const z = $('#liste-valeurs');
  z.innerHTML = state.valeurs.map((v, i) => `
    <li class="valeur">
      <div class="v-nom">${esc(v.nom)}</div>
      <p class="v-def" data-i="${i}">${esc(v.def)}</p>
      ${v.texte ? `<p class="v-texte">${esc(v.texte)}<span class="src">${esc(v.source || '')}</span></p>` : ''}
      <button class="btn-lien" data-edit="${i}">Modifier</button>
    </li>`).join('');
  z.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const i = +b.dataset.edit, p = z.querySelector(`.v-def[data-i="${i}"]`);
    if (b.textContent === 'Modifier') {
      p.innerHTML = `<textarea class="champ" rows="3">${esc(state.valeurs[i].def)}</textarea>`; b.textContent = 'Enregistrer';
    } else {
      state.valeurs[i].def = p.querySelector('textarea').value.trim() || state.valeurs[i].def;
      LS.set('argu.valeurs', state.valeurs); rendreValeurs();
    }
  });
  const n = $('#nuances');
  if (document.activeElement !== n) n.value = state.nuances;
}
function initValeurs() {
  $('#btn-nuances').onclick = () => { state.nuances = $('#nuances').value.trim(); LS.set('argu.nuances', state.nuances); $('#retour-nuances').textContent = 'Enregistré.'; };
  $('#btn-valeurs-defaut').onclick = () => {
    const b = $('#btn-valeurs-defaut');
    if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Confirmer la remise à zéro'; return; }
    state.valeurs = VALEURS_DEFAUT.map(v => ({ ...v })); state.nuances = NUANCES_DEFAUT;
    LS.set('argu.valeurs', state.valeurs); LS.set('argu.nuances', state.nuances);
    b.dataset.ok = ''; b.textContent = 'Revenir aux valeurs de départ'; rendreValeurs();
  };
}

/* ---------- Démarrage ---------- */
async function demarrer() {
  try {
    const r = await fetch('data/fiches.json', { cache: 'no-cache' });
    const d = await r.json();
    state.base = Array.isArray(d) ? d : (d.fiches || []);
    if (d.version) $('#version-base').textContent = `Base de fiches : version du ${d.version}.`;
  } catch { state.base = []; }
  try { state.comparateur = await (await fetch('data/comparateur.json', { cache: 'no-cache' })).json(); } catch { state.comparateur = null; }
  indexer(); majEtat(); rendreFiltres(); rendreRecents(); initMicro(); initReglages(); initValeurs(); initProgrammes();
  document.querySelectorAll('#onglets button').forEach(b => b.onclick = () => montrerVue(b.dataset.vue));
  $('#form-saisie').onsubmit = e => { e.preventDefault(); repondre($('#argument').value); };
  $('#argument').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); repondre($('#argument').value); } });
  $('#recherche-fiches').oninput = rendreFiches;
  $('#btn-exporter').onclick = exporter;
  $('#btn-noter').onclick = () => { const t = $('#texte-noter').value.trim(); if (!t) return; noterATraiter(t, 'Noté à la main', ''); $('#texte-noter').value = ''; rendreATraiter(); };
  $('#btn-importer').onclick = () => { $('#zone-echange').hidden = false; $('#texte-echange').value = ''; $('#btn-valider-import').hidden = false; };
  $('#btn-valider-import').onclick = importer;
  $('#btn-fermer-echange').onclick = () => { $('#zone-echange').hidden = true; };
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
demarrer();
