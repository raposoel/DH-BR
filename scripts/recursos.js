/**
 * recursos.js
 *
 * Duas responsabilidades neste arquivo:
 *
 * PARTE 1 — Automatiza consumo e restauração de recursos de itens
 * "Geradores de Recurso" (hoje só Decocções Tóxicas) a partir de ações que
 * vivem em OUTROS itens, e padroniza a mensagem de chat mesmo quando o
 * custo já é nativo.
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
 * dos 4 itens que precisam dele só pra evitar o crash de custo escalonável
 * quebrado do sistema 2.7.3 (ver DUMMY_RESOURCE_ITEMS abaixo). ATENÇÃO:
 * esses 4 itens eram os mesmos do Favor por consumeByActionId — como Favor
 * saiu daqui (ver PARTE 2), reconfirmar se esse workaround ainda é
 * necessário depois que o Custo desses 4 itens for reapontado pra "Favor"
 * nativo na própria ficha da ação.
 *
 * PARTE 2 — Favor e Foco (a partir da build 2.8+ do sistema, que passou a
 * ter os dois nativamente via CONFIG.DH.RESOURCE.optionalResources) NÃO
 * são mais rastreados por aqui — viraram Recurso do Ator nativo, com
 * gasto/cura pelo próprio motor do sistema. O que sobra de trabalho nosso:
 *
 *  - Sobrescrever o ícone do Favor pra bater com a identidade visual de
 *    vocês (Foco já usa o ícone nativo certo, não mexe).
 *  - Filtrar o campo "Recurso do Ator" (multi-select) na ficha de
 *    Habilidade pra só mostrar Favor/Foco — mesmo que o sistema adicione
 *    um recurso novo numa atualização futura, ele não aparece pra escolher
 *    sem querer.
 *  - Exibir os dois numa seção própria entre Limiares e Equipamento na
 *    ficha do Personagem (a exibição nativa fica escondida atrás da
 *    setinha ao lado da Esperança).
 *
 * IMPORTANTE: cada Habilidade que hoje gasta/cura Favor precisa ser
 * reconfigurada na PRÓPRIA ficha da ação (menu de Custo/Cura, escolhendo
 * "Favor" direto) — não é mais o script que decide por nome/ID de ação.
 */

const MODULE_TAG = 'recursos.js';
const MODULE_ID = 'daggerheart-br';
const DEBUG = true;

// -----------------------------------------------------------------------
// PARTE 1 — Itens "Geradores de Recurso" (rastreados manualmente)
// -----------------------------------------------------------------------
const RESOURCE_GENERATORS = {
    decoccoesToxicas: 'Compendium.daggerheart-br.classes-hef.Item.35q8YEZyETaWe1ll'
};

// -----------------------------------------------------------------------
// Itens rastreados que possuem Actions consumidoras "por nome"
// -----------------------------------------------------------------------
const DECOCCOES_TRACKED_ITEMS = [
    'Compendium.daggerheart-br.classes-hef.Item.VSOoDQOP7CMoMSkI', // Compêndio de Venenos
    'Compendium.daggerheart-br.classes-hef.Item.VhvNzKHXmgkvaUIS'  // Venomante
];

// -----------------------------------------------------------------------
// Itens cujo Recurso é "dummy" — existe só pra evitar o crash do sistema em
// custo escalonável quebrado (workaround antigo, ligado ao Favor — ver nota
// no cabeçalho do arquivo). O pip/barra desse recurso é escondido
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

// -----------------------------------------------------------------------
// PARTE 2 — Favor e Foco via Recurso do Ator nativo
// -----------------------------------------------------------------------

// Chaves de CONFIG.DH.RESOURCE.optionalResources que o módulo reconhece e
// permite escolher na Habilidade. Adicionar uma chave nova aqui é o único
// passo pra liberar mais um recurso desses no futuro (contanto que ela já
// exista em optionalResources, nativa ou registrada por nós).
const CUSTOM_RESOURCE_KEYS = ['favor', 'focus'];

function applyResourceVisualOverrides() {
    const favor = CONFIG.DH.RESOURCE.optionalResources.favor;
    if (favor) {
        favor.images = {
            full: { value: 'fa-solid fa-skull', isIcon: true, opacity: 1 },
            empty: { value: 'fa-solid fa-skull', isIcon: true, opacity: 0.6 }
        };
    }
    // Foco já usa fa-solid fa-yin-yang nativamente — nada a fazer.
}

// Filtra o <multi-select> "Recurso do Ator" na ficha da Habilidade pra só
// mostrar as chaves em CUSTOM_RESOURCE_KEYS.
function filterActorResourceOptions(app, html) {
    const item = app.document;
    if (!item || item.type !== 'feature') return;
    if (!(html instanceof HTMLElement)) return;

    const select = html.querySelector('multi-select[name="system.actorResources"]');
    if (!select) return;

    select.querySelectorAll('option').forEach(option => {
        if (!CUSTOM_RESOURCE_KEYS.includes(option.value)) option.remove();
    });
}

// Desenha a seção de Favor/Foco entre Limiares e Equipamento na ficha do
// Personagem, lendo direto de system.resources (dado nativo).
function renderActorResourceTrackers(actor, html) {
    if (!(html instanceof HTMLElement)) return;
    if (!actor || actor.type !== 'character') return;

    html.querySelectorAll(`.br-resource-section[data-module="${MODULE_ID}"]`).forEach(el => el.remove());

    const anchor = html.querySelector('.shortcut-items-section');
    if (!anchor) return;

    // availableExtraResources já é o próprio sistema dizendo "esse ator tem
    // esse recurso disponível agora" (via Habilidade concedida) — usamos
    // exatamente esse cálculo pra não duvidar do que o sistema já decidiu.
    const available = actor.system.availableExtraResources ?? {};

    // Se TODO recurso extra do ator for um dos nossos (Favor/Foco), esconde
    // a setinha nativa que abre o painel escondido ao lado da Esperança —
    // a exibição daqui embaixo já cobre isso. Se existir algum recurso
    // extra que a gente NÃO cobre (ex: um Homebrew de outro tipo), deixa a
    // setinha visível pra esse caso continuar acessível.
    const availableKeys = Object.keys(available);
    const allCovered = availableKeys.length > 0 && availableKeys.every(k => CUSTOM_RESOURCE_KEYS.includes(k));
    const resourceManagerButton = html.querySelector('.resource-manager');
    if (resourceManagerButton) resourceManagerButton.style.display = allCovered ? 'none' : '';

    for (const key of CUSTOM_RESOURCE_KEYS) {
        if (!(key in available)) continue;

        const resource = actor.system.resources?.[key];
        if (!resource || !resource.max) continue;

        const def = CONFIG.DH.RESOURCE.optionalResources[key];
        const icon = def?.images?.full?.value ?? 'fa-solid fa-circle';

        const section = document.createElement('div');
        section.className = 'br-resource-section';
        section.dataset.module = MODULE_ID;
        section.dataset.key = key;

        const title = document.createElement('h4');
        title.className = 'br-resource-label';
        title.textContent = game.i18n.localize(resource.label ?? def?.label ?? key);
        section.appendChild(title);

        const pips = document.createElement('div');
        pips.className = 'br-resource-pips';

        for (let i = 1; i <= resource.max; i++) {
            const pip = document.createElement('span');
            pip.className = 'br-resource-pip' + (i > (resource.value ?? 0) ? ' empty' : '');
            pip.innerHTML = `<i class="${icon}"></i>`;
            pip.addEventListener('click', async () => {
                const currentValue = actor.system.resources?.[key]?.value ?? 0;
                const next = Math.max(0, Math.min(i === currentValue ? i - 1 : i, resource.max));
                // Passa pelo MESMO método nativo que o sistema usa pra
                // gastar/curar Favor e Foco em qualquer ação — em vez de
                // escrever direto em system.resources (que tem validação
                // de chave própria e pode simplesmente ignorar o update).
                await actor.modifyResource([{ key, value: next - currentValue }]);
            });
            pips.appendChild(pip);
        }

        section.appendChild(pips);
        anchor.insertAdjacentElement('beforebegin', section);
    }
}

// -----------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------

Hooks.once('ready', () => {
    if (game.system.id !== 'daggerheart') return;

    applyResourceVisualOverrides();

    Hooks.on('renderCharacterSheet', (app, html) => {
        const root = html instanceof HTMLElement ? html : html?.[0];
        hideDummyResources(app, root);
        renderActorResourceTrackers(app.document, root);
    });

    Hooks.on('renderItemSheet', (app, html) => {
        const root = html instanceof HTMLElement ? html : html?.[0];
        filterActorResourceOptions(app, root);
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
        `${DUMMY_RESOURCE_ITEMS.length} item(ns) com recurso dummy serão ocultados nas fichas; ` +
        `${CUSTOM_RESOURCE_KEYS.length} recurso(s) do Ator nativo(s) habilitado(s) (${CUSTOM_RESOURCE_KEYS.join(', ')}).`
    );
});
