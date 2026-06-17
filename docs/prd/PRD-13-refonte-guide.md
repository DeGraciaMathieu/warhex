# PRD 13 — Refonte du guide de jeu

**Priorité : 2 — Impact ★★ — Effort moyen**

## Objectif

Le guide actuel reste lisible mais souffre de deux défauts : un **manque de hiérarchie
visuelle** (toutes les sections se ressemblent, aucune règle clé n'est mise en avant, un seul long
scroll) et un **contenu incomplet** (l'ordre de tour / séquence d'activation et la ligne de vue ne
sont expliqués nulle part de façon dédiée). On refond le guide pour qu'il soit **visuel, concis et
clair** : une navigation par onglets (une section à la fois), une hiérarchie nette, et l'ajout des
règles manquantes — sans alourdir l'écran.

## Existant technique

- `src/Guide.jsx` (≈ 817 lignes) : composant unique rendu en plein écran depuis `App.jsx`
  (`showGuide`, l.124 / l.483-484 ; bouton « ? Guide » l.537-538). Reçoit `onBack`.
- **Navigation actuelle** : `NAV_ITEMS` (l.593) = boutons d'ancres qui font `scrollIntoView` vers
  des `<div id="...">`. Tout le contenu est empilé dans un seul scroll vertical.
- **Sections présentes** : `objectif`, `unites`, `combat`, `terrains`. Manquent : ordre de
  tour / activation, et une section dédiée à la ligne de vue (LOS).
- **Redondance terrain** : un tableau récapitulatif (l.685-743) **puis** 6 sections détaillées
  (Obstacles → Marais) contenant chacune 2 à 4 mini-scènes canvas, soit ~20 scènes au total
  (`SceneObstacleMove`, `SceneLosBlocked`, `SceneForestCost`, `SceneForestCover`, `SceneForestLos`,
  `SceneForestShoot`, `SceneRiverLos`, `SceneRiverCost`, `SceneTownStop`, `SceneTownLos`,
  `SceneTownCover`, `SceneTownControl`, `SceneHillCost`, `SceneHillLos`, `SceneHillRange`,
  `SceneSwampPoison`, `SceneSwampStop`).
- **Briques de rendu réutilisables** : `MiniCanvas`, `drawMiniHex`, `drawUnit`, `drawDashedLine`,
  `drawCross`, `miniHexToPixel`, `IndicatorIcon` — tout est déjà en place, la refonte réorganise
  sans réinventer le rendu canvas.
- **Stats unités** : section `unites` (l.648-673) lit `UNIT_TEMPLATES` (`src/units.js`) — déjà
  dérivé de la source. Le reste du contenu (effets terrain, règles de combat) est du **texte écrit
  en dur** dans le JSX ; `describeTerrain` (`src/game.js` l.21) existe mais **n'est pas** utilisé
  par le guide.
- **Style** : objets de style inline (`SECTION_STYLE`, `TITLE_STYLE`, `TEXT_STYLE`,
  `TERRAIN_CELL`, `TERRAIN_HEADER`, `TERRAIN_SECTION`) + classes `btn`/`btn-grey`. Police
  `Cinzel` (titres) / `Crimson Text` (texte), thème beige `#f5f0e8`, accent doré `#8a6a08`.

## Comportement

1. **Navigation par onglets** : la barre de navigation devient un sélecteur d'onglets ; **une seule
   section est visible à la fois**. L'onglet actif est mis en évidence (état React local, ex.
   `activeTab`). Plus de scroll géant : changer d'onglet remplace le contenu, le scroll repart en
   haut.
2. **Onglets** : `Objectif`, `Tour & activation` (nouveau), `Unités`, `Combat`, `Ligne de vue`
   (nouveau), `Terrains`. L'ordre suit la logique d'apprentissage (but → déroulé → forces →
   résolution → visée → décor).
3. **Hiérarchie visuelle renforcée** dans chaque section : un titre d'onglet clair, des règles clés
   mises en avant (encadré / accent / numérotation), distinction nette entre « règle » et
   « illustration ». Réglages visuels (intensité d'accent, taille des titres) ajustables après essai.
4. **Section « Tour & activation » (nouvelle)** : explique qui commence et l'**alternance du premier
   joueur** entre les tours (cf. PRD 07), puis la **séquence d'activation** : 2 unités activées par
   tour, une à la fois ; chaque activation = déplacement puis attaque optionnelle ; pas de retour en
   arrière une fois l'action engagée ; passage automatique à l'adversaire ensuite. Texte écrit en
   dur, illustration mini-scène si pertinent.
5. **Section « Ligne de vue » (nouvelle)** : explique ce qui bloque la LOS (obstacles, villes,
   forêts entre deux cases) et ce qui ne la bloque pas (rivières, collines, marais), le cas
   particulier forêt (« on peut tirer **depuis** ou **vers** une forêt, mais pas **à travers** »),
   et la portée minimale de certaines armes. Réutilise les scènes LOS existantes
   (`SceneLosBlocked`, `SceneForestLos`, `SceneForestShoot`, `SceneHillLos`, `SceneRiverLos`,
   `SceneTownLos`) regroupées ici.
6. **Section « Terrains » condensée** : on conserve le **tableau récapitulatif** comme vue
   d'ensemble, et on réduit à **une seule mini-scène illustrative par terrain** (au lieu de 2-4).
   Les scènes redondantes ou déplacées vers la section LOS sont retirées du guide. Le texte des
   effets reste **écrit en dur** (pas de branchement sur `describeTerrain`).
7. **Concision** : aucune information n'est dupliquée entre onglets ; chaque règle apparaît une
   seule fois, à l'endroit le plus pertinent. Le bouton « Retour » (`onBack`) reste accessible en
   permanence (en-tête).
8. **Stats unités inchangées sur le fond** : la section `Unités` continue de lire `UNIT_TEMPLATES`
   (source de vérité), simplement réintégrée dans le système d'onglets.

## Hors-scope

- Brancher le guide sur `describeTerrain` / centraliser les libellés d'effets : décision explicite
  de garder le **texte figé** dans `Guide.jsx` pour cette itération.
- Nouvelles règles de jeu : le guide documente l'existant, il ne modifie aucune mécanique.
- Guide interactif jouable / tutoriel pas-à-pas sur le vrai plateau.
- Internationalisation, sons, animations des mini-scènes (elles restent statiques).
- Refonte du système de styles (passage en CSS classes global) : on peut conserver les styles
  inline existants.

## Impacts par couche

- `src/Guide.jsx` : restructuration majeure — introduction d'un état d'onglet actif et d'un rendu
  conditionnel par section ; barre de nav transformée en onglets ; ajout des sections
  « Tour & activation » et « Ligne de vue » ; section Terrains condensée (tableau + 1 scène par
  terrain) ; suppression / regroupement des scènes redondantes. Les helpers de dessin
  (`MiniCanvas`, `drawMiniHex`, `drawUnit`, …) sont conservés.
- `src/App.jsx` : aucun changement attendu (le guide reste monté via `showGuide` / `onBack`) —
  à confirmer à l'implémentation.
- `src/styles.css` : éventuelles classes pour les onglets (état actif/inactif) si on ne reste pas
  en styles inline. Optionnel.
- `src/units.js`, `src/game.js` : non modifiés (consommés en lecture seule).

## Critères d'acceptation

- Le guide s'ouvre sur un onglet par défaut (`Objectif`) ; cliquer un onglet remplace le contenu
  affiché par la section correspondante, l'onglet actif est visuellement distinct.
- Une seule section est visible à la fois ; il n'y a plus un unique long scroll empilant toutes les
  sections.
- Les sections « Tour & activation » et « Ligne de vue » existent et décrivent respectivement
  l'alternance/séquence d'activation et les règles de LOS (dont le cas forêt et la portée mini).
- La section Terrains affiche le tableau récapitulatif **et** au plus une mini-scène par terrain ;
  aucune information terrain n'est dupliquée avec la section LOS.
- Les stats d'unités restent dérivées de `UNIT_TEMPLATES` (modifier un template se reflète dans le
  guide sans toucher au texte).
- Le bouton « Retour » revient au menu depuis n'importe quel onglet.
- Aucune règle métier n'est modifiée ; aucune fonction pure n'est ajoutée ou changée.

## Tests

- Aucun test unitaire automatisé : `Guide.jsx` est purement présentiel (rendu React/canvas, pas de
  logique pure), et le projet n'a pas de harness DOM. Vérification **en jeu** : ouverture du guide,
  navigation entre les 6 onglets, présence des nouvelles sections, tableau + 1 scène par terrain,
  retour au menu.
- `npx vitest run` doit rester vert (non-régression : aucune fonction pure touchée).

## Risques / questions ouvertes

- **Onglets vs. découverte du contenu** : en masquant les sections non actives, on réduit la
  visibilité globale ; vérifier après essai que les libellés d'onglets suffisent à orienter le
  joueur (sinon ajouter un sous-titre / fil d'Ariane).
- **Choix de la scène unique par terrain** : sélectionner l'illustration la plus parlante pour
  chaque terrain (mouvement, couvert ou LOS) sans perdre une règle importante ; les scènes LOS
  migrent vers l'onglet dédié, à arbitrer cas par cas.
- **Texte figé** : les effets terrain restant écrits en dur, ils peuvent diverger des règles si
  celles-ci évoluent ; relire la cohérence avec `describeTerrain` au moment de la rédaction (sans
  brancher dessus).
- **Hiérarchie visuelle** : trouver le bon dosage d'accents/encadrés pour mettre en avant les
  règles clés sans réintroduire de bruit ; à régler à l'œil après une première version.
