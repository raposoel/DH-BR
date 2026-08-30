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
 * cada alvo, sem passar pelo workflow/applyDamage nativo.
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

    await ChatMessage.create({
        type: 'systemMessage',
        user: game.user.id,
        speaker: message.speaker,
        title: game.i18n.localize('DAGGERHEART.UI.Chat.damageSummary.title'),
        content
    });
}

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
        true
    );
}

async function dcEscolherAcaoDado(message, dadoEl, pularConfirmacao) {
    const { dice, result, damageType } = dadoEl.dataset;
    const isResource = dadoEl.dataset.isResource === 'true';

    if (dice === undefined || result === undefined) return;

    if (pularConfirmacao) {
        return dcRerolarDado(message, isResource, damageType, dice, result);
    }

    const escolha = await foundry.applications.api.DialogV2.wait({
        window: { title: 'Dado' },
        content: '<p>O que você quer fazer com esse dado?</p>',
        buttons: [
            { action: 'reroll', label: 'Rerolar', callback: () => 'reroll' },
            { action: 'double', label: 'Dobrar', callback: () => 'double' },
            { action: 'addOne', label: 'Rolar +1', callback: () => 'addOne' }
        ],
        rejectClose: false
    });

    if (escolha === 'reroll') {
        await dcRerolarDado(message, isResource, damageType, dice, result);
    } else if (escolha === 'double') {
        await dcDobrarDado(message, isResource, damageType, dice, result);
    } else if (escolha === 'addOne') {
        await dcRolarMaisUm(message, isResource, damageType, dice);
    }
}

function dcObterTermosDeDado(rollObj) {
    return (rollObj?.terms ?? []).filter(t => Array.isArray(t?.results));
}

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

async function dcRerolarDado(message, isResource, damageType, dice, result) {
    const sys = message.system;
    const rollAlvo = isResource ? sys.damage.resources[damageType] : sys.damage.main;
    if (!rollAlvo) return;

    const termos = dcObterTermosDeDado(rollAlvo);
    const termo = termos[Number(dice)];
    const resultado = termo?.results?.[Number(result)];
    if (!termo || !resultado) return;

    resultado.active = false;
    const novaFace = Math.ceil(CONFIG.Dice.randomUniform() * termo.faces);
    termo.results.push({ result: novaFace, active: true, rerolled: true });

    dcRecalcularTotal(rollAlvo);

    const updatePath = isResource ? `system.damage.resources.${damageType}` : 'system.damage.main';
    await message.update({ [updatePath]: rollAlvo });
}

async function dcDobrarDado(message, isResource, damageType, dice, result) {
    const sys = message.system;
    const rollAlvo = isResource ? sys.damage.resources[damageType] : sys.damage.main;
    if (!rollAlvo) return;

    const termos = dcObterTermosDeDado(rollAlvo);
    const termo = termos[Number(dice)];
    const resultado = termo?.results?.[Number(result)];
    if (!termo || !resultado) return;

    const copia = foundry.utils.deepClone(resultado);
    termo.results.splice(Number(result) + 1, 0, copia);

    dcRecalcularTotal(rollAlvo);

    const updatePath = isResource ? `system.damage.resources.${damageType}` : 'system.damage.main';
    await message.update({ [updatePath]: rollAlvo });
}

async function dcRolarMaisUm(message, isResource, damageType, dice) {
    const sys = message.system;
    const rollAlvo = isResource ? sys.damage.resources[damageType] : sys.damage.main;
    if (!rollAlvo) return;

    const termos = dcObterTermosDeDado(rollAlvo);
    const termo = termos[Number(dice)];
    if (!termo) return;

    const novaFace = Math.ceil(CONFIG.Dice.randomUniform() * termo.faces);
    termo.results.push({ result: novaFace, active: true });

    dcRecalcularTotal(rollAlvo);

    const updatePath = isResource ? `system.damage.resources.${damageType}` : 'system.damage.main';
    await message.update({ [updatePath]: rollAlvo });
}


/* ==========================================================================
 * PRESTAR AJUDA
 * ========================================================================== */

const PA_TIPOS_AJUDAVEIS = ['dualityRoll', 'adversaryRoll'];

function paObterRolagemPrincipal(message) {
    if (!PA_TIPOS_AJUDAVEIS.includes(message.type)) return null;
    if (!message.system?.hasRoll) return null;
    return message.rolls?.[0] ?? null;
}

function paInjetarBotao(message, html) {
    const rolagem = paObterRolagemPrincipal(message);
    if (!rolagem) return;

    const secaoRolagem = html.querySelector('.roll-part.roll-section, .roll-part:not(.damage-section)');
    if (!secaoRolagem) return;
    if (secaoRolagem.querySelector('.pa-buttons-row')) return;

    const cabecalho = secaoRolagem.querySelector('.roll-part-header');
    if (!cabecalho) return;

    const linha = document.createElement('div');
    linha.classList.add('pa-buttons-row');

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.classList.add('pa-btn');
    botao.title = 'Prestar Ajuda';
    botao.setAttribute('aria-label', 'Prestar Ajuda');
    botao.innerHTML = `<i class="fa-solid fa-hands-holding-circle"></i> Ajudar`;
    botao.addEventListener('click', event => {
        event.stopPropagation();
        paAbrirDialogoAjuda(message);
    });

    linha.append(botao);
    cabecalho.after(linha);
}

async function paAbrirDialogoAjuda(message) {
    const actor = game.user.character;
    if (!actor) {
        return ui.notifications.warn('Você precisa ter um personagem atribuído para Prestar Ajuda.');
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

    rolagem.terms.push(
        new foundry.dice.terms.OperatorTerm({ operator: '+' }),
        termoDado
    );

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

    await message.update({ rolls: [rolagem.toJSON()] });

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<b>${actor.name}</b> prestou ajuda com 1${faces} (+${termoDado.total}), gastando 1 Esperança.`
    });
}