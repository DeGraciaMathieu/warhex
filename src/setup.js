// Machine d'étapes de l'écran de préparation (avant le lancement de la partie).
// Flux : Mode → Terrain → Armées (la partie se lance depuis l'étape Armées). Le
// guest en ligne saute l'étape Terrain (configurée par l'hôte). Navigation avant
// uniquement.

export const SETUP_STEPS = ["mode", "terrain", "armies"];

// Liste ordonnée des étapes pour un contexte donné. Le guest ne configure pas
// le terrain, on retire donc cette étape de sa séquence.
export function setupSteps(online) {
    if (online?.role === "guest") return SETUP_STEPS.filter(s => s !== "terrain");
    return SETUP_STEPS;
}

// Étape suivante dans la séquence, ou l'étape courante si déjà à la dernière.
export function nextSetupStep(step, online) {
    const steps = setupSteps(online);
    const i = steps.indexOf(step);
    if (i === -1 || i === steps.length - 1) return step;
    return steps[i + 1];
}

// On ne quitte l'étape Mode que lorsque le mode est prêt : hors-ligne toujours,
// en ligne seulement une fois la connexion établie.
export function canAdvanceFromMode(online) {
    return !online || online.status === "connected";
}
