/**
 * daggerheart-br — Vínculo automático: Escondido -> Oculto
 *
 * Ao aplicar a condição "Escondido" (status id "hidden") num Ator que
 * possua a carta "Oculto" (identificada por compendiumSource, não pelo
 * _id da cópia embutida na ficha), aplica automaticamente o efeito
 * "Oculto" já embutido nessa carta — o mesmo que a ação "Ocultar-se"
 * aplicaria manualmente. Ao remover "Escondido", remove esse efeito
 * (e qualquer "Oculto" aplicado manualmente antes) junto.
 *
 * Não precisa de libWrapper — só hooks nativos de criação/remoção de
 * Active Effect.
 */

import { obterIdDeOrigem as getSourceId } from './utils.js';

const MODULE_ID = 'daggerheart-br';
const OCULTO_ITEM_SOURCE = 'Compendium.daggerheart-br.classes-br.Item.5IT8wYa0m1EFw8Zp';
const OCULTO_EFFECT_NAME = 'Oculto';
const HIDDEN_STATUS_ID = 'hidden';
const LINK_FLAG = 'oculttoAutoLink';

function isOcultoEffect(effect) {
    return effect.name === OCULTO_EFFECT_NAME || effect.getFlag(MODULE_ID, LINK_FLAG);
}

Hooks.on('createActiveEffect', async (effect, _options, userId) => {
    if (userId !== game.user.id) return; // só quem de fato marcou Escondido processa
    const actor = effect.parent;
    if (!(actor instanceof Actor) || !effect.statuses?.has(HIDDEN_STATUS_ID)) return;
    if (actor.effects.some(isOcultoEffect)) return; // já está Oculto (manual ou automático)

    const feature = actor.items.find(i => getSourceId(i) === OCULTO_ITEM_SOURCE);
    if (!feature) return; // ator não tem a carta

    const sourceEffect = feature.effects.find(e => e.statuses?.has('invisible'));
    if (!sourceEffect) return;

    const data = foundry.utils.mergeObject(sourceEffect.toObject(), {
        disabled: false,
        transfer: false,
        origin: feature.uuid,
        flags: { [MODULE_ID]: { [LINK_FLAG]: true } }
    });

    await actor.createEmbeddedDocuments('ActiveEffect', [data]);
});

Hooks.on('deleteActiveEffect', async (effect, _options, userId) => {
    if (userId !== game.user.id) return;
    const actor = effect.parent;
    if (!(actor instanceof Actor) || !effect.statuses?.has(HIDDEN_STATUS_ID)) return;

    const linked = actor.effects.filter(isOcultoEffect);
    if (linked.length) await actor.deleteEmbeddedDocuments('ActiveEffect', linked.map(e => e.id));
});
