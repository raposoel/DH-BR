const DC_MODULE_ID = 'daggerheart-br';

/**
 * Guarda o total original de dano/cura de cada mensagem, capturado UMA
 * VEZ (na primeira renderização, antes de qualquer clique). Os botões
 * 2x/½ sempre calculam em cima desse valor guardado - nunca do estado
 * atual da mensagem - pra garantir que cada clique seja independente
 * dos anteriores, mesmo que a restauração pós-clique falhe por algum
 * motivo.
 */
const dcTotaisOriginais = new Map();

function dcLerTotal(objetoDano) {
    if (!objetoDano) return null;
    return typeof objetoDano._total === 'number' ? objetoDano._total : objetoDano.total;
}

function dcCapturarTotaisOriginais(message) {
    const sys = message.system;
    dcTotaisOriginais.set(message.id, {
        main: dcLerTotal(sys.damage?.main),
        resources: Object.fromEntries(
            Object.entries(sys.damage?.resources ?? {}).map(([chave, valor]) => [chave, dcLerTotal(valor)])
        )
    });
}

function dcObterTotaisOriginais(message) {
    if (!dcTotaisOriginais.has(message.id)) {
        dcCapturarTotaisOriginais(message);
    }
    return dcTotaisOriginais.get(message.id);
}

/**
 * dano-cura.js
 * ------------
 * Adiciona botões compactos de aplicar Dano/Cura (com variantes 2x e ½)
 * diretamente numa linha logo abaixo do cabeçalho "Dano"/"Cura" do card
 * de rolagem do sistema Daggerheart, em vez do botão grande e sempre
 * visível que já existe embaixo do card (esse continua escondido via
 * CSS). Também adiciona a funcionalidade de Prestar Ajuda nas rolagens
 * principais de ação/ataque.
 *
 * A linha de botões fica visível tanto com a seção aberta quanto
 * fechada.
 *
 * TESTE: os botões [-]/[+] reaproveitam a lógica nativa do sistema
 * (message.onApplyDamage). Os botões [2x]/[½] reusam o mesmo caminho de
 * workflow nativo (pra disparar a telinha de armadura do alvo), mas com
 * uma estrutura de dano sintética embutindo o total já calculado.
 */

Hooks.on('renderChatMessageHTML', (message, html) => {
    try {
        dcCapturarTotaisOriginais(message);
        dcInjetarBotoes(message, html);
    } catch (err) {
        console.error(`${DC_MODULE_ID} | dano-cura.js erro ao injetar botões:`, err);
    }

    try {
        dcInterceptarCliqueDado(message, html);
    } catch (err) {
        console.error(`${DC_MODULE_ID} | dano-cura.js erro ao interceptar clique de dado:`, err);
    }

    try {
        paInjetarBotao(message, html);
    } catch (err) {
        console.error(`${DC_MODULE_ID} | dano-cura.js erro ao injetar botão de ajuda:`, err);
    }
});

function dcInjetarBotoes(message, html) {
    // Só mensagens do próprio sistema Daggerheart têm esse formato de dado.
    if (!message.system || typeof message.system.hasHealing === 'undefined') return;

    const secoes = html.querySelectorAll('.roll-part.damage-section');
    if (!secoes.length) return;

    const ehCura = !!message.system.hasHealing;

    for (const secao of secoes) {
        // Evita duplicar se o Foundry re-renderizar a mesma mensagem.
        if (secao.querySelector('.dc-buttons-row')) continue;

        const cabecalho = secao.querySelector('.roll-part-header');
        if (!cabecalho) continue;

        const linha = document.createElement('div');
        linha.classList.add('dc-buttons-row');

        if (ehCura) {
            linha.append(
                dcCriarBotao({
                    icone: 'fa-user-plus',
                    titulo: 'Aplicar Cura',
                    classe: 'dc-heal',
                    onClick: () => dcAplicarNativo(message)
                }),
                dcCriarBotao({
                    texto: '2x',
                    titulo: 'Aplicar Cura em Dobro',
                    classe: 'dc-heal',
                    onClick: () => dcAplicarCuraDobrada(message)
                })
            );
        } else {
            linha.append(
                dcCriarBotao({
                    icone: 'fa-user-minus',
                    titulo: 'Aplicar Dano',
                    classe: 'dc-damage',
                    onClick: () => dcAplicarNativo(message)
                }),
                dcCriarBotao({
                    texto: '2x',
                    titulo: 'Aplicar Dano em Dobro',
                    classe: 'dc-damage',
                    onClick: () => dcAplicarDanoMultiplicado(message, 2)
                }),
                dcCriarBotao({
                    texto: '½',
                    titulo: 'Aplicar Metade do Dano',
                    classe: 'dc-damage',
                    onClick: () => dcAplicarDanoMultiplicado(message, 0.5)
                })
            );
        }

        // Insere logo depois do cabeçalho ("^ Dano ^"), fora da parte que
        // expande/recolhe - por isso fica visível nos dois estados.
        cabecalho.after(linha);
    }
}

function dcCriarBotao({ icone = null, texto = '', titulo = '', classe = '', onClick }) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.classList.add('dc-btn', classe);
    botao.title = titulo;
    botao.setAttribute('aria-label', titulo);

    if (icone) {
        const i = document.createElement('i');
        i.classList.add('fa-solid', icone);
        botao.append(i);
    } else {
        botao.textContent = texto;
    }

    botao.addEventListener('click', event => {
        event.stopPropagation();
        onClick();
    });

    return botao;
}

/**
 * Reaproveita o botão nativo "Causar Dano" / "Aplicar Cura" do sistema
 * (mesma lógica que roda quando você clica no botão grande de sempre).
 */
function dcAplicarNativo(message) {
    if (typeof message.onApplyDamage !== 'function') {
        console.warn(`${DC_MODULE_ID} | dano-cura.js: message.onApplyDamage não encontrado. A versão do sistema pode ter mudado.`);
        return;
    }
    message.onApplyDamage({ stopPropagation() {} });
}

/**
 * Aplica dano multiplicado (2x/½) chamando actor.takeDamage() DIRETO em
 * cada alvo, sem passar pelo workflow/applyDamage nativo (que exige
 * ".clone()", Roll de verdade, ".terms" etc - toda a complexidade que
 * causou os bugs de vazamento e os erros de validação até agora).
 *
 * actor.takeDamage() aceita um objeto simples { total, damageTypes } -
 * confirmado direto no código do sistema (#parseDamageArgs). É o
 * takeDamage que já cuida de tudo sozinho: resistência do alvo, cálculo
 * do limiar, e a telinha de escolha de armadura.
 *
 * Nunca toca em "message.system" nem chama "message.update()" pra
 * aplicar o dano - por isso não tem COMO vazar nada pro próximo clique
 * ou pro botão nativo "Causar Dano": cada clique é 100% independente,
 * sempre calculado em cima do total original guardado no cache.
 */
async function dcAplicarDanoMultiplicado(message, multiplicador) {
    const sys = message.system;

    if (!sys?._getCurrentTargets || sys._getCurrentTargets().length === 0) {
        return ui.notifications.info(game.i18n.localize('DAGGERHEART.UI.Notifications.noTargetsSelected'));
    }

    const targets = sys.currentHitTargets;
    if (!targets?.length) {
        return ui.notifications.info(game.i18n.localize('DAGGERHEART.UI.Notifications.noTargetsHit'));
    }

    // Base de cálculo: o total ORIGINAL guardado no primeiro render da
    // mensagem - nunca o estado atual. Garante que 2x/½/[-] sejam
    // sempre independentes entre si.
    const originais = dcObterTotaisOriginais(message);
    if (typeof originais?.main !== 'number') {
        console.warn(`${DC_MODULE_ID} | dano-cura.js: não achei o total original de dano pra multiplicar.`);
        return;
    }

    const novoTotal = Math.ceil(originais.main * multiplicador);
    const damageTypes = Array.from(
        sys.damage?.main?.options?.damageTypes ?? sys.damage?.main?.damageTypes ?? []
    );
    const isDirect = !!sys.isDirect;

    const targetDamage = [];
    const promessas = [];

    for (const target of targets) {
        const actor = foundry.utils.fromUuidSync(target.actorId);
        if (!actor) continue;

        const token = target.id
            ? game.scenes.find(s => s.active)?.tokens.find(t => t.id === target.id)
            : actor.prototypeToken;

        promessas.push(
            actor.takeDamage({ total: novoTotal, damageTypes }, isDirect).then(updates => {
                targetDamage.push({
                    token: {
                        id: token?.id,
                        name: token?.name ?? actor.name,
                        img: token?.texture?.src ?? actor.img
                    },
                    updates
                });
            })
        );
    }

    await Promise.all(promessas);
    await dcCriarResumoDano(message, targetDamage);
}

/**
 * Aplica CURA em dobro. Diferente de dano, cura não usa "main"/threshold -
 * o sistema lê os totais direto de cada entrada em "system.damage.resources"
 * (ex: hitPoints, stress, armor, hope) e chama actor.takeHealing() com um
 * objeto simples { chaveDoRecurso: totalJaDobrado, ... } - confirmado no
 * próprio onApplyDamage nativo do sistema:
 *   if (this.system.hasHealing) actor.takeHealing(this.system.damage);
 * e no #parseDamageArgs de takeHealing, que ignora "main" e só lê
 * "resources". Por isso aqui NUNCA usamos dcAplicarDanoMultiplicado (que é
 * baseado em "main" + actor.takeDamage(), específico de dano).
 */
async function dcAplicarCuraDobrada(message) {
    const sys = message.system;

    if (!sys?._getCurrentTargets || sys._getCurrentTargets().length === 0) {
        return ui.notifications.info(game.i18n.localize('DAGGERHEART.UI.Notifications.noTargetsSelected'));
    }

    const targets = sys.currentHitTargets;
    if (!targets?.length) {
        return ui.notifications.info(game.i18n.localize('DAGGERHEART.UI.Notifications.noTargetsHit'));
    }

    // Base de cálculo: os totais ORIGINAIS de cada recurso, guardados no
    // primeiro render da mensagem - mesmo princípio do dano 2x/½.
    const originais = dcObterTotaisOriginais(message);
    const chaves = Object.keys(originais?.resources ?? {}).filter(
        chave => typeof originais.resources[chave] === 'number'
    );
    if (!chaves.length) {
        console.warn(`${DC_MODULE_ID} | dano-cura.js: não achei totais de cura pra dobrar.`);
        return;
    }

    const curaDobrada = Object.fromEntries(
        chaves.map(chave => [chave, Math.ceil(originais.resources[chave] * 2)])
    );

    const targetDamage = [];
    const promessas = [];

    for (const target of targets) {
        const actor = foundry.utils.fromUuidSync(target.actorId);
        if (!actor) continue;

        const token = target.id
            ? game.scenes.find(s => s.active)?.tokens.find(t => t.id === target.id)
            : actor.prototypeToken;

        promessas.push(
            actor.takeHealing(curaDobrada).then(updates => {
                targetDamage.push({
                    token: {
                        id: token?.id,
                        name: token?.name ?? actor.name,
                        img: token?.texture?.src ?? actor.img
                    },
                    updates
                });
            })
        );
    }

    await Promise.all(promessas);
    await dcCriarResumoDano(message, targetDamage);
}

/**
 * Replica o card "Dano Aplicado" que o botão nativo cria depois de
 * aplicar - usando o mesmo template (damageSummary.hbs) e a mesma
 * checagem de configuração que o sistema usa.
 */
async function dcCriarResumoDano(message, targetDamage) {
    if (!targetDamage.length) return;

    try {
        const automation = game.settings.get('daggerheart', 'Automation');
        if (automation && !automation.summaryMessages?.damage) return;
    } catch (err) {
        // Se não achar a configuração, cria o resumo mesmo assim.
    }

    let hideObserverPermissionInChat = false;
    try {
        hideObserverPermissionInChat =
            game.settings.get('daggerheart', 'Metagaming')?.hideObserverPermissionInChat ?? false;
    } catch (err) {
        // segue com o padrão (false) se não achar
    }

    const content = await foundry.applications.handlebars.renderTemplate(
        'systems/daggerheart/templates/ui/chat/damageSummary.hbs',
        { targets: targetDamage, hideObserverPermissionInChat }
    );

    // Mesma escolha de título que o sistema nativo faz em applyDamage():
    // `damageSummary.${config.hasHealing ? 'healingTitle' : 'title'}`.
    const ehCura = !!message.system?.hasHealing;

    await ChatMessage.create({
        type: 'systemMessage',
        user: game.user.id,
        speaker: message.speaker,
        title: game.i18n.localize(`DAGGERHEART.UI.Chat.damageSummary.${ehCura ? 'healingTitle' : 'title'}`),
        content
    });
}

/**
 * Intercepta o clique num dado individual de DANO (seção expandida) ANTES
 * do listener nativo do sistema rodar (que abre direto um "tem certeza que
 * quer rerolar?"). Usa captura de evento (capture: true) no container da
 * mensagem inteira - isso garante que rodamos primeiro, já que a captura
 * desce da raiz até o alvo antes dos listeners de bolha (o listener nativo
 * do sistema é anexado direto no próprio dado, em fase de bolha).
 *
 * TESTE: essa é a parte mais sensível a versão do sistema. Se o clique no
 * dado voltar a mostrar só "rerolar?" sem a opção de dobrar, o seletor
 * '.dice.reroll-button[data-type="damage"]' pode ter mudado - inspeciona
 * o elemento (F12) e me manda a classe/atributos atuais.
 */
function dcInterceptarCliqueDado(message, html) {
    if (html.dataset.dcDadoInterceptado) return;
    html.dataset.dcDadoInterceptado = 'true';

    html.addEventListener(
        'click',
        event => {
            const dado = event.target.closest('.dice.reroll-button[data-type="damage"]');
            if (!dado) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();

            dcEscolherAcaoDado(message, dado, event.shiftKey);
        },
        true // captura - roda antes do listener nativo (que é em bolha)
    );
}

async function dcEscolherAcaoDado(message, dadoEl, pularConfirmacao) {
    const { dice, result, damageType } = dadoEl.dataset;
    const isResource = dadoEl.dataset.isResource === 'true';

    if (dice === undefined || result === undefined) return;

    // Shift-click preserva o atalho rápido nativo: rerola sem perguntar.
    if (pularConfirmacao) {
        return dcRerolarDado(message, isResource, damageType, dice, result);
    }

    const escolha = await foundry.applications.api.DialogV2.wait({
        window: { title: 'Dado' },
        content: '<p>O que você quer fazer com esse dado?</p>',
        buttons: [
            { action: 'reroll', label: 'Rerolar', callback: () => 'reroll' },
            { action: 'double', label: 'Dobrar', callback: () => 'double' },
            { action: 'addOne', label: 'Rolar +', callback: () => 'addOne' },
            { action: 'remove', label: 'Remover', callback: () => 'remove' }
        ],
        rejectClose: false
    });

    if (escolha === 'reroll') {
        await dcRerolarDado(message, isResource, damageType, dice, result);
    } else if (escolha === 'double') {
        await dcDobrarDado(message, isResource, damageType, dice, result);
    } else if (escolha === 'addOne') {
        const quantidade = await dcPerguntarQuantidade();
        if (quantidade) {
            await dcRolarMaisUm(message, isResource, damageType, dice, quantidade);
        }
    } else if (escolha === 'remove') {
        await dcRemoverDado(message, isResource, damageType, dice, result);
    }
}

/** Pergunta quantos dados extras rolar (usado pelo "Rolar +"). Padrão: 1. */
async function dcPerguntarQuantidade() {
    return foundry.applications.api.DialogV2.wait({
        window: { title: 'Rolar Mais Dados' },
        content: `
            <p>
                <label for="dc-quantidade">Quantos dados rolar?</label>
                <input type="number" id="dc-quantidade" name="dc-quantidade" value="1" min="1" step="1" />
            </p>
        `,
        buttons: [
            {
                action: 'confirmar',
                label: 'Rolar',
                default: true,
                callback: (event, button) => Number(button.form.elements['dc-quantidade'].value) || 1
            },
            { action: 'cancel', label: 'Cancelar', callback: () => null }
        ],
        rejectClose: false
    });
}

/** Encontra os termos de dado de verdade (ignora operadores/números fixos). */
function dcObterTermosDeDado(rollObj) {
    return (rollObj?.terms ?? []).filter(t => Array.isArray(t?.results));
}

/**
 * Recalcula o total somando os termos manualmente - não depende de
 * ".dice" nem de "._evaluate()" (que dependem de comportamento de
 * instância viva de Roll, nem sempre disponível aqui).
 */
function dcRecalcularTotal(rollObj) {
    let total = 0;
    let sinal = 1;
    for (const termo of rollObj.terms ?? []) {
        if (termo.class === 'OperatorTerm' || termo.operator) {
            sinal = termo.operator === '-' ? -1 : 1;
        } else if (Array.isArray(termo.results)) {
            total += sinal * termo.results.filter(r => r.active).reduce((soma, r) => soma + r.result, 0);
        } else if (typeof termo.number === 'number') {
            total += sinal * termo.number;
        }
    }
    rollObj._total = total;
    return total;
}

/**
 * Reroll manual (não usa mais a função nativa rerollDamageDie, que
 * espera um getter ".dice" que não existe nessa versão/estrutura do
 * roll). Marca o resultado antigo como inativo e sorteia um novo,
 * exatamente como o reroll nativo faz visualmente.
 */
async function dcRerolarDado(message, isResource, damageType, dice, result) {
    const sys = message.system;
    const rollAlvo = isResource ? sys.damage.resources[damageType] : sys.damage.main;
    if (!rollAlvo) return;

    const termos = dcObterTermosDeDado(rollAlvo);
    const termo = termos[Number(dice)];
    const resultado = termo?.results?.[Number(result)];
    if (!termo || !resultado) {
        console.warn(`${DC_MODULE_ID} | dano-cura.js: dado/resultado não encontrado pra rerolar.`);
        return;
    }

    resultado.active = false;
    const novaFace = Math.ceil(CONFIG.Dice.randomUniform() * termo.faces);
    termo.results.push({ result: novaFace, active: true, rerolled: true });

    dcRecalcularTotal(rollAlvo);

    const updatePath = isResource ? `system.damage.resources.${damageType}` : 'system.damage.main';
    await message.update({ [updatePath]: rollAlvo });
}

/**
 * Dobra o valor daquele dado específico. Em vez de multiplicar a face por
 * 2 (que pode confundir crítico/faces máximas), DUPLICA o resultado - ou
 * seja, passa a existir um segundo dado idêntico ali do lado, e o Total
 * soma os dois. Fica visualmente claro (2 dados iguais) e recalcula
 * sozinho, sem precisar de nenhum selo/marcação extra.
 */
async function dcDobrarDado(message, isResource, damageType, dice, result) {
    const sys = message.system;
    const rollAlvo = isResource ? sys.damage.resources[damageType] : sys.damage.main;
    if (!rollAlvo) return;

    const termos = dcObterTermosDeDado(rollAlvo);
    const termo = termos[Number(dice)];
    const resultado = termo?.results?.[Number(result)];
    if (!termo || !resultado) {
        console.warn(`${DC_MODULE_ID} | dano-cura.js: dado/resultado não encontrado pra dobrar.`);
        return;
    }

    const copia = foundry.utils.deepClone(resultado);
    termo.results.splice(Number(result) + 1, 0, copia);

    dcRecalcularTotal(rollAlvo);

    const updatePath = isResource ? `system.damage.resources.${damageType}` : 'system.damage.main';
    await message.update({ [updatePath]: rollAlvo });
}

/**
 * Rola dados extras do mesmo tipo (não duplica um resultado existente -
 * sorteia resultados novos de verdade) e soma no Total. `quantidade`
 * define quantos dados extras rolar de uma vez (padrão: 1).
 */
async function dcRolarMaisUm(message, isResource, damageType, dice, quantidade = 1) {
    const sys = message.system;
    const rollAlvo = isResource ? sys.damage.resources[damageType] : sys.damage.main;
    if (!rollAlvo) return;

    const termos = dcObterTermosDeDado(rollAlvo);
    const termo = termos[Number(dice)];
    if (!termo) {
        console.warn(`${DC_MODULE_ID} | dano-cura.js: dado não encontrado pra rolar mais.`);
        return;
    }

    for (let i = 0; i < quantidade; i++) {
        const novaFace = Math.ceil(CONFIG.Dice.randomUniform() * termo.faces);
        termo.results.push({ result: novaFace, active: true });
    }

    dcRecalcularTotal(rollAlvo);

    const updatePath = isResource ? `system.damage.resources.${damageType}` : 'system.damage.main';
    await message.update({ [updatePath]: rollAlvo });
}

/**
 * Remove (exclui) aquele resultado específico do total - só marca
 * `active = false`, mesma convenção que o sistema já usa pra resultados
 * "descartados" (ex: o valor antigo de um reroll). Não apaga o dado da
 * lista - ele continua aparecendo no card, riscado, só não soma mais.
 */
async function dcRemoverDado(message, isResource, damageType, dice, result) {
    const sys = message.system;
    const rollAlvo = isResource ? sys.damage.resources[damageType] : sys.damage.main;
    if (!rollAlvo) return;

    const termos = dcObterTermosDeDado(rollAlvo);
    const termo = termos[Number(dice)];
    const resultado = termo?.results?.[Number(result)];
    if (!termo || !resultado) {
        console.warn(`${DC_MODULE_ID} | dano-cura.js: dado/resultado não encontrado pra remover.`);
        return;
    }

    resultado.active = false;

    dcRecalcularTotal(rollAlvo);

    const updatePath = isResource ? `system.damage.resources.${damageType}` : 'system.damage.main';
    await message.update({ [updatePath]: rollAlvo });
}


/* ==========================================================================
 * PRESTAR AJUDA
 * ==========================================================================
 * Botão "Ajudar" em toda rolagem de Ataque/Ação/Reação (Duality ou d20 puro
 * de NPC) exibida no chat. Ao clicar, o jogador escolhe um dado (d4 a d12),
 * gasta 1 Ponto de Esperança do SEU personagem (game.user.character) e o
 * resultado desse dado é somado ao total da rolagem já existente no card.
 *
 * Múltiplas pessoas podem ajudar na mesma rolagem, mas cada personagem
 * (actor.id) só pode ajudar UMA vez. Entre todas as ajudas registradas,
 * só a de MAIOR valor entra de fato no total - as demais ficam só
 * registradas no histórico/chat, sem somar.
 *
 * Estado de ajuda de uma mensagem fica salvo em flags.daggerheart-br.ajuda,
 * PERSISTIDO na própria ChatMessage - assim vale pra todo mundo na mesa,
 * não só pra quem clicou (diferente do dcTotaisOriginais, que é um cache
 * só de memória local, por cliente).
 *
 * Formato:
 *   {
 *     tamanhoOriginal: number,      // quantos termos a rolagem tinha ANTES
 *                                   // de qualquer ajuda - serve de "corte"
 *                                   // pra sempre reconstruir a partir da
 *                                   // base limpa, nunca empilhar ajuda em
 *                                   // cima de ajuda.
 *     ajudas: {
 *       [actorId]: { nome, faces, resultado, total }
 *     }
 *   }
 */

const PA_TIPOS_AJUDAVEIS = ['dualityRoll', 'adversaryRoll'];

function paObterRolagemPrincipal(message) {
    if (!PA_TIPOS_AJUDAVEIS.includes(message.type)) return null;
    if (!message.system?.hasRoll) return null;
    // message.rolls[0] é a instância REAL (DualityRoll/D20Roll) - é nela que
    // .terms/.total vivem de verdade. Diferente de system.damage.*, que são
    // objetos separados (tratados na seção de Dano/Cura acima).
    return message.rolls?.[0] ?? null;
}

function paObterEstadoAjuda(message) {
    const salvo = message.getFlag(DC_MODULE_ID, 'ajuda');
    return salvo ? foundry.utils.deepClone(salvo) : null;
}

/**
 * Reconstroi um termo de dado "congelado" (já resolvido) a partir dos dados
 * salvos em flags - usado quando o MELHOR resultado entre as ajudas não é
 * o da rolagem que acabou de ser feita nesta chamada (a instância viva do
 * dado de uma ajuda anterior não existe mais, só os dados persistidos).
 * `_evaluated = true` é necessário pra `.total` (getter de DiceTerm) voltar
 * um número em vez de `undefined`.
 */
function paReconstruirTermoAjuda(dadosAjuda) {
    const faces = Number(dadosAjuda.faces.replace('d', ''));
    const dado = new foundry.dice.terms.Die({ faces, number: 1 });
    dado.results = [{ result: dadosAjuda.resultado, active: true }];
    dado._evaluated = true;
    return dado;
}

function paInjetarBotao(message, html) {
    const rolagem = paObterRolagemPrincipal(message);
    if (!rolagem) return;

    // TESTE: seletor da seção de rolagem ainda não confirmado contra o HBS
    // real (só tínhamos ".roll-part.damage-section" documentado). Se o
    // botão não aparecer, inspeciona (F12) o card e ajusta esse seletor pro
    // container que envolve os dados de Esperança/Medo clicáveis.
    const secaoRolagem = html.querySelector('.roll-part.roll-section, .roll-part:not(.damage-section)');
    if (!secaoRolagem) return;
    if (secaoRolagem.querySelector('.pa-buttons-row')) return;

    const cabecalho = secaoRolagem.querySelector('.roll-part-header');
    if (!cabecalho) return;

    const linha = document.createElement('div');
    linha.classList.add('pa-buttons-row');

    const actor = game.user.character;
    const estado = paObterEstadoAjuda(message);
    const jaAjudou = !!(actor && estado?.ajudas?.[actor.id]);

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.classList.add('pa-btn');
    botao.disabled = jaAjudou;
    botao.title = jaAjudou ? `${actor.name} já prestou ajuda nesta rolagem` : 'Prestar Ajuda';
    botao.setAttribute('aria-label', botao.title);
    botao.innerHTML = jaAjudou
        ? `<i class="fa-solid fa-hands-holding-circle"></i> Ajudou`
        : `<i class="fa-solid fa-hands-holding-circle"></i> Ajudar`;

    if (!jaAjudou) {
        botao.addEventListener('click', event => {
            event.stopPropagation();
            paAbrirDialogoAjuda(message);
        });
    }

    linha.append(botao);
    cabecalho.after(linha);

    // Se já houve alguma ajuda nesta rolagem, mostra um resuminho logo
    // abaixo do botão pra deixar claro qual valor está valendo.
    if (estado?.ajudas && Object.keys(estado.ajudas).length) {
        const melhor = Object.values(estado.ajudas).reduce((a, b) => (b.total > a.total ? b : a));
        const resumo = document.createElement('div');
        resumo.classList.add('pa-resumo');
        resumo.textContent =
            Object.keys(estado.ajudas).length === 1
                ? `${melhor.nome} ajudou com 1${melhor.faces} (+${melhor.total})`
                : `Vale a maior ajuda: ${melhor.nome}, 1${melhor.faces} (+${melhor.total})`;
        linha.after(resumo);
    }
}

async function paAbrirDialogoAjuda(message) {
    const actor = game.user.character;
    if (!actor) {
        return ui.notifications.warn('Você precisa ter um personagem atribuído para Prestar Ajuda.');
    }

    const estadoAtual = paObterEstadoAjuda(message);
    if (estadoAtual?.ajudas?.[actor.id]) {
        return ui.notifications.warn(`${actor.name} já prestou ajuda nesta rolagem.`);
    }

    const esperancaAtual = actor.system.resources?.hope?.value ?? 0;
    if (esperancaAtual < 1) {
        return ui.notifications.warn(`${actor.name} não tem Esperança suficiente para ajudar.`);
    }

    const dadosDisponiveis = ['d4', 'd6', 'd8', 'd10', 'd12'];
    const opcoes = dadosDisponiveis.map(d => `<option value="${d}">${d}</option>`).join('');

    const faces = await foundry.applications.api.DialogV2.wait({
        window: { title: 'Prestar Ajuda' },
        content: `
            <p>${actor.name} vai gastar uma Esperança para ajudar.</p>
            <p>
                <label for="pa-dado">Dado de ajuda:</label>
                <select id="pa-dado" name="pa-dado">${opcoes}</select>
            </p>
        `,
        buttons: [
            {
                action: 'ajudar',
                label: 'Ajudar',
                default: true,
                callback: (event, button) => button.form.elements['pa-dado'].value
            },
            { action: 'cancel', label: 'Cancelar', callback: () => null }
        ],
        rejectClose: false
    });

    if (!faces) return;

    await paAplicarAjuda(message, actor, faces);
}

async function paAplicarAjuda(message, actor, faces) {
    const rolagem = paObterRolagemPrincipal(message);
    if (!rolagem) return;

    // Recarrega o estado na hora de aplicar (não só na hora de abrir o
    // diálogo) - proteção extra contra dois cliques quase simultâneos da
    // mesma pessoa em clientes diferentes.
    const estadoSalvo = paObterEstadoAjuda(message);
    const estado = estadoSalvo ?? { tamanhoOriginal: rolagem.terms.length, ajudas: {} };

    if (estado.ajudas[actor.id]) {
        return ui.notifications.warn(`${actor.name} já prestou ajuda nesta rolagem.`);
    }

    const esperancaAtual = actor.system.resources?.hope?.value ?? 0;
    if (esperancaAtual < 1) {
        return ui.notifications.warn(`${actor.name} não tem Esperança suficiente para ajudar.`);
    }
    await actor.update({ 'system.resources.hope.value': esperancaAtual - 1 });

    const rolagemAjuda = await new Roll(`1${faces}`).evaluate();
    if (game.dice3d) {
        await game.dice3d.showForRoll(rolagemAjuda, game.user, true);
    }
    const termoDado = rolagemAjuda.terms[0];

    estado.ajudas[actor.id] = {
        nome: actor.name,
        faces,
        resultado: termoDado.results[0].result,
        total: termoDado.total
    };

    // Entre TODAS as ajudas já registradas (uma por pessoa), só a de maior
    // valor é embutida na rolagem principal.
    const melhor = Object.values(estado.ajudas).reduce((a, b) => (b.total > a.total ? b : a));
    const melhorEhAAtual = melhor === estado.ajudas[actor.id];
    const melhorTermo = melhorEhAAtual ? termoDado : paReconstruirTermoAjuda(melhor);

    // Sempre reconstroi a partir dos termos ORIGINAIS (antes de qualquer
    // ajuda) + o melhor termo atual - nunca empilha em cima do que uma
    // ajuda anterior (pior) já tinha deixado ali.
    const termosBase = rolagem.terms.slice(0, estado.tamanhoOriginal);
    rolagem.terms = [
        ...termosBase,
        new foundry.dice.terms.OperatorTerm({ operator: '+' }),
        melhorTermo
    ];

    let novoTotal = 0;
    let sinal = 1;
    for (const termo of rolagem.terms) {
        if (termo instanceof foundry.dice.terms.OperatorTerm) {
            sinal = termo.operator === '-' ? -1 : 1;
        } else if (typeof termo.total === 'number') {
            novoTotal += sinal * termo.total;
        } else if (typeof termo.number === 'number') {
            novoTotal += sinal * termo.number;
        }
    }
    rolagem._total = novoTotal;
    rolagem._formula = foundry.dice.Roll.getFormula(rolagem.terms);

    await message.update({
        rolls: [rolagem.toJSON()],
        [`flags.${DC_MODULE_ID}.ajuda`]: estado
    });

    const resumoAjudantes = Object.values(estado.ajudas)
        .map(a => `${a.nome} (1${a.faces} = ${a.total})`)
        .join(', ');

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content:
            `<b>${actor.name}</b> prestou ajuda com 1${faces} (${termoDado.total}), gastando 1 Esperança.<br>` +
            `<i>Ajudas nesta rolagem: ${resumoAjudantes}. Vale a maior: <b>+${melhor.total}</b> (1${melhor.faces}, ${melhor.nome}).</i>`
    });
}