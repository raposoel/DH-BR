/**
 * recursos.js
 *
 * Automatiza consumo e restauração de recursos de itens "Geradores de Recurso"
 * (ex: Foco, Decocções Tóxicas, Favor) a partir de ações que vivem em OUTROS
 * itens, e padroniza a mensagem de chat mesmo quando o custo já é nativo.
 *
 * Cobre 5 padrões:
 *
 *  1) CONSUME_BY_NAME — ação em item rastreado cujo nome bate um prefixo
 *     desconta um valor FIXO do recurso do item gerador.
 *
 *  2) CONSUME_BY_ACTION_ID — desconta o recurso de uma Action específica
 *     (por ID, não por nome). Suporta `scalable: true`: nesse caso, em vez
 *     de um valor fixo, lê quanto o jogador realmente escolheu gastar em
 *     `config.costs` (usado quando o Custo nativo "Recurso" da própria
 *     Action está quebrado — auto-referenciando um item sem recurso real —
 *     mas o valor ESCOLHIDO pelo jogador ainda é confiável de ler).
 *
 *  3) RESTORE — Action de "Cura" cujo total rolado vai pro recurso do
 *     item gerador.
 *
 *  4) RESTORE_ON_SUCCESS — Action de rolagem de sucesso/fracasso (diceSet)
 *     que, em caso de sucesso, restaura um valor fixo.
 *
 *  5) NOTIFY_ONLY — ação que já tem Custo nativo funcionando sozinho
 *     (mesmo item, resource real configurado) mas ainda assim deve mandar
 *     a mesma mensagem de chat padronizada. Não atualiza o recurso, só lê
 *     o valor (já correto, o sistema nativo cuidou disso) e avisa no chat.
 *     Suporta `scalable: true` pra mostrar a quantidade real escolhida.
 *
 * Ligue DEBUG = true pra ver no console ações de itens rastreados que não
 * bateram nenhum prefixo esperado.
 *
 * Além disso, oculta visualmente nas fichas o pip/barra de Recurso "dummy"
 * dos 4 itens de Favor que precisam dele só pra evitar o crash de custo
 * escalonável quebrado do sistema 2.7.3 (ver DUMMY_RESOURCE_ITEMS abaixo).
 */

const MODULE_TAG = 'recursos.js';
const DEBUG = true;

// -----------------------------------------------------------------------
// Itens "Geradores de Recurso"
// -----------------------------------------------------------------------
const RESOURCE_GENERATORS = {
    foco: 'Compendium.daggerheart-br.classes-hef.Item.fGTKszJ3D5t37Qpo',
    decoccoesToxicas: 'Compendium.daggerheart-br.classes-hef.Item.35q8YEZyETaWe1ll',
    favor: 'Compendium.daggerheart-br.classes-hef.Item.whZ54E1dx9izU8R8'
};

// -----------------------------------------------------------------------
// Itens rastreados que possuem Actions consumidoras "por nome"
// -----------------------------------------------------------------------
const FOCO_TRACKED_ITEMS = [
    'Compendium.daggerheart-br.classes-hef.Item.qEQbpRDw1F6Z2tU0', // Postura Revigorante
    'Compendium.daggerheart-br.classes-hef.Item.fJpRckmq9Ej9qvan', // Postura Confiável
    'Compendium.daggerheart-br.classes-hef.Item.DBCQzSxemj8Oba5R', // Postura Favorecida
    'Compendium.daggerheart-br.classes-hef.Item.ERxPOUQaNA81BepM', // Postura Rápida
    'Compendium.daggerheart-br.classes-hef.Item.P7JGlTEu0k6wmENN', // Postura Agressiva
    'Compendium.daggerheart-br.classes-hef.Item.QuKrnQbunTVEBuM8', // Postura Ancorada
    'Compendium.daggerheart-br.classes-hef.Item.ypYSByvGTTKvJweA', // Postura Defensiva
    'Compendium.daggerheart-br.classes-hef.Item.7OYIlS0FqgXerOD0', // Postura Sobrenatural
    'Compendium.daggerheart-br.classes-hef.Item.RtgkiyR1cbls7Evt', // Postura Agarrante
    'Compendium.daggerheart-br.classes-hef.Item.DeVn5GW1KI4PhIdD', // Postura Vigilante
    'Compendium.daggerheart-br.classes-hef.Item.PRUIUkIUPjfKLbnR', // Postura Estável
    'Compendium.daggerheart-br.classes-hef.Item.rDVp3zM2EMyvgcb7', // Postura Assustadora
    'Compendium.daggerheart-br.classes-hef.Item.93YXhJHn3aiySZRZ', // Postura Afiada
    'Compendium.daggerheart-br.classes-hef.Item.s2H3Bdt6CQFGEJtT', // Postura Precisa
    'Compendium.daggerheart-br.classes-hef.Item.r3rzoK492hK2oDoo', // Postura Isolante
    'Compendium.daggerheart-br.classes-hef.Item.HgI3tH4XLMctS5Kh'  // Postura Esmagadora
];

const DECOCCOES_TRACKED_ITEMS = [
    'Compendium.daggerheart-br.classes-hef.Item.VSOoDQOP7CMoMSkI', // Compêndio de Venenos
    'Compendium.daggerheart-br.classes-hef.Item.VhvNzKHXmgkvaUIS'  // Venomante
];

const FAVOR_TRACKED_ITEMS = [
    'Compendium.daggerheart-br.classes-hef.Item.iHw92ObUSWpdMmVo', // Absorção de Dano
    'Compendium.daggerheart-br.classes-hef.Item.OIcmBruiWc4mezmx', // Aegis Negra
    'Compendium.daggerheart-br.classes-hef.Item.4aImHfeLrAFFjhP7', // Alcance Ameaçador
    'Compendium.daggerheart-br.classes-hef.Item.wHVbrBluDWm3HzQO', // Ataque Temível
    'Compendium.daggerheart-br.classes-hef.Item.hf8RZndJpJhgu4Bc', // Fúria do Patrono
    'Compendium.daggerheart-br.classes-hef.Item.d6l1PWTDaXFNME7Z', // Invocação Lancinante
    'Compendium.daggerheart-br.classes-hef.Item.Z0wThIeyKHbcdkIs', // Manto do Patrono
    'Compendium.daggerheart-br.classes-hef.Item.KYQ1ke29wsFLpyfs'  // Perdição Drenante
];

// -----------------------------------------------------------------------
// Itens cujo Recurso é "dummy" — existe só pra evitar o crash do sistema em
// custo escalonável quebrado (ver consumeByActionId do Favor abaixo), sem
// relação nenhuma com o Favor real. O pip/barra desse recurso é escondido
// visualmente na ficha (ver hideDummyResources mais abaixo).
// -----------------------------------------------------------------------
const DUMMY_RESOURCE_ITEMS = [
    'Compendium.daggerheart-br.classes-hef.Item.Xyvj4thgfq3nuybd', // Abraço Imortal
    'Compendium.daggerheart-br.classes-hef.Item.h8Z2dntlaBkvnZna', // Diminua meus Inimigos
    'Compendium.daggerheart-br.classes-hef.Item.1ESIlvwRUiH8HTkd', // Ira do Outro Mundo
    'Compendium.daggerheart-br.classes-hef.Item.SCyfVGkaAQ3hL2cd'  // Vingança Mortal
];

// -----------------------------------------------------------------------
// Vínculos de recurso
// -----------------------------------------------------------------------
const RESOURCE_LINKS = [
    // === FOCO ===
    {
        type: 'consumeByName',
        trackedItems: FOCO_TRACKED_ITEMS,
        namePrefixes: ['Assumir Postura', 'Gastar Foco'],
        resourceUuid: RESOURCE_GENERATORS.foco,
        amount: 1
    },
    {
        type: 'restore',
        resourceUuid: RESOURCE_GENERATORS.foco,
        actionId: 'fiwGpLwFSUEYLtCK', // "Recuperar Foco"
        readFrom: 'weaponResource'
    },
    {
        type: 'restoreOnSuccess',
        resourceUuid: RESOURCE_GENERATORS.foco,
        actionId: 'ESDlKvwCfUSUXALW', // "Role 1d4" (Postura Revigorante)
        amount: 1
    },
    {
        type: 'notifyOnly',
        actionIds: ['EMMkElWHaloTM2vs'], // "Gastar Foco" nativo, dentro do próprio Foco
        resourceUuid: RESOURCE_GENERATORS.foco,
        amount: 1
    },

    // === DECOCÇÕES TÓXICAS ===
    {
        type: 'consumeByName',
        trackedItems: DECOCCOES_TRACKED_ITEMS,
        namePrefixes: ['Vinha da Meia-Noite', 'Raiz de Górgona', 'Semente da Praga', 'Espinho de Cadáver'],
        resourceUuid: RESOURCE_GENERATORS.decoccoesToxicas,
        amount: 1
    },
    {
        type: 'restore',
        resourceUuid: RESOURCE_GENERATORS.decoccoesToxicas,
        actionId: 'dnHzwGBMP1PeNgbi', // "Marcar Estresse"
        readFrom: 'weaponResource'
    },
    {
        type: 'notifyOnly',
        actionIds: [
            'wJ7mhy5NH9hHKe1y', // Esporo da Sepultura
            'AEeLIpZnygbvNV4f', // Erva Sanguessuga
            'obckx8zw7ZggL2sH', // Gastar Marcador
            'UfQnCknP1lWOhPKk'  // Pétala Fantasma
        ],
        resourceUuid: RESOURCE_GENERATORS.decoccoesToxicas,
        amount: 1
    },

    // === FAVOR ===
    {
        // "Gastar Favor" nativo dentro do próprio Favor. Custo real funciona
        // sozinho (aponta pro recurso certo), só falta a mensagem de chat.
        type: 'notifyOnly',
        actionIds: ['5a3tCJ2mlXeIAYel'], // "Gastar Favor" (dentro do item Favor)
        resourceUuid: RESOURCE_GENERATORS.favor,
        scalable: true,
        amount: 1 // fallback se não achar o valor escalonável em config.costs
    },
    {
        // Ações com nome "Gastar Favor" em itens próprios, custo nativo VAZIO
        // (sem nenhum custo configurado) — desconta valor fixo de 1.
        type: 'consumeByName',
        trackedItems: FAVOR_TRACKED_ITEMS,
        namePrefixes: ['Gastar Favor'],
        resourceUuid: RESOURCE_GENERATORS.favor,
        amount: 1
    },
    {
        // 4 itens com Custo "Recurso" escalonável CONFIGURADO, mas quebrado:
        // aponta pro próprio item (que não tem resource real), então não
        // desconta Favor de verdade. Aqui a gente lê quanto foi ESCOLHIDO
        // (config.costs) e desconta manualmente do Favor de verdade.
        type: 'consumeByActionId',
        actionId: 'eKvKjELegZGqPzg4', // "Dados do Patrono" (Abraço Imortal)
        resourceUuid: RESOURCE_GENERATORS.favor,
        scalable: true,
        amount: 1
    },
    {
        type: 'consumeByActionId',
        actionId: 'T7xiUZPKb7MNxHwo', // "Gastar Favor" (Diminua meus Inimigos)
        resourceUuid: RESOURCE_GENERATORS.favor,
        scalable: true,
        amount: 1
    },
    {
        type: 'consumeByActionId',
        actionId: '3ulSDAytkiN2bq6E', // "Gastar Favor" (Ira do Outro Mundo)
        resourceUuid: RESOURCE_GENERATORS.favor,
        scalable: true,
        amount: 1
    },
    {
        type: 'consumeByActionId',
        actionId: '81VICS6SIep75U3N', // "Gastar Favor" (Vingança Mortal)
        resourceUuid: RESOURCE_GENERATORS.favor,
        scalable: true,
        amount: 1
    },
    {
        type: 'restore',
        resourceUuid: RESOURCE_GENERATORS.favor,
        actionId: 'D04Nbo9tjsXbFHOI', // "Prestar Tributo"
        readFrom: 'weaponResource'
    }

    // Adicione novos vínculos aqui.
];

// -----------------------------------------------------------------------
// Implementação — não precisa mexer daqui pra baixo pra adicionar vínculos
// -----------------------------------------------------------------------

function getSourceId(doc) {
    return doc?.flags?.core?.sourceId ?? doc?._stats?.compendiumSource ?? null;
}

function findActorItemBySource(actor, sourceUuid) {
    return actor.items.find(i => getSourceId(i) === sourceUuid);
}

// "" (sem máximo definido) deve significar "sem limite", não 0.
function resolveMax(resourceItem) {
    const maxRaw = resourceItem.system.resource?.max;
    if (maxRaw === '' || maxRaw === null || maxRaw === undefined) return Infinity;
    const parsed = Number(maxRaw);
    return Number.isFinite(parsed) ? parsed : Infinity;
}

// Lê quanto o jogador realmente escolheu gastar num custo escalonável.
// Cai pro "amount" configurado se não encontrar (ex: ação sem dialog).
function resolveScalableAmount(link, config) {
    const costEntry = config?.costs?.find(c => c.key === 'resource');
    if (typeof costEntry?.total === 'number') return costEntry.total;

    if (DEBUG) {
        console.log(
            `[${MODULE_TAG}] DEBUG: não achei config.costs escalonável, usando fallback ${link.amount ?? 1}.`,
            config
        );
    }
    return link.amount ?? 1;
}

async function sendChatMessage(actor, resourceItem, delta, newValue) {
    const verbo = delta > 0 ? 'recuperou' : 'gastou';
    const quantidade = Math.abs(delta);
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<b>${actor.name}</b> ${verbo} ${quantidade} ${resourceItem.name} (${newValue})`
    });
}

async function applyDelta(actor, resourceUuid, delta) {
    const resourceItem = findActorItemBySource(actor, resourceUuid);
    if (!resourceItem) {
        console.warn(`[${MODULE_TAG}] Item de recurso não encontrado em ${actor.name}: ${resourceUuid}`);
        return;
    }

    const current = resourceItem.system.resource?.value ?? 0;
    const max = resolveMax(resourceItem);

    let newValue = current + delta;
    if (delta > 0) newValue = Math.min(newValue, max);
    newValue = Math.max(0, newValue);

    await resourceItem.update({ 'system.resource.value': newValue });
    await sendChatMessage(actor, resourceItem, delta, newValue);
}

async function handleConsumeByName(link, action) {
    const usedItem = action.item;
    if (!usedItem) return;

    const sourceId = getSourceId(usedItem);
    if (!link.trackedItems.includes(sourceId)) return;

    const name = action.name ?? '';
    const matches = link.namePrefixes.some(prefix => name.startsWith(prefix));

    if (DEBUG && !matches) {
        console.log(
            `[${MODULE_TAG}] DEBUG: item rastreado usado ("${usedItem.name}", ação "${name}") ` +
            `mas nenhum prefixo bateu. Prefixos esperados:`, link.namePrefixes
        );
    }
    if (!matches) return;

    await applyDelta(action.actor, link.resourceUuid, -link.amount);
}

async function handleConsumeByActionId(link, action, config) {
    const actionId = action.id ?? action._id;
    if (actionId !== link.actionId) return;

    const amount = link.scalable ? resolveScalableAmount(link, config) : (link.amount ?? 1);
    await applyDelta(action.actor, link.resourceUuid, -amount);
}

async function handleRestore(link, action, config) {
    const actionId = action.id ?? action._id;
    if (actionId !== link.actionId) return;

    const total = config?.damage?.resources?.[link.readFrom]?.total;
    if (typeof total !== 'number') {
        console.warn(
            `[${MODULE_TAG}] "restore": não encontrei total numérico em config.damage.resources.${link.readFrom}. ` +
            `Objeto config completo para depuração:`,
            config
        );
        return;
    }

    await applyDelta(action.actor, link.resourceUuid, total);
}

async function handleRestoreOnSuccess(link, action, config) {
    const actionId = action.id ?? action._id;
    if (actionId !== link.actionId) return;

    const candidates = [
        config?.roll?.total,
        config?.roll?.result?.total,
        config?.rolls?.[0]?.total,
        config?.roll?.roll?.total
    ];
    const successCount = candidates.find(v => typeof v === 'number');

    if (typeof successCount !== 'number') {
        console.warn(
            `[${MODULE_TAG}] "restoreOnSuccess": não encontrei o total da rolagem. ` +
            `Objeto config completo para depuração:`,
            config
        );
        return;
    }

    if (successCount < 1) return;

    await applyDelta(action.actor, link.resourceUuid, link.amount);
}

// Não desconta nada — o custo nativo já cuidou disso. Só lê o valor
// já atualizado e manda a mesma mensagem de chat, pra ficar padronizado.
async function handleNotifyOnly(link, action, config) {
    const actionId = action.id ?? action._id;
    if (!link.actionIds.includes(actionId)) return;

    const resourceItem = findActorItemBySource(action.actor, link.resourceUuid);
    if (!resourceItem) {
        console.warn(`[${MODULE_TAG}] Item de recurso não encontrado em ${action.actor?.name}: ${link.resourceUuid}`);
        return;
    }

    const amount = link.scalable ? resolveScalableAmount(link, config) : (link.amount ?? 1);
    const current = resourceItem.system.resource?.value ?? 0;
    await sendChatMessage(action.actor, resourceItem, -amount, current);
}

// -----------------------------------------------------------------------
// Ocultação visual do recurso dummy (ver DUMMY_RESOURCE_ITEMS acima)
// -----------------------------------------------------------------------

/**
 * Esconde o bloco de recurso (.item-resource) de cada linha de item na
 * ficha cujo item real corresponda a um dos itens em DUMMY_RESOURCE_ITEMS.
 * Resolve o item real por sourceId (mesma lógica de findActorItemBySource),
 * pra cobrir qualquer cópia embutida em qualquer personagem.
 * @param {Application} app  A aplicação (ficha) sendo renderizada.
 * @param {HTMLElement} html O elemento raiz renderizado.
 */
function hideDummyResources(app, html) {
    if (!(html instanceof HTMLElement)) return;

    const rows = html.querySelectorAll('[data-item-uuid]');
    for (const row of rows) {
        const itemUuid = row.dataset.itemUuid;
        if (!itemUuid) continue;

        let item;
        try {
            item = fromUuidSync(itemUuid);
        } catch {
            continue;
        }
        if (!item) continue;

        const sourceId = getSourceId(item);
        if (!DUMMY_RESOURCE_ITEMS.includes(sourceId)) continue;

        // Esconde qualquer bloco de recurso (pip, barra, dado) dentro dessa
        // linha específica de item — sem afetar outros itens na mesma ficha.
        row.querySelectorAll('.item-resource').forEach(el => {
            el.style.display = 'none';
        });
    }
}

Hooks.once('ready', () => {
    Hooks.on('renderCharacterSheet', (app, html) => {
        hideDummyResources(app, html instanceof HTMLElement ? html : html?.[0]);
    });

    Hooks.on('daggerheart.postUseAction', async (action, config) => {
        for (const link of RESOURCE_LINKS) {
            try {
                if (link.type === 'consumeByName') await handleConsumeByName(link, action);
                else if (link.type === 'consumeByActionId') await handleConsumeByActionId(link, action, config);
                else if (link.type === 'restore') await handleRestore(link, action, config);
                else if (link.type === 'restoreOnSuccess') await handleRestoreOnSuccess(link, action, config);
                else if (link.type === 'notifyOnly') await handleNotifyOnly(link, action, config);
            } catch (err) {
                console.error(`[${MODULE_TAG}] Erro processando vínculo:`, link, err);
            }
        }
    });

    console.log(
        `[${MODULE_TAG}] ${RESOURCE_LINKS.length} vínculo(s) de recurso registrado(s); ` +
        `${DUMMY_RESOURCE_ITEMS.length} item(ns) com recurso dummy serão ocultados nas fichas.`
    );
});
