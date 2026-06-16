# PRD 02 — Écrans de configuration successifs

**Priorité : 1 — Impact ★★★ — Effort moyen**

## Objectif

L'écran de préparation actuel concentre tout sur une seule vue dense : choix du
mode, lobby en ligne, composition des deux armées et configuration complète du
terrain. C'est la première impression du jeu et elle est surchargée. Découper ce
flux en écrans successifs (**Mode → Terrain → Armées → Lancer**) clarifie chaque
décision, allège la charge visuelle et donne un parcours de démarrage lisible
sans changer aucune règle de jeu.

## Existant technique

- Toute la préparation vit dans le bloc `if (armyPhase)` de `App.jsx`
  (`App.jsx:395-582`), rendu en un seul écran centré.
- L'état de préparation est éclaté en plusieurs `useState` au niveau du
  composant : `armyPhase` (`App.jsx:109`), `vsAI` (`:111`), `fairTowns` (`:112`),
  `terrainDensity` (`:113`), `previewState` (`:114`), `selections` (`:116`),
  `online` (`:121`), `joinCode` (`:122`). Il n'existe **aucune notion d'étape
  courante** — il faudra l'introduire (ex. `setupStep`).
- Le passage en jeu se fait via `startGame()` (`App.jsx:379`) qui appelle
  `initState(selections, { fairTowns, terrainDensity })`, envoie `type: "start"`
  en ligne, puis `setArmyPhase(false)`.
- Le mode est choisi par trois boutons (2 Joueurs / vs IA / 🌐 En ligne,
  `App.jsx:453-463`) qui pilotent `vsAI` et `online`.
- Le lobby en ligne (`App.jsx:465-505`) gère les statuts `menu` / `waiting` /
  `connecting` / `connected` / `error` / `left` via `createOnlineGame`,
  `joinOnlineGame`, `backToOnlineMenu`, `quitOnline` (`App.jsx:160-187`).
- La configuration du terrain (toggle villes, presets `TERRAIN_PRESETS`, sliders
  de densité, aperçu canvas) est déjà **conditionnée à `online?.role !== "guest"`**
  (`App.jsx:507-554`) ; le guest voit un message d'attente.
- Les panneaux d'armée (`renderArmyPanel`, `App.jsx:396-436`) verrouillent le
  panneau IA (`vsAI && player === 2`) et le panneau adverse en ligne
  (`online && player !== myPlayer`).
- L'aperçu de carte est régénéré par `regeneratePreview()` (`App.jsx:201`) sur
  changement de `terrainDensity`/`fairTowns`, et dessiné sur `previewCanvasRef`
  (`App.jsx:211-213`).
- `canStart` (`App.jsx:387`) exige 5 unités par camp ; le bouton « Lancer »
  ajoute la contrainte `online.status === "connected"` (`App.jsx:572`).
- En ligne, les sélections d'armée sont synchronisées via l'effet
  `App.jsx:191-195` (`type: "army"`), et la réception côté pair par
  `handleMessage` (`App.jsx:142-149`).

## Comportement

1. Le flux de préparation est découpé en **étapes successives** pilotées par un
   nouvel état d'étape courante (ex. `setupStep`), tant que `armyPhase` est vrai.
   L'ordre est : **Mode → Terrain → Armées → Lancer**.
2. **Étape Mode** : choix entre `2 Joueurs`, `vs IA`, `🌐 En ligne` (mêmes effets
   qu'aujourd'hui sur `vsAI` / `online` / `selections`). Valider passe à l'étape
   suivante.
   - Si `En ligne` est choisi, l'étape Mode héberge le **lobby** (créer / rejoindre
     par code) ; on ne progresse vers Terrain que lorsque la connexion est établie
     (`online.status === "connected"`).
3. **Étape Terrain** : toggle villes équitables/aléatoires, presets de terrain,
   sliders de densité et aperçu de carte. Réservée à l'hôte / au jeu hors-ligne.
   - En ligne, le **guest saute cette étape** (ou voit l'écran d'attente
     « L'hôte configure… ») conformément à la condition `online?.role !== "guest"`
     déjà en place.
4. **Étape Armées** : composition des armées. En **2 joueurs local**, les deux
   panneaux J1 et J2 restent affichés **sur le même écran** (gauche/droite, comme
   aujourd'hui). Les verrous IA / adversaire distant sont conservés.
5. **Étape Lancer** : récapitulatif minimal + bouton « ⚔ Lancer la partie »,
   actif uniquement si `canStart` (et, en ligne, `online.status === "connected"`).
   Le guest voit « En attente du lancement par l'hôte… ».
6. **Navigation avant uniquement** : pas de bouton « Retour » entre étapes. On ne
   peut que progresser. Un abandon / changement de mode (ou `quitOnline`) ramène
   au **début** du flux (étape Mode) en réinitialisant l'étape courante.
7. Le bouton « ? Guide » reste accessible (au moins depuis l'étape Mode) et son
   retour revient au flux de configuration sans perdre l'étape courante.
8. `startGame()` reste le point d'entrée unique vers la partie : son contenu n'est
   pas modifié, seul le moment où le bouton qui l'appelle apparaît change (étape
   Lancer).

## Hors-scope

- **Pouvoir revenir en arrière** entre les écrans : explicitement écarté
  (navigation avant uniquement) ; pourra faire l'objet d'un PRD ultérieur si le
  besoin se confirme à l'usage.
- **Sélection d'armée hot-seat** (un écran par joueur en local) : écartée, on
  conserve les deux panneaux sur le même écran.
- **Refonte visuelle / thème** au-delà du découpage en étapes : aucune nouvelle
  charte graphique, on réutilise les composants et styles existants.
- **Modification des règles de jeu, de `initState`, du protocole réseau** : aucun
  changement de logique métier ni de messages `online.js`.
- Animation / transitions entre écrans : non requis (passage direct d'une étape à
  l'autre suffit).

## Impacts par couche

- `src/App.jsx` : introduction d'un état d'étape courante (`setupStep`) et de sa
  réinitialisation ; refactor du bloc `if (armyPhase)` (`:395-582`) en rendus par
  étape (Mode+lobby, Terrain, Armées, Lancer) ; câblage des transitions
  « suivant » et du retour au début lors d'un changement de mode / `quitOnline`.
  `renderArmyPanel`, le lobby et la config terrain sont déplacés dans leurs étapes
  respectives sans changer leur logique interne.
- `src/units.js` : si l'étape courante doit être un champ d'état de jeu, l'initialiser
  dans `initState()` ; sinon, rester un `useState` local de préparation (pas de
  champ d'état de partie). **À trancher** (voir risques).
- Aucun changement attendu dans `game.js`, `online.js`, `renderer.js`, `ai.js`,
  `hex.js`.

## Critères d'acceptation

- Au lancement, on arrive sur l'étape **Mode** ; les étapes s'enchaînent dans
  l'ordre Mode → Terrain → Armées → Lancer.
- Choisir `vs IA` à l'étape Mode pré-remplit l'armée IA (comportement
  `randomArmy(2)` actuel) et permet d'atteindre le lancement.
- En `2 Joueurs` local, l'étape Armées affiche les deux panneaux J1/J2 côte à côte
  et « Lancer » ne s'active qu'avec 5 unités par camp.
- En `En ligne`, l'hôte voit l'étape Terrain, le guest ne la voit pas (écran
  d'attente) ; le lancement par l'hôte démarre la partie chez les deux pairs
  (message `type: "start"` inchangé).
- Aucun bouton « Retour » n'est présent ; changer de mode ou quitter une partie en
  ligne ramène à l'étape Mode avec un état cohérent (pas de connexion résiduelle).
- L'aperçu de carte s'affiche et se régénère correctement à l'étape Terrain
  (parité avec le comportement actuel).
- Lancer la partie produit exactement le même `state` initial qu'avant (parité de
  `startGame()` / `initState`).

## Tests

- `tests/setup.test.js` (nouveau, si une fonction pure de flux est extraite) :
  vérifier la machine d'étapes — étape suivante selon le mode, saut de l'étape
  Terrain pour le guest, retour à l'étape Mode sur reset/changement de mode,
  condition d'activation du lancement (`canStart` + statut en ligne).
- Pas de nouveau test si le découpage reste purement présentationnel dans
  `App.jsx` ; dans ce cas, s'assurer que les tests existants
  (`tests/game.test.js`) passent toujours sans régression de `initState`.

## Risques / questions ouvertes

- **Où vit l'état d'étape ?** Probablement un `useState` local de préparation dans
  `App.jsx` (l'étape ne concerne pas la partie en cours). À confirmer pour ne pas
  surcharger inutilement `initState()`.
- **Lobby en ligne dans l'étape Mode** : la connexion peut changer de statut
  (`connecting` → `error` / `left`) pendant qu'on est déjà passé à une étape
  suivante. Définir le comportement si l'adversaire se déconnecte après avoir
  quitté l'étape Mode (probable retour forcé à l'étape Mode).
- **Guest et étape Terrain sautée** : vérifier que le guest reste sur un écran
  d'attente cohérent et n'est jamais « bloqué » entre Terrain et Armées si l'hôte
  est lent à configurer.
- **Logique de testabilité** : extraire ou non une fonction pure pour la machine
  d'étapes ; à équilibrer entre couverture de test et simplicité du refactor.
