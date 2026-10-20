
/*
 * Jeu de devinette (version navigateur)
 * Auteur : MOHAMED_AZIZ_MEZIOU
 * © 2026 - Tous droits réservés
 */

// ---------- MODES ET NIVEAUX ----------
const MODES = {
  normal:  { nom: "NORMAL",  emoji: "🟢", essais: { 1: 15, 2: 10, 3: 10 } },
  hard:    { nom: "HARD",    emoji: "🟠", essais: { 1: 5,  2: 5,  3: 5  } },
  extreme: { nom: "EXTREME", emoji: "🔴", essais: { 1: 2,  2: 3,  3: 3  } }
};

// Les 3 niveaux (même intervalles pour Normal / Hard / Extreme)
const BASES = {
  1: { min: 0,  max: 100,  nombre: true, lettre: false },
  2: { min: 0,  max: 1000, nombre: true, lettre: false },
  3: { min: 10, max: 1000, nombre: true, lettre: true }
};

let cfg, secret, lettreSecrete, restants, niveauCourant, modeCourant, modeChoisi, niveauPerso;

const $ = (id) => document.getElementById(id);
const randint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

// Affiche un seul écran à la fois
const ECRANS = ["menu", "menuNiveaux", "perso", "historique", "jeu"];
function montrer(nom) {
  ECRANS.forEach((e) => { $(e).hidden = (e !== nom); });
}

// ---------- SONS (générés par le navigateur, aucun fichier nécessaire) ----------
let audioCtx;

function bip(freq, debut, duree, type = "sine", volume = 0.2) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + debut;

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duree);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duree);
  } catch (e) {
    // si le son n'est pas disponible, le jeu continue sans son
  }
}

const sons = {
  bip:     () => bip(600, 0, 0.12, "square", 0.1),
  succes:  () => [523, 659, 784, 1047].forEach((f, i) => bip(f, i * 0.12, 0.25, "triangle", 0.25)),
  echec:   () => { bip(300, 0, 0.3, "sawtooth", 0.2); bip(200, 0.3, 0.5, "sawtooth", 0.2); },
  magie:   () => [880, 1109, 1319, 1760].forEach((f, i) => bip(f, i * 0.1, 0.35, "sine", 0.15)),
  fanfare: () => [392, 523, 659, 784, 1047].forEach((f, i) => bip(f, i * 0.11, 0.3, "triangle", 0.22))
};

// ---------- HISTORIQUE DES VICTOIRES (sauvegardé dans le navigateur) ----------
// Seulement pour les modes NORMAL / HARD / EXTREME (pas pour PERSONNALISÉ)
const CLE_HISTO = "historiqueDevinette";

function lireHistorique() {
  try {
    return JSON.parse(localStorage.getItem(CLE_HISTO)) || [];
  } catch (e) {
    return [];
  }
}

function sauverHistorique(liste) {
  try {
    localStorage.setItem(CLE_HISTO, JSON.stringify(liste));
  } catch (e) {
    // si le stockage est bloqué, le jeu continue sans sauvegarde
  }
}

// Enregistre une victoire avec le mode, la date et l'heure exactes
function enregistrerVictoire() {
  const liste = lireHistorique();
  liste.push({
    mode: modeCourant,
    niveau: niveauCourant,
    nombre: secret,
    lettre: cfg.lettre ? lettreSecrete : "",
    essais: cfg.essais - restants + 1,
    date: new Date().toISOString()
  });
  sauverHistorique(liste);
}

// Ex : "jeudi 15 octobre 2026 à 17:42:10"
function formaterDate(iso) {
  const d = new Date(iso);
  const jour = d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  const heure = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  return jour + " à " + heure;
}

let modeHisto = "chrono";    // "chrono" ou "scores"
let filtreMode = "normal";   // "normal", "hard" ou "extreme"

function afficherHistorique() {
  // les anciennes victoires (sans mode) sont considérées comme NORMAL
  const toutes = lireHistorique().map((v) => Object.assign({}, v, { mode: v.mode || "normal" }));
  const ul = $("histListe");
  ul.innerHTML = "";

  if (toutes.length === 0) {
    $("histResume").textContent = "Aucune victoire pour le moment.";
    const vide = document.createElement("li");
    vide.className = "histVide";
    vide.textContent = "Gagne une partie pour la voir apparaître ici 🏆";
    ul.appendChild(vide);
    return;
  }

  const nb = (m) => toutes.filter((v) => v.mode === m).length;
  $("histResume").textContent =
    "🏆 " + toutes.length + " victoire(s) — Normal : " + nb("normal") +
    " • Hard : " + nb("hard") + " • Extreme : " + nb("extreme");

  const liste = toutes.filter((v) => v.mode === filtreMode);

  if (modeHisto === "chrono") {
    if (liste.length === 0) {
      const vide = document.createElement("li");
      vide.className = "histVide";
      vide.textContent = "Pas encore de victoire en mode " + MODES[filtreMode].nom + ".";
      ul.appendChild(vide);
    } else {
      afficherChrono(liste, ul);
    }
  } else {
    afficherScores(liste, ul);
  }
}

// Crée une case de victoire (dorée si gagnée du premier coup)
function creerCase(v, rang) {
  const li = document.createElement("li");
  const premierCoup = (v.essais === 1);
  if (premierCoup) li.className = "premier";

  const l1 = document.createElement("div");
  l1.className = "ligne1";
  const icone = rang ? rang : (premierCoup ? "🌟" : "🥇");
  const niveauTxt = rang ? "" : "Niveau " + v.niveau + " — ";
  l1.textContent = icone + " " + niveauTxt + "🎯 " + v.nombre +
    (v.lettre ? " / " + v.lettre : "") + " — " + v.essais + " essai(s)" +
    (premierCoup ? " — Du premier coup !" : "");

  const l2 = document.createElement("div");
  l2.className = "ligne2";
  l2.textContent = "📅 " + formaterDate(v.date);

  li.appendChild(l1);
  li.appendChild(l2);
  return li;
}

// Ordre chronologique : de la plus ancienne à la plus récente
function afficherChrono(liste, ul) {
  liste.slice()
    .sort((x, y) => new Date(x.date) - new Date(y.date))
    .forEach((v) => ul.appendChild(creerCase(v)));
}

// Meilleurs scores : un classement séparé pour chaque niveau (moins d'essais = mieux)
function afficherScores(liste, ul) {
  const medailles = ["🥇", "🥈", "🥉"];
  [1, 2, 3].forEach((n) => {
    const titre = document.createElement("li");
    titre.className = "titreNiveau";
    titre.textContent = "🏅 " + MODES[filtreMode].nom + " — Niveau " + n + " — Meilleurs scores";
    ul.appendChild(titre);

    const duNiveau = liste
      .filter((v) => v.niveau === n)
      .sort((x, y) => x.essais - y.essais || new Date(x.date) - new Date(y.date));

    if (duNiveau.length === 0) {
      const vide = document.createElement("li");
      vide.className = "histVide";
      vide.textContent = "Pas encore de victoire à ce niveau.";
      ul.appendChild(vide);
      return;
    }
    duNiveau.forEach((v, i) => {
      ul.appendChild(creerCase(v, i < 3 ? medailles[i] : "#" + (i + 1)));
    });
  });
}

// Onglets de l'historique (chronologique / meilleurs scores)
function choisirMode(mode) {
  sons.bip();
  modeHisto = mode;
  $("ongChrono").classList.toggle("actif", mode === "chrono");
  $("ongScores").classList.toggle("actif", mode === "scores");
  afficherHistorique();
}
$("ongChrono").addEventListener("click", () => choisirMode("chrono"));
$("ongScores").addEventListener("click", () => choisirMode("scores"));

// Filtre par mode (Normal / Hard / Extreme)
function choisirFiltre(m) {
  sons.bip();
  filtreMode = m;
  $("filNormal").classList.toggle("actif", m === "normal");
  $("filHard").classList.toggle("actif", m === "hard");
  $("filExtreme").classList.toggle("actif", m === "extreme");
  afficherHistorique();
}
$("filNormal").addEventListener("click", () => choisirFiltre("normal"));
$("filHard").addEventListener("click", () => choisirFiltre("hard"));
$("filExtreme").addEventListener("click", () => choisirFiltre("extreme"));

$("histOuvrir").addEventListener("click", () => {
  sons.bip();
  afficherHistorique();
  montrer("historique");
});

$("histRetour").addEventListener("click", () => {
  sons.bip();
  montrer("menu");
});

$("histEffacer").addEventListener("click", () => {
  if (confirm("Effacer tout l'historique des victoires ?")) {
    sauverHistorique([]);
    afficherHistorique();
  }
});

// ---------- AFFICHAGE ----------
function log(texte, type = "") {
  const li = document.createElement("li");
  li.textContent = texte;
  if (type) li.className = type;
  $("log").appendChild(li);
  $("log").scrollTop = $("log").scrollHeight;
}

function majAffichage() {
  $("restantes").textContent = "⏳ Tentatives restantes : " + restants + " / " + cfg.essais;
  $("progres").style.width = (restants / cfg.essais) * 100 + "%";
}

function secouer() {
  const zone = $("jeu");
  zone.classList.remove("secoue");
  void zone.offsetWidth;
  zone.classList.add("secoue");
}

// ---------- CHOIX DU MODE ET DU NIVEAU ----------
function ouvrirNiveaux(mode) {
  sons.bip();
  modeChoisi = mode;

  if (mode === "perso") {
    $("titreMode").textContent = "🛠️ PERSONNALISÉ — choisissez un niveau :";
    $("nv1").textContent = "Niveau 1 (ton intervalle de nombres)";
    $("nv2").textContent = "Niveau 2 (lettre A-Z seulement)";
    $("nv3").textContent = "Niveau 3 (ton intervalle + lettre A-Z)";
  } else {
    const m = MODES[mode];
    $("titreMode").textContent = m.emoji + " " + m.nom + " — choisissez un niveau :";
    $("nv1").textContent = "Niveau 1 (0 à 100) — " + m.essais[1] + " essais";
    $("nv2").textContent = "Niveau 2 (0 à 1000) — " + m.essais[2] + " essais";
    $("nv3").textContent = "Niveau 3 (10 à 1000 + lettre A-Z) — " + m.essais[3] + " essais";
  }
  montrer("menuNiveaux");
}

function choisirNiveau(n) {
  if (modeChoisi === "perso") {
    ouvrirPerso(n);
  } else {
    lancer(modeChoisi, n, Object.assign({}, BASES[n], { essais: MODES[modeChoisi].essais[n] }));
  }
}

$("mNormal").addEventListener("click", () => ouvrirNiveaux("normal"));
$("mHard").addEventListener("click", () => ouvrirNiveaux("hard"));
$("mExtreme").addEventListener("click", () => ouvrirNiveaux("extreme"));
$("mPerso").addEventListener("click", () => ouvrirNiveaux("perso"));
$("nv1").addEventListener("click", () => choisirNiveau(1));
$("nv2").addEventListener("click", () => choisirNiveau(2));
$("nv3").addEventListener("click", () => choisirNiveau(3));
$("nvRetour").addEventListener("click", () => { sons.bip(); montrer("menu"); });

// ---------- MODE PERSONNALISÉ ----------
let persoSecret = null;   // nombre à deviner (tiré quand l'intervalle est validé)
let persoMax = 0;         // nombre d'essais maximum autorisé

const AIDE_INTERVALLE =
  "Début entre 0 et 9990, fin au maximum 10000, et au moins 10 nombres dans l'intervalle (fin ≥ début + 10).";

// Nombre d'étapes d'une recherche par dichotomie (en coupant en deux) pour trouver le secret
function etapesDichotomie(deb, fin, cible) {
  let etapes = 1;
  let mil = Math.floor((deb + fin) / 2);
  while (cible !== mil) {
    if (cible < mil) fin = mil - 1;
    else deb = mil + 1;
    etapes++;
    mil = Math.floor((deb + fin) / 2);
  }
  return etapes;
}

// Essais supplémentaires autorisés selon la taille de l'intervalle
function bonusEssais(f) {
  if (f <= 50)   return 3;
  if (f <= 100)  return 5;
  if (f <= 300)  return 10;
  if (f <= 600)  return 11;
  if (f <= 1000) return 14;
  return 17;
}

function ouvrirPerso(n) {
  niveauPerso = n;
  persoSecret = null;
  persoMax = 0;
  $("pDeb").value = "";
  $("pFin").value = "";
  $("pEssais").value = "";
  $("pErreur").textContent = "";
  $("persoIntervalle").hidden = (n === 2);
  $("persoEssais").hidden = (n !== 2);   // niveau lettre seule : pas d'intervalle
  $("persoTitre").textContent =
    n === 1 ? "🛠️ Niveau 1 — ton intervalle" :
    n === 2 ? "🛠️ Niveau 2 — devinette de la lettre" :
              "🛠️ Niveau 3 — ton intervalle + lettre";
  $("pAide").textContent = (n === 2)
    ? "Nombre d'essais : de 1 à 8 maximum."
    : AIDE_INTERVALLE;
  montrer("perso");
}

// Étape 1 (niveaux 1 et 3) : on valide l'intervalle, le nombre secret est tiré
// et le nombre d'essais maximum est calculé
function validerIntervalle() {
  const erreur = (m) => { $("pErreur").textContent = "⚠️ " + m; sons.bip(); };

  if ($("pDeb").value === "" || $("pFin").value === "") {
    return erreur("Entre le début et la fin de l'intervalle.");
  }
  const deb = Number($("pDeb").value);
  const fin = Number($("pFin").value);
  if (!Number.isInteger(deb) || !Number.isInteger(fin)) {
    return erreur("Le début et la fin doivent être des nombres entiers.");
  }
  if (deb < 0 || deb > 9990) {
    return erreur("Le début de l'intervalle doit être entre 0 et 9990.");
  }
  if (fin <= deb + 9) {
    return erreur("L'intervalle doit contenir au moins 10 nombres (fin ≥ début + 10).");
  }
  if (fin > 10000) {
    return erreur("La fin de l'intervalle doit être au maximum 10000.");
  }

  sons.bip();
  $("pErreur").textContent = "";
  persoSecret = randint(deb, fin);
  persoMax = etapesDichotomie(deb, fin, persoSecret) + bonusEssais(fin - deb);
  $("pAide").textContent =
    "✅ Intervalle " + deb + " → " + fin + " : nombre d'essais maximum = " + persoMax + ".";
  $("pEssais").value = "";
  $("persoEssais").hidden = false;
  $("pEssais").focus();
}

// Si on change l'intervalle, il faut le valider de nouveau
function resetIntervalle() {
  if (persoSecret === null) return;
  persoSecret = null;
  persoMax = 0;
  $("persoEssais").hidden = true;
  $("pEssais").value = "";
  $("pAide").textContent = AIDE_INTERVALLE;
}

// Étape 2 : on choisit le nombre d'essais et on lance la partie
function lancerPerso() {
  const erreur = (m) => { $("pErreur").textContent = "⚠️ " + m; sons.bip(); };
  const n = niveauPerso;

  if (n !== 2 && persoSecret === null) {
    return erreur("Valide d'abord l'intervalle.");
  }
  const essais = Number($("pEssais").value);
  if ($("pEssais").value === "" || !Number.isInteger(essais) || essais <= 0) {
    return erreur("Entre un nombre d'essais entier, au moins 1.");
  }
  const max = (n === 2) ? 8 : persoMax;   // niveau lettre seule : 8 essais max
  if (essais > max) {
    return erreur("Le nombre d'essais maximum est " + max + ".");
  }

  if (n === 2) {
    lancer("perso", n, { min: 0, max: 0, essais: essais, nombre: false, lettre: true });
  } else {
    lancer("perso", n, {
      min: Number($("pDeb").value), max: Number($("pFin").value), essais: essais,
      nombre: true, lettre: (n === 3), secretFixe: persoSecret
    });
  }
}

$("pDeb").addEventListener("input", resetIntervalle);
$("pFin").addEventListener("input", resetIntervalle);
$("pOk").addEventListener("click", validerIntervalle);
$("pStart").addEventListener("click", lancerPerso);
$("pRetour").addEventListener("click", () => { sons.bip(); montrer("menuNiveaux"); });

// ---------- JEU ----------
function lancer(modeCle, n, config) {
  sons.bip();
  modeCourant = modeCle;
  niveauCourant = n;
  cfg = config;
  secret = cfg.nombre ? (cfg.secretFixe !== undefined ? cfg.secretFixe : randint(cfg.min, cfg.max)) : null;
  lettreSecrete = String.fromCharCode(randint(65, 90));
  restants = cfg.essais;

  $("log").innerHTML = "";
  $("fin").hidden = true;
  montrer("jeu");
  $("nombre").hidden = !cfg.nombre;
  $("lettre").hidden = !cfg.lettre;
  $("nombre").value = "";
  $("lettre").value = "";

  const nomMode = (modeCle === "perso") ? "🛠️ PERSONNALISÉ" : MODES[modeCle].emoji + " " + MODES[modeCle].nom;
  let consigne;
  if (cfg.nombre && cfg.lettre) consigne = "nombre entre " + cfg.min + " et " + cfg.max + " et une lettre de A à Z";
  else if (cfg.nombre)          consigne = "nombre entre " + cfg.min + " et " + cfg.max;
  else                          consigne = "devine la lettre de A à Z";
  $("info").textContent = nomMode + " — Niveau " + n + " : " + consigne + ".";

  majAffichage();
  (cfg.nombre ? $("nombre") : $("lettre")).focus();
}

function terminer() {
  $("jeu").hidden = true;
  $("fin").hidden = false;
}

function valider() {
  const s = Number($("nombre").value);
  const j = $("lettre").value.toUpperCase();

  if (cfg.nombre && ($("nombre").value === "" || !Number.isInteger(s) || s < cfg.min || s > cfg.max)) {
    sons.bip();
    log("⚠️ Entrez un nombre valide entre " + cfg.min + " et " + cfg.max + ".", "erreur");
    return;
  }
  if (cfg.lettre && !(j.length === 1 && j >= "A" && j <= "Z")) {
    sons.bip();
    log("⚠️ Entrez une seule lettre de A à Z.", "erreur");
    return;
  }

  const essaiTexte = cfg.nombre
    ? (cfg.lettre ? "[" + s + " / " + j + "]" : "[" + s + "]")
    : "[" + j + "]";

  const nombreOk = !cfg.nombre || s === secret;
  const lettreOk = !cfg.lettre || j === lettreSecrete;

  if (nombreOk && lettreOk) {
    sons.succes();
    log("🎯 " + essaiTexte + " Bravo ! Vous avez trouvé !", "victoire");
    if (modeCourant !== "perso") {
      enregistrerVictoire();   // sauvegarde dans l'historique (sauf mode personnalisé)
      log("📜 Victoire enregistrée dans l'historique.", "info");
    }
    terminer();
    return;
  }

  restants--;
  majAffichage();
  secouer();

  // Son : échec si plus de tentatives, sinon un simple bip
  if (restants === 0) sons.echec();
  else sons.bip();

  if (cfg.nombre) {
    if (s < secret) log(essaiTexte + " ⬆️ " + (cfg.lettre ? "Augmente le chiffre" : "Augmente"), "haut");
    else if (s > secret) log(essaiTexte + " ⬇️ " + (cfg.lettre ? "Diminue le chiffre" : "Diminue"), "bas");
  }

  if (cfg.lettre) {
    if (j < lettreSecrete) log(essaiTexte + " 🔤 Augmente la lettre", "haut");
    else if (j > lettreSecrete) log(essaiTexte + " 🔤 Diminue la lettre", "bas");
  }

  if (restants === 0) {
    let reponse;
    if (cfg.nombre && cfg.lettre) reponse = "Le nombre était " + secret + " et la lettre " + lettreSecrete + ".";
    else if (cfg.nombre)          reponse = "Le nombre était " + secret + ".";
    else                          reponse = "La lettre était " + lettreSecrete + ".";
    log("❌ Échec ! " + reponse, "echec");
    terminer();
  }

  $("nombre").value = "";
  $("lettre").value = "";
  (cfg.nombre ? $("nombre") : $("lettre")).focus();
}

$("valider").addEventListener("click", valider);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !$("jeu").hidden) valider();
});
$("rejouer").addEventListener("click", () => {
  sons.bip();
  $("log").innerHTML = "";
  $("fin").hidden = true;
  montrer("menu");
});

// ---------- DÉMARRAGE ----------
montrer("menu");