# PRD 13 — Jouabilité mobile

**Priorité : 1 — Impact ★★★ — Effort élevé**

## Objectif

L'application n'est aujourd'hui jouable qu'au clavier/souris sur grand écran : layout fixe en
deux colonnes, panneau latéral de 320 px non escamotable, et tous les retours visuels reposent
sur le survol (inexistant au tactile). On veut rendre Warhex **pleinement fonctionnel sur
mobile** — configuration, partie, et fin de partie — avec une ergonomie tactile native, pour
ouvrir le jeu à un nouveau public et permettre des parties en local/en ligne depuis un téléphone.

## Existant technique

- **Layout** (`App.jsx`) : conteneur racine en flex **row**, `height: 100vh`, `overflow: hidden`.
  Colonne plateau `flex: 1` (centrée, `padding: 20`) + panneau droit `width: 320`, `flexShrink: 0`.
  Tout est en **styles inline** (pas de classes), aucun `@media`/breakpoint dans `styles.css`.
- **Canvas** : résolution interne fixe `CANVAS_W=700 × CANVAS_H=616`, mais `maxWidth: 100%` → il
  se met **déjà** à l'échelle en largeur. Le mapping pointeur→hex utilise le ratio
  `rect.width / CANVAS_W` (`onCanvasClick`, `onMouseMove`, `hexScreenPos`), donc **déjà compatible
  avec un canvas redimensionné** : le tap fonctionne sans refonte du calcul de coordonnées.
- **Interactions** : `onClick` (tap OK) + `onMouseMove`/`onMouseLeave` pour le survol. Le survol
  alimente : tooltip d'unité, infobulle de terrain (PRD 12), relief de case (PRD 12), curseur épée
  + anneau de cible (PRD 11). Aucun `onTouch*`/`onPointer*`. Sur tactile, `onMouseMove` ne se
  déclenche pas → `hoveredHex` reste `null` → ces feedbacks restent **naturellement inertes**.
- **Flux de jeu déjà tactile-compatible** (`game.js` `handleClick`) : tap sur unité alliée =
  sélection (calcule `validMoves`/`validTargets`, affichés sur le plateau) ; tap sur case de
  déplacement = bouge ; tap sur cible = ouvre `weapon_select`. Le cœur select→agir ne dépend pas
  du survol.
- **Tooltips** positionnés en `position: fixed` via `e.clientX/clientY` (`.unit-tooltip`,
  `.terrain-tooltip`) — sans curseur persistant, ils n'ont pas de sens au tactile.
- **Écrans de configuration** (`App.jsx` + `setup.js`) : largeurs fixes (panneaux joueur `240`,
  cartes de mode `180`, en-têtes `max-width: 520`) sans `flex-wrap` systématique → débordent sur
  écran étroit.
- `index.html` : `meta viewport` déjà présent (`width=device-width, initial-scale=1`).
- `100vh` est utilisé : connu pour être imprécis sur mobile (barre d'adresse) → `100dvh` requis.

## Comportement

1. **Détection du mode tactile** : l'app bascule en présentation mobile selon la largeur de
   viewport (breakpoint, ex. `≤ 768px`) et/ou `pointer: coarse`. Le desktop reste inchangé.
2. **Plateau pleine largeur** : le canvas occupe toute la largeur disponible (déjà via
   `maxWidth: 100%`), réduction du padding sur mobile. **Pas de pinch-zoom ni de pan** du plateau
   (choix retenu) : le plateau tient toujours en entier, cases plus petites.
3. **Barre d'actions fixe en bas** (mobile) : les actions de jeu (Déplacer, Attaquer, Fin de tour,
   Consolider…) passent dans une barre ancrée en bas de l'écran, toujours accessible sans scroll.
4. **Panneau d'infos repliable** : les infos détaillées (villes/kills, frise des tours, stats)
   sont dans un panneau escamotable (toggle dans la barre), masqué par défaut pour laisser la
   place au plateau.
5. **Infos sans survol (double affichage)** : sur tactile, les infobulles flottantes (unité,
   terrain) et les feedbacks de survol (relief, curseur épée) sont **désactivés**. À la place :
   - un **premier tap** sur une unité la sélectionne **et** affiche ses stats dans le
     panneau/barre (équivalent du hover) ;
   - un **tap suivant** sur une case de déplacement ou une cible **confirme** l'action ;
   - un tap sur une case de terrain (hors action en cours) affiche les infos du terrain
     (équivalent de l'infobulle PRD 12) dans la zone d'inspection du panneau.
   Le flux `handleClick` existant est conservé ; seule la **destination de l'affichage** des infos
   change (panneau au lieu de tooltip flottant).
6. **Hauteur fiable** : remplacer `100vh` par `100dvh` (ou équivalent) pour éviter le contenu
   coupé par les barres du navigateur mobile.
7. **Écrans de configuration responsives** : sélection de mode, d'armée et réglages de terrain
   s'empilent/wrap proprement sur écran étroit (boutons et panneaux pleine largeur, `flex-wrap`).
8. **Cibles tactiles** : boutons et zones interactives respectent une taille minimale confortable
   (~44 px) sur mobile.
9. **Parité fonctionnelle** : toutes les fonctions desktop (solo vs IA, local, en ligne, guide,
   fin de partie/score) restent accessibles et utilisables sur mobile.

## Hors-scope

- **Pinch-zoom / pan** du plateau (explicitement écarté ; à reconsidérer si le ciblage s'avère
  trop imprécis sur très petits écrans).
- Application native / PWA installable, mode hors-ligne, notifications.
- Refonte graphique du thème ou nouvelles animations spécifiques mobile.
- Gestes avancés (swipe pour changer d'onglet, appui long) au-delà du tap simple.
- Optimisations de performance canvas spécifiques aux appareils bas de gamme (suivi séparé si
  besoin après tests réels).

## Impacts par couche

- `index.html` : passer le calcul de hauteur en `100dvh` ; vérifier la `meta viewport`
  (éventuellement `viewport-fit=cover`).
- `src/App.jsx` : extraire le layout des **styles inline** vers des **classes CSS** pilotables par
  breakpoints ; introduire un état/présentation mobile (barre d'actions basse, panneau d'infos
  repliable) ; router les infos d'unité/terrain vers le panneau quand le survol est indisponible ;
  rendre les écrans de configuration responsives. Le calcul tap→hex et `handleClick` restent
  inchangés.
- `src/styles.css` : ajout des `@media` (breakpoint mobile), styles de la barre d'actions et du
  panneau repliable, désactivation des curseurs/feedbacks de survol sous `@media (hover: none)` /
  `(pointer: coarse)`, tailles de cibles tactiles, `100dvh`.
- `src/setup.js` : adapter les composants de configuration aux largeurs fluides si des dimensions
  fixes y sont codées.
- `src/renderer.js` : aucune refonte nécessaire (le relief/anneau restent pilotés par
  `hoveredHex`, naturellement nul au tactile) ; vérifier la lisibilité des cases réduites.

## Critères d'acceptation

- Sur un viewport mobile (ex. 390×844, portrait), on peut **configurer et jouer une partie
  complète** (solo vs IA et local) du début à la fin sans élément hors écran ni chevauchement.
- Le plateau est entièrement visible et chaque case est tapable de façon fiable ; sélection,
  déplacement et attaque fonctionnent au tap.
- Les actions de jeu sont atteignables en permanence (barre basse) sans scroll ; le panneau
  d'infos s'ouvre/se ferme à la demande.
- Les stats d'unité et les infos de terrain sont consultables sur mobile (dans le panneau), sans
  dépendre du survol ; aucune infobulle flottante ni curseur épée ne s'affiche au tactile.
- Aucun contenu n'est coupé par les barres du navigateur (hauteur `dvh`).
- Le rendu **desktop reste identique** à l'actuel (non-régression visuelle au-dessus du breakpoint).
- Les écrans de configuration et de fin de partie sont lisibles et utilisables sur écran étroit.

## Tests

- Fonctionnalité essentiellement **UI/responsive et tactile** : non couverte par les tests
  unitaires (pas de harness DOM dans le projet, philosophie de tests macro sur fonctions pures).
  Validation **manuelle** via l'émulateur responsive du navigateur (et un appareil réel si
  possible) sur les parcours : configuration → partie → fin de partie, en portrait et paysage.
- `tests/*.test.js` : la suite existante (logique de jeu, `handleClick`, terrain, combat…) doit
  rester verte — le cœur logique n'est pas modifié.
- Si une fonction pure émerge (ex. dérivation d'un descripteur d'infos panneau réutilisant
  `describeTerrain`), l'ajouter au fichier de test du domaine concerné.

## Risques / questions ouvertes

- **Précision du ciblage** sans zoom sur très petits écrans : à éprouver en jeu ; si insuffisant,
  rouvrir la question du pinch-zoom/pan (hors-scope actuel).
- **Refonte du layout inline → classes** : large surface de modification dans `App.jsx`, risque de
  régression visuelle desktop ; nécessite une vérification soignée au-dessus du breakpoint.
- **Réconciliation tap/preview/action** : éviter les actions déclenchées par erreur (ex. ouvrir
  une attaque au premier tap) ; le détail exact du routage des taps devra être affiné à l'essai.
- **Orientation** : portrait visé en priorité, paysage à valider (plus d'espace mais plateau plus
  petit en hauteur) ; définir le comportement si l'espace vertical devient trop contraint.
- **`100dvh` et compatibilité navigateurs** : vérifier le fallback sur les navigateurs mobiles
  plus anciens.
- Ampleur du chantier : envisager un découpage en lots (layout responsive d'abord, puis
  raffinements tactiles) si l'effort élevé doit être étalé.
