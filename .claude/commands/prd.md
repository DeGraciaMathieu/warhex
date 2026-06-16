Rédige un PRD (Product Requirements Document) pour la fonctionnalité décrite ci-après, en suivant la procédure et le format exacts plus bas.

Sujet du PRD : $ARGUMENTS

(Si la ligne ci-dessus est vide, demande d'abord en une phrase quel est le sujet du PRD avant de continuer.)

## Procédure

1. **Explore le code existant** avant de poser quoi que ce soit. Repère les symboles, fichiers et structures de données déjà en place liés au sujet (champs inutilisés, archétypes/placeholders jamais utilisés, systèmes paramétrables, déterminisme…). C'est toi qui remplis les sections « Existant technique » et « Impacts par couche » — ne les demande pas à l'utilisateur, déduis-les du code.

2. **Pose les questions ouvertes** que le code ne peut pas trancher, via `AskUserQuestion` (formulaire à choix cliquables). N'interroge que sur ce qui relève d'une décision produit, pas d'un fait vérifiable dans le repo. Regroupe les questions (2 à 4 à la fois). Couvre notamment :
   - **Objectif / valeur** : quel problème de jeu ou d'expérience cette feature résout, pourquoi maintenant.
   - **Priorité & effort** : priorité (1/2/3), impact (★ à ★★★), effort (faible/moyen/élevé).
   - **Comportements attendus** : les règles concrètes, points de réglage, plafonds.
   - **Hors-scope** : ce qui est explicitement repoussé à un PRD ultérieur.
   Adapte les questions au sujet ; n'en pose pas de génériques inutiles si la réponse est évidente dans le code ou la demande.

3. **Rédige le PRD** une fois les réponses obtenues, dans le format ci-dessous, en français, ton factuel et concis. Propose un numéro de PRD (`PRD NN`) en regardant les PRD déjà présents dans le repo s'il y en a.

4. **Demande où l'enregistrer** (chemin/fichier) avant d'écrire, sauf si l'utilisateur l'a déjà précisé.

## Format attendu

```markdown
# PRD NN — <titre court>

**Priorité : <1|2|3> — Impact <★…> — Effort <faible|moyen|élevé>**

## Objectif

<Le « pourquoi ». La valeur de jeu / d'expérience, le problème résolu. 2-4 lignes.>

## Existant technique

- <État du code pertinent : ce qui existe déjà, ce qui est inutilisé, ce qui est
  déjà paramétrable. Déduit du code, pas de l'utilisateur.>

## Comportement

1. <Règles concrètes numérotées, avec points de réglage et plafonds.>

## Hors-scope

- <Ce qui est explicitement repoussé, avec la raison ou le PRD de suite.>

## Impacts par couche

- `chemin/fichier` : <ce qui change ici.>

## Critères d'acceptation

- <Vérifiables, observables. Inclure le déterminisme / les invariants si pertinents.>

## Tests

- `fichier.test.js` : <quoi vérifier.>

## Risques / questions ouvertes

- <Tensions de conception, choses à équilibrer après essai en jeu.>
```

## Règles

- N'invente pas de faits techniques : si tu n'es pas sûr d'un détail du code, vérifie-le ou note-le comme question ouverte.
- N'implémente rien — ce PRD est un document de spécification, pas du code.
- Respecte les conventions du projet (français, stack, terminologie).
