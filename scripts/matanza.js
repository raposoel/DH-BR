/**
 * "Dado de Matança" — homebrew ao estilo do Rally (Bardo), via Opção B (libWrapper).
 *
 * v2: corrigido depois de conferir o rollSelection.hbs real do sistema.
 *
 * Descoberta importante: no diálogo de ATAQUE/AÇÃO (D20RollDialog), o Rally não passa
 * por config.modifiers (isso é só usado no diálogo de DANO). Em vez disso, o campo do
 * select é nomeado "roll.dice._rallyIndex", e o handler nativo do sistema
 * (D20RollDialog.updateRollConfiguration) faz:
 *
 *     this.roll = foundry.utils.mergeObject(this.roll, rest.roll.dice);
 *
 * ou seja, qualquer campo "roll.dice.<algo>" é copiado direto pra propriedade
 * homônima na instância da Roll. Por isso o Dado de Matança agora usa
 * "roll.dice._matanzaIndex" — pra cair automaticamente nesse mesmo mecanismo nativo,
 * sem precisar reimplementar nenhum handler de formulário.
 *
 * Comportamento:
 *  - Some junto na rolagem de ataque/ação (DualityRoll), empilhando com o Rally nativo.
 *  - É sempre 1d6 (não tem escolha de face).
 *  - É consumível: o Active Effect que concede o dado é apagado do ator depois que a
 *    rolagem é resolvida.
 *
 * REQUISITO: módulo "lib-wrapper" tem que estar ativo no mundo.
 *
 * Como conceder o "Dado de Matança" a um personagem (teste rápido, no console):
 *
 *   const actor = game.actors.getName("Nome do Personagem");
 *   await actor.createEmbeddedDocuments('ActiveEffect', [{
 *       name: 'Dado de Matança',
 *       img: 'icons/skills/melee/strike-slashes-red.webp',
 *       changes: [{
 *           key: 'flags.daggerheart-br.matanzaDie',
 *           mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
 *           value: 'true' // valor não é lido — a face é sempre d6
 *       }]
 *   }]);
 *
 * Depois disso, abra o diálogo de uma rolagem de ataque/ação desse personagem: a linha
 * "Dado de Matança" deve aparecer logo abaixo do Rally (ou no lugar do Rally, se o
 * personagem não tiver Rally). Ao concluir a rolagem usando ele, o Active Effect some
 * sozinho do ator.
 */

import { normalizarElementoRaiz } from './utils.js';

const MODULE_ID = 'daggerheart-br';
const MATANZA_CHANGE_KEY = `flags.${MODULE_ID}.matanzaDie`;

/**
 * "Dano Extra Mágico" / "Dano Extra Físico" — bônus de dano tipado, genérico,
 * disponível em QUALQUER rolagem de dano (não depende de sucesso, Medo, nem do
 * tipo de dano da arma/ataque que originou a rolagem).
 *
 * v2 (redesenhado): em vez de ser automático (gatilho de "sucesso com Medo"),
 * agora é um chip TOGGLE na seção "Efeitos" do próprio diálogo de dano nativo
 * (a mesma UI que já existe pra outros bônus condicionais) — o jogador decide,
 * na hora de rolar o dano, se quer ligar ou não.
 *
 * Como isso é ligado na UI nativa: bonusEffectBuilder() (rodado sozinho na
 * construção de toda DamageRoll) só transforma um Active Effect num chip
 * clicável se algum change dele bater com uma das chaves retornadas por
 * getActionChangeKeys(). Nativamente essas chaves são amarradas ao tipo de
 * dano da ARMA (ex.: só mostra bônus "damage.physical" se a arma for física).
 * Nós então extendemos getActionChangeKeys() pra SEMPRE incluir nossas duas
 * flags, então o chip aparece não importa o tipo da arma.
 *
 * O estado inicial do chip (marcado/desmarcado) já vem de graça do sistema:
 * bonusEffectBuilder() usa `selected: !effect.disabled` — ou seja, quem
 * decide se nasce marcado é o próprio Active Effect (habilitado ou não na
 * ficha), igual qualquer outro efeito nativo. Não hardcodamos nada aqui.
 *
 * Chaves de Active Effect (Tipo do change: "Adicionar"):
 *   flags.daggerheart-br.extraMagic     — soma como dano MÁGICO extra
 *   flags.daggerheart-br.extraPhysical  — soma como dano FÍSICO extra
 *
 * Valor: número bruto ("3"), dado ("1d10") ou fórmula ("2d6+1") — resolvido
 * pelo mesmo getBonus()/getChangeValue() nativo que os outros bônus de dano
 * do sistema já usam, sem parser próprio.
 *
 * Comportamento do resultado (decidido depois de conferir como o Daggerheart
 * calcula resistência — ele trata a rolagem como UM bloco só, e só considera
 * o alvo resistente/imune se ele for resistente/imune a TODOS os tipos da
 * lista ao mesmo tempo; não existe divisão "essa parte é física, essa parte
 * é mágica" dentro do mesmo total, ao contrário de sistemas D20 como
 * Tormenta20). Por isso, deliberadamente NÃO fizemos um sistema de resistência
 * por tipo aqui — o valor:
 *   - soma no total (não vira uma rolagem/subtotal separado);
 *   - adiciona o próprio tipo (físico ou mágico) à lista de tipos da
 *     rolagem — então, se a arma é física e o efeito é "Dano Extra Mágico",
 *     a rolagem final passa a carregar físico E mágico juntos.
 * Consequência aceita: como a checagem de resistência é "E lógico" entre
 * todos os tipos, misturar tipos deixa a resistência MAIS difícil de valer
 * (só reduz se o alvo for resistente aos dois ao mesmo tempo) — isso é o
 * comportamento nativo do sistema, não um bug nosso.
 *
 * Se o personagem tiver mais de um efeito ativo com a mesma flag, todos os
 * que estiverem marcados (selected) são somados — mesmo getBonus() nativo
 * que soma bônus nativos de mais de uma fonte.
 *
 * NÃO é consumível — é um bônus permanente/reutilizável (feature passiva),
 * ao contrário do Dado de Matança.
 *
 * Como conceder (teste rápido, no console):
 *
 *   const actor = game.actors.getName("Nome do Personagem");
 *   await actor.createEmbeddedDocuments('ActiveEffect', [{
 *       name: 'Runas Arcanas',
 *       img: 'icons/magic/unholy/orb-swirling-teal.webp',
 *       changes: [{
 *           key: 'flags.daggerheart-br.extraMagic',
 *           mode: CONST.ACTIVE_EFFECT_MODES.ADD,
 *           value: '1d10'
 *       }]
 *   }]);
 *
 * Depois disso, ao abrir QUALQUER diálogo de rolagem de dano desse
 * personagem, "Runas Arcanas" aparece como chip na seção "Efeitos" (marcado
 * ou não dependendo de effect.disabled). Clicando pra ligar, o 1d10 soma no
 * total e "mágico" entra na lista de tipos da rolagem.
 */
const EXTRA_MAGIC_KEY = `flags.${MODULE_ID}.extraMagic`;
const EXTRA_PHYSICAL_KEY = `flags.${MODULE_ID}.extraPhysical`;

/**
 * "Experiência Usa Estresse" — ACRESCENTA um custo em Estresse ao marcar uma
 * Experiência (no diálogo de rolagem de ataque/ação, D20RollDialog), ao lado
 * do custo nativo em Esperança/Medo — os dois aparecem juntos na seção
 * "Custo" do diálogo, só para quem tiver o poder correspondente. NÃO troca/
 * substitui o custo nativo; o de Esperança continua cobrado do jeito de
 * sempre, e o de Estresse só entra se o efeito estiver na ficha.
 *
 * Descoberta 1: em D20RollDialog.selectExperience (o handler do botão de
 * Experiência), o custo adicionado é sempre hardcoded assim:
 *
 *     key: this.config?.data?.parent?.isNPC ? 'fear' : 'hope'
 *
 * ou seja, não existe nenhuma opção nativa (nem de sistema, nem de
 * automação) pra somar outro recurso aqui. 'stress' já é uma chave válida
 * de custo (existe em CONFIG.DH.GENERAL.abilityCosts), então dá pra
 * reaproveitá-la sem inventar recurso novo. `CostField.getRealCosts`
 * (nativo) soma custos que têm a MESMA key — como 'hope' e 'stress' são
 * chaves diferentes, adicionar os dois faz o diálogo mostrar duas linhas de
 * custo separadas, em vez de somar num valor só.
 *
 * Descoberta 2 (a mais cara de achar): um `libWrapper.register('WRAPPER')`
 * comum em `D20RollDialog.selectExperience` SIMPLESMENTE NÃO FUNCIONA aqui,
 * mesmo sem erro nenhum no console. Motivo: `selectExperience` não é um
 * método normal — é uma *action* de ApplicationV2, registrada assim na
 * classe:
 *
 *     static DEFAULT_OPTIONS = { actions: { selectExperience: this.selectExperience } }
 *
 * Essa linha roda UMA VEZ, no momento em que a classe `D20RollDialog` é
 * definida (quando o `daggerheart.js` do sistema carrega) — ou seja, ela
 * guarda a referência da função ORIGINAL dentro do objeto `actions` antes
 * de qualquer módulo (inclusive este) ter rodado seu `Hooks.once('init')`.
 * Um `libWrapper.register` depois disso troca a propriedade
 * `D20RollDialog.selectExperience` na classe, mas o dispatcher de ações do
 * ApplicationV2 nunca olha pra lá de novo: ele já tem a função antiga
 * guardada em `DEFAULT_OPTIONS.actions.selectExperience` e é ESSA cópia que
 * é chamada quando o botão é clicado. Resultado: o wrapper existe, nunca dá
 * erro, mas também nunca roda.
 *
 * A correção é não usar libWrapper pra isso e, em vez disso, sobrescrever
 * `DEFAULT_OPTIONS.actions.selectExperience` diretamente — desde que isso
 * aconteça ANTES do primeiro diálogo ser aberto (por isso dentro do
 * `Hooks.once('init')`, junto com o resto). Cada novo `D20RollDialog` lê o
 * `actions` de `DEFAULT_OPTIONS` na hora de ser construído, então a partir
 * do momento em que sobrescrevemos essa propriedade, toda instância nova já
 * nasce com a nossa versão. Guardamos a função nativa numa variável antes
 * de sobrescrever, e chamamos ela manualmente lá dentro — mesmo efeito de
 * um WRAPPER, só que aplicado no lugar certo.
 *
 * NÃO é consumível — é uma característica permanente do poder, igual ao
 * Dano Extra Mágico/Físico (fica ligado enquanto o efeito existir na
 * ficha).
 *
 * Como conceder (teste rápido, no console):
 *
 *   const actor = game.actors.getName("Nome do Personagem");
 *   await actor.createEmbeddedDocuments('ActiveEffect', [{
 *       name: 'Fúria Implacável',
 *       img: 'icons/skills/emotion/expression-anger-fury.webp',
 *       changes: [{
 *           key: 'flags.daggerheart-br.expUsaEstresse',
 *           mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
 *           value: 'true' // valor não é lido — é só a presença do change que conta
 *       }]
 *   }]);
 *
 * Depois disso, ao marcar uma Experiência na rolagem de ataque/ação desse
 * personagem, aparecem DUAS linhas de custo: Esperança (ou Medo, se NPC) —
 * visível mas DESMARCADA por padrão — e Estresse, marcada. Só o Estresse é
 * efetivamente cobrado ao rolar, a menos que o jogador marque a Esperança
 * manualmente também (o checkbox continua ali, funcional).
 */
const EXP_STRESS_KEY = `flags.${MODULE_ID}.expUsaEstresse`;

/**
 * "Estresse Dobra Bônus da Experiência" — quando a Experiência é marcada
 * pagando Estresse (ou seja, só faz sentido combinado com EXP_STRESS_KEY
 * acima), o bônus dela (o "+2" que soma na rolagem) entra em dobro na
 * fórmula, em vez de uma vez só.
 *
 * Descoberta: em D20Roll.configureModifiers (a classe base da rolagem, não
 * o diálogo), o bônus de cada Experiência marcada é somado assim:
 *
 *     for (const m of this.options.experiences?.filter(m => !!actorExperiences[m]) ?? [])
 *         this.options.roll.modifiers.push({ label: ..., value: actorExperiences[m].value });
 *
 * ou seja, o sistema faz um `for` direto no array `this.options.experiences`
 * (a lista de ids das Experiências marcadas) — se o MESMO id aparecer
 * duas vezes nesse array, o `for` roda duas vezes pra ele, somando o bônus
 * duas vezes. Não precisamos reimplementar a soma nem interceptar a
 * construção da fórmula: só precisamos fazer o id aparecer duplicado em
 * `this.config.experiences` (do diálogo) quando as duas flags baterem — o
 * resto (inclusive a fórmula final e o texto do bônus na rolagem) sai
 * certo sozinho, pelo mesmo código nativo.
 *
 * A duplicata é limpa sozinha ao desmarcar: o toggle nativo de
 * `selectExperience` usa `this.config.experiences.filter(x => x !== id)`
 * pra desmarcar, que remove TODAS as ocorrências do id de uma vez — não só
 * uma. Não precisamos de nenhuma lógica extra de limpeza aqui.
 *
 * NÃO é consumível — permanente enquanto o efeito existir na ficha, igual
 * às outras flags "passivas" deste arquivo (Dano Extra, Experiência Usa
 * Estresse).
 *
 * Como conceder (teste rápido, no console) — normalmente concedido
 * JUNTO com EXP_STRESS_KEY, no mesmo Active Effect (o mesmo poder que faz
 * a Experiência custar Estresse também dobra o bônus dela):
 *
 *   const actor = game.actors.getName("Nome do Personagem");
 *   await actor.createEmbeddedDocuments('ActiveEffect', [{
 *       name: 'Fúria Implacável',
 *       img: 'icons/skills/emotion/expression-anger-fury.webp',
 *       changes: [
 *           {
 *               key: 'flags.daggerheart-br.expUsaEstresse',
 *               mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
 *               value: 'true'
 *           },
 *           {
 *               key: 'flags.daggerheart-br.expEstresseDobraBonus',
 *               mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
 *               value: 'true'
 *           }
 *       ]
 *   }]);
 *
 * Depois disso, ao marcar uma Experiência desse personagem, ela custa
 * Estresse (ver EXP_STRESS_KEY) E o bônus dela entra em dobro na fórmula.
 * Se o efeito tiver só EXP_STRESS_DOUBLE_KEY sem EXP_STRESS_KEY, nada
 * acontece — não existe "dobrar sem usar Estresse" neste desenho.
 */
const EXP_STRESS_DOUBLE_KEY = `flags.${MODULE_ID}.expEstresseDobraBonus`;

/**
 * "Range de Arma Customizado" — sobrescreve o alcance (range) da ação de
 * ataque BASE de qualquer arma equipada, não importa o range original dela.
 *
 * Valores aceitos (número de 1 a 5, texto):
 *   1 = Adjacente   (melee)
 *   2 = Muito Próximo (veryClose)
 *   3 = Próximo     (close)
 *   4 = Distante    (far)
 *   5 = Muito Distante (veryFar)
 *
 * Descoberta: o range de uma arma vive em `attack.range` da action de ataque
 * base da arma (`DHWeapon.system.attack`, uma instância de DHAttackAction —
 * mesma classe usada por qualquer ataque, não só o base). Essa action é
 * recalculada em `DHAttackAction.prototype.prepareData()` toda vez que os
 * embedded documents do item são preparados, então interceptar esse método
 * (via WRAPPER) garante que a mudança aparece sempre que a ficha/ator for
 * recalculado — sem precisar mexer em nenhum outro lugar do fluxo de ataque.
 *
 * Só se aplica quando a action pertence a uma arma (`this.item?.type ===
 * 'weapon'`) — isso deixa de fora ataques de spellcast/domain card, cujo
 * range normalmente já é definido pela própria carta/feature. Se um dia
 * quiser que valha pra qualquer ataque, é só remover essa checagem.
 *
 * Se houver mais de um Active Effect com essa flag ativo ao mesmo tempo, só
 * o PRIMEIRO encontrado é aplicado (diferente do Dano Extra, que soma —
 * aqui não faz sentido somar dois ranges).
 *
 * Isso só troca a ETIQUETA/valor de range usado pelo sistema (o que aparece
 * no card de chat, no ataque em grupo, etc.) — o Daggerheart não impede
 * fisicamente um ataque fora do alcance declarado; alcance é mais uma
 * convenção narrativa/tag do que uma trava mecânica.
 *
 * NÃO é consumível — permanente enquanto o efeito existir na ficha, igual
 * às outras flags "passivas" deste arquivo.
 *
 * Como conceder (teste rápido, no console):
 *
 *   const actor = game.actors.getName("Nome do Personagem");
 *   await actor.createEmbeddedDocuments('ActiveEffect', [{
 *       name: 'Alcance Estendido',
 *       img: 'icons/skills/ranged/arrow-flying-broadhead-metal.webp',
 *       changes: [{
 *           key: 'flags.daggerheart-br.rangeArma',
 *           mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
 *           value: '4' // Distante
 *       }]
 *   }]);
 */
const RANGE_ARMA_KEY = `flags.${MODULE_ID}.rangeArma`;

const RANGE_ARMA_MAP = {
    '1': 'melee',
    '2': 'veryClose',
    '3': 'close',
    '4': 'far',
    '5': 'veryFar'
};

/**
 * "Range de Arma Customizado — Incremento" — variante que NÃO sobrescreve o
 * alcance pra um valor absoluto; em vez disso, SOMA N passos ao alcance que
 * a arma já tiver (nativo, ou já sobrescrito por RANGE_ARMA_KEY acima, se as
 * duas flags estiverem no mesmo Ator), subindo/descendo na escala:
 *
 *   melee -> veryClose -> close -> far -> veryFar
 *
 * Valor aceito: número inteiro (positivo sobe passos, negativo desce).
 * Resultado sempre travado nas pontas da escala — nunca desce além de
 * "melee" nem sobe além de "veryFar" — mesmo espírito do travamento do
 * Limiar Extra.
 *
 * Se houver mais de um Active Effect com essa flag ativo ao mesmo tempo, os
 * valores SOMAM (diferente da sobrescrita acima, que só aplica o primeiro
 * encontrado — aqui faz sentido somar incrementos, igual ao Dano Extra e ao
 * Limiar Extra).
 *
 * Se o alcance atual da arma (antes deste incremento) não estiver na escala
 * acima — ex.: uma action com range "self" — a flag não faz nada nela, já
 * que não há "passo" pra calcular a partir de um alcance fora da escala.
 *
 * NÃO é consumível — permanente enquanto o efeito existir na ficha, igual às
 * outras flags "passivas" deste arquivo.
 *
 * Como conceder (teste rápido, no console):
 *
 *   const actor = game.actors.getName("Nome do Personagem");
 *   await actor.createEmbeddedDocuments('ActiveEffect', [{
 *       name: 'Alcance +1 Passo',
 *       img: 'icons/skills/ranged/arrow-flying-broadhead-metal.webp',
 *       changes: [{
 *           key: 'flags.daggerheart-br.rangeArmaBonus',
 *           mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
 *           value: '1' // sobe 1 passo na escala de alcance
 *       }]
 *   }]);
 */
const RANGE_ARMA_BONUS_KEY = `flags.${MODULE_ID}.rangeArmaBonus`;
const RANGE_ARMA_ORDER = Object.values(RANGE_ARMA_MAP); // ['melee','veryClose','close','far','veryFar']

/**
 * "Tipo de Dano Forçado" — sobrescreve o(s) tipo(s) de dano de uma rolagem de
 * dano (`physical`/`magical`) pelo valor configurado na flag, não importa o
 * que estava marcado originalmente na arma/ação.
 *
 * Valores aceitos (string, uma letra):
 *   "f" = força o dano a ser considerado Físico  (physical)
 *   "m" = força o dano a ser considerado Mágico  (magical)
 *
 * Funciona nas duas direções: se o dano originalmente é Físico e a flag diz
 * "m", vira Mágico; se o dano é Mágico e a flag diz "f", vira Físico. Não é
 * uma troca automática physical<->magical — é uma sobrescrita direta pro
 * valor configurado, então também não faz nada se o dano já for do tipo pra
 * onde a flag aponta.
 *
 * Descoberta: o(s) tipo(s) de dano de uma rolagem vivem em
 * `formulaData.damageTypes` (um `Set`), construído em
 * `DamageField.formatFormulas()` a partir do `system.attack.damage.main.type`
 * (ou do dano de qualquer action de dano/ataque) ANTES da fórmula da rolagem
 * ser montada. Esse mesmo objeto (`config.damageFormula`) é reutilizado, por
 * referência, tanto pro cálculo de bônus (`applyBaseBonus`, que lê
 * `system.bonuses.damage.<tipo>`) quanto pro `options.damageTypes` final da
 * Roll avaliada — que é o que `Actor#calculateDamage`/`getResistanceStatus`
 * usam pra decidir resistência/imunidade. Por isso interceptar
 * `DamageRoll.prototype.constructFormula()` e mutar `formulaData.damageTypes`
 * ANTES de chamar o `wrapped(...)` nativo já propaga a mudança pros dois
 * lugares de uma vez, sem precisar tocar em mais nada.
 *
 * SELECIONÁVEL no diálogo de dano: aparece como chip clicável na seção
 * "Efeitos", igual o Dano Extra Mágico/Físico — não é uma sobrescrita
 * sempre-ligada. O estado inicial do chip vem do próprio Active Effect
 * (`selected: !effect.disabled`), e o jogador pode marcar/desmarcar antes de
 * rolar. Só se aplica quando o chip está MARCADO no momento da rolagem.
 *
 * DESMARCAR RESTAURA o tipo original da arma/ação (bug real encontrado e
 * corrigido): o objeto que carrega o tipo de dano é reaproveitado em toda
 * re-renderização do diálogo — se a gente só sobrescrevesse o tipo quando o
 * chip estivesse marcado, e não fizesse nada quando desmarcado, o tipo
 * original já teria sido perdido de vez na primeira vez que o chip foi
 * marcado (o Set antigo já não existe mais em lugar nenhum). Por isso o tipo
 * ORIGINAL é guardado na primeira passagem por esse código, e toda vez que o
 * chip está desmarcado, o tipo é restaurado a partir dessa cópia — nunca
 * fica "grudado" no último tipo forçado.
 *
 * Só se aplica ao parâmetro `isDamage === true` da chamada (ou seja, só ao
 * dano PRINCIPAL — `damage.main`, que é o único que carrega tipo de dano de
 * verdade; `damage.resources` — estresse, esperança, armadura — nunca tem
 * `.type`, então não há necessidade de filtrar isso à parte).
 *
 * Se houver mais de um Active Effect com essa flag marcado ao mesmo tempo,
 * só o PRIMEIRO encontrado é aplicado — igual ao Range de Arma Customizado,
 * não faz sentido "somar" dois tipos de dano forçados.
 *
 * O Active Effect em si NÃO é consumível (não é apagado ao usar) — o que
 * controla se ele tem efeito é o chip estar marcado ou não a cada rolagem,
 * igual ao Dano Extra.
 *
 * O modo do change (Custom/Sobrepor/etc.) NÃO importa pra essa flag — lemos
 * o valor direto de `change.value`/`chip.value`, sem passar pela resolução
 * nativa de modo nenhum. "Custom" é a recomendação só por convenção (mesmo
 * modo usado em todas as outras flags deste arquivo), não por necessidade.
 *
 * Como conceder (teste rápido, no console):
 *
 *   const actor = game.actors.getName("Nome do Personagem");
 *   await actor.createEmbeddedDocuments('ActiveEffect', [{
 *       name: 'Punhos Arcanos',
 *       img: 'icons/magic/unholy/hand-claw-fire-blue.webp',
 *       changes: [{
 *           key: 'flags.daggerheart-br.tipoDanoForcado',
 *           mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
 *           value: 'm' // qualquer dano desse personagem passa a ser Mágico
 *       }]
 *   }]);
 */
const TIPO_DANO_FORCADO_KEY = `flags.${MODULE_ID}.tipoDanoForcado`;

const TIPO_DANO_FORCADO_MAP = {
    f: 'physical',
    m: 'magical'
};

/**
 * "Limiar Extra" — faz o dano recebido pelo Ator já ser considerado 1 (ou
 * mais) limiar(es) acima do que o valor bruto normalmente indicaria.
 *
 * Descoberta: o cálculo de limiar mora inteiro num único método,
 * `DhpActor#convertDamageToThreshold(damage)`:
 *
 *     return damage >= this.system.damageThresholds.severe ? 3
 *          : damage >= this.system.damageThresholds.major ? 2
 *          : 1;
 *     // (ou 4, se "dano maciço" estiver habilitado e o dano for >= severo*2)
 *
 * Não existe, nativamente, nenhuma chave de Active Effect que empurre o
 * RESULTADO desse cálculo pra cima — só dá pra mexer nos NÚMEROS dos
 * limiares (`system.damageThresholds.major`/`.severe`, nativas), o que muda
 * o cálculo indiretamente. Esta flag faz o "+1 limiar" de verdade, direto no
 * resultado, interceptando esse método via libWrapper.
 *
 * Valor aceito: número inteiro (string), positivo. "1" = sobe um limiar
 * (Menor vira Maior, Maior vira Severo, Severo vira Maciço — se a regra
 * variante de dano maciço estiver ligada; senão trava em Severo). "2" sobe
 * dois de uma vez, etc. Resultado sempre travado entre 1 e 4 — nunca deixa
 * "subir" além de Maciço nem descer abaixo de Menor.
 *
 * Se houver mais de um Active Effect com essa flag ativo ao mesmo tempo, os
 * valores SOMAM (mesmo espírito do Dano Extra Mágico/Físico) — dois efeitos
 * de "+1" juntos equivalem a um "+2".
 *
 * NÃO é consumível — permanente enquanto o efeito existir na ficha, igual às
 * outras flags "passivas" deste arquivo. Modo do change: Custom (mesma
 * convenção das outras flags numéricas lidas direto de appliedEffects, como
 * o Range de Arma Customizado) — o valor "aplicado" pelo modo nativo não é
 * usado, só a presença do change e o `.value` bruto.
 *
 * Como conceder (teste rápido, no console):
 *
 *   const actor = game.actors.getName("Nome do Personagem");
 *   await actor.createEmbeddedDocuments('ActiveEffect', [{
 *       name: 'Marcado pela Perdição',
 *       img: 'icons/magic/unholy/silhouette-evil-horned-giant.webp',
 *       changes: [{
 *           key: 'flags.daggerheart-br.limiarBonus',
 *           mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
 *           value: '1'
 *       }]
 *   }]);
 *
 * Depois disso, qualquer dano que esse Ator sofrer é calculado como se
 * estivesse 1 limiar acima do que o valor bruto indicaria.
 */
const LIMIAR_BONUS_KEY = `flags.${MODULE_ID}.limiarBonus`;

/**
 * "Dado de Teste do Adversário" (Ataque / Reação) — troca o dado base d20
 * usado numa rolagem de ADVERSÁRIO (ou environment) por outro dado
 * qualquer, em DOIS pontos independentes:
 *
 *   - dadoAtaqueAdversario  -> só a rolagem de ATAQUE (item usando uma
 *     action do tipo 'attack')
 *   - dadoReacaoAdversario  -> só a "Rolagem de Reação" (botão da própria
 *     ficha do Adversário, DhAdversarySheet.#reactionRoll)
 *
 * Descoberta: quem decide qual classe de Roll um Ator usa é
 * `DhActor#get rollClass()`:
 *
 *     get rollClass() {
 *         return CONFIG.Dice.daggerheart[
 *             ['character', 'companion'].includes(this.type) ? 'DualityRoll' : 'D20Roll'
 *         ];
 *     }
 *
 * Só 'character' e 'companion' rolam DualityRoll (Esperança/Medo). TODO o
 * resto — inclusive 'adversary' e 'environment' — cai em D20Roll puro. E
 * D20Roll.createBaseDice() é o ÚNICO lugar do sistema que decide a face do
 * dado base, sempre hardcoded pra 20:
 *
 *     createBaseDice() {
 *         if (this.terms[0] instanceof foundry.dice.terms.Die) { ... return; }
 *         this.terms[0] = new foundry.dice.terms.Die({ faces: 20 });
 *     }
 *
 * Não existe, nativamente, NENHUMA ficha/setting que troque isso — nem por
 * Adversário, nem por tipo de teste. Por isso interceptamos esse método via
 * libWrapper e, depois de deixar o wrapped() nativo criar o d20 normal,
 * sobrescrevemos a face usando o PRÓPRIO setter `d20` que a classe já expõe
 * (ver comentário anterior sobre D20Roll neste arquivo) — ele já resolve
 * tanto número quanto string ("12" ou "d12") via `getFaces()`, então não
 * precisamos reimplementar esse parsing.
 *
 * Como sabemos se é ATAQUE ou REAÇÃO: reaproveitamos os MESMOS campos que o
 * próprio D20Roll já lê internamente pra outra finalidade (bônus por tipo de
 * rolagem, linha ~44537 do sistema): `this.options.roll.type === 'attack'`
 * pra ataque. A Rolagem de Reação não tem um `roll.type` próprio (ela usa
 * 'trait', mesmo id do teste de atributo de personagem) — o que a distingue
 * é `this.options.actionType === 'reaction'`, campo que o botão
 * #reactionRoll da ficha do Adversário sempre manda.
 *
 * O Ator dono da rolagem é lido de `this.data?.parent` — mesma convenção já
 * usada no restante deste arquivo (ver Dado de Matança e Hooks.on
 * renderD20RollDialog, onde `D20RollDialog.actor` é literalmente
 * `this.config?.data?.parent`).
 *
 * Valor aceito: número de faces (string ou number, ex. "12" ou 12) OU
 * string no formato "d12" — os dois passam por getFaces() sem diferença.
 *
 * Se houver mais de um Active Effect com a MESMA flag ativo ao mesmo tempo,
 * só o PRIMEIRO encontrado é aplicado (não faz sentido "somar" dois dados
 * diferentes — mesmo espírito do Range de Arma). As duas flags (Ataque e
 * Reação) são independentes entre si e podem conviver no mesmo Ator sem
 * conflito, já que cada uma só é lida no ramo (attack/reaction) certo.
 *
 * Só se aplica a rolagens cujo Ator NÃO seja 'character' nem 'companion'
 * (ou seja, exatamente os que caem em D20Roll — normalmente 'adversary',
 * mas também vale pra 'environment' se algum dia ele tiver ataque/reação).
 *
 * NÃO é consumível — permanente enquanto o Active Effect existir na ficha,
 * igual às outras flags "passivas" deste arquivo.
 *
 * Como conceder (teste rápido, no console):
 *
 *   const adv = game.actors.getName("Nome do Adversário");
 *   await adv.createEmbeddedDocuments('ActiveEffect', [{
 *       name: 'Golpe Instável',
 *       img: 'icons/skills/melee/strike-slashes-red.webp',
 *       changes: [{
 *           key: 'flags.daggerheart-br.dadoAtaqueAdversario',
 *           mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
 *           value: '12' // ataque agora rola d12 em vez de d20
 *       }]
 *   }]);
 *
 * E, pra Reação, o mesmo com a chave 'flags.daggerheart-br.dadoReacaoAdversario'.
 */
const DADO_ATAQUE_ADVERSARIO_KEY = `flags.${MODULE_ID}.dadoAtaqueAdversario`;
const DADO_REACAO_ADVERSARIO_KEY = `flags.${MODULE_ID}.dadoReacaoAdversario`;

Hooks.once('init', () => {
    if (!game.modules.get('lib-wrapper')?.active) {
        console.error(
            `${MODULE_ID} | Dado de Matança requer o módulo "libWrapper" ativo. Ative-o e recarregue.`
        );
        return;
    }

    /* 1) Injeta o d6 na rolagem de ataque/ação, junto com vantagem/desvantagem/rally.
     *    this._matanzaIndex já vem preenchido sozinho pelo mergeObject nativo do
     *    sistema (ver comentário no topo do arquivo) — não precisamos setar isso na
     *    mão em nenhum outro lugar.
     */
    libWrapper.register(
        MODULE_ID,
        'game.system.api.dice.DualityRoll.prototype.applyAdvantage',
        function (wrapped, ...args) {
            wrapped(...args); // preserva vantagem/desvantagem e o Rally nativo intactos

            if (this._matanzaIndex) {
                this.terms.push(
                    new foundry.dice.terms.OperatorTerm({ operator: this.hasDisadvantage ? '-' : '+' }),
                    new foundry.dice.terms.Die({ faces: 6 })
                );
            }
        },
        'WRAPPER'
    );

    /* 2) Some com o Active Effect depois que a rolagem é avaliada (consumo único),
     *    espelhando exatamente o que o sistema já faz pro Rally.
     */
    libWrapper.register(
        MODULE_ID,
        'game.system.api.dice.DualityRoll.buildEvaluate',
        async function (wrapped, roll, config = {}, message = {}) {
            await wrapped(roll, config, message);

            if (roll._matanzaIndex && roll.data?.parent) {
                await roll.data.parent.deleteEmbeddedDocuments('ActiveEffect', [roll._matanzaIndex]);
            }
        },
        'WRAPPER'
    );

    /* 3a) Faz nossas flags aparecerem como chip clicável na seção "Efeitos"
     *     do diálogo de dano, não importa o tipo de dano da arma.
     *     Nativamente essas chaves só incluiriam bônus do MESMO tipo da arma
     *     (ex.: "system.bonuses.damage.physical" se a arma for física) — por
     *     isso extendemos em vez de deixar como está.
     */
    libWrapper.register(
        MODULE_ID,
        'game.system.api.dice.DamageRoll.prototype.getActionChangeKeys',
        function (wrapped, ...args) {
            const keys = wrapped(...args);
            keys.push(EXTRA_MAGIC_KEY, EXTRA_PHYSICAL_KEY, TIPO_DANO_FORCADO_KEY);
            return keys;
        },
        'WRAPPER'
    );

    /* 3b) Quando o chip estiver marcado, soma o valor no total E adiciona o
     *     tipo correspondente à lista de tipos da rolagem. Reaproveita
     *     this.getBonus(path, label) nativo — ele já filtra só efeitos
     *     selecionados (chip ligado), já soma mais de uma fonte, e já resolve
     *     número/dado/fórmula via DhActiveEffect.getChangeValue. Não
     *     precisamos reimplementar nada disso, só chamar com nossas chaves.
     *
     *     Sem guard de duplicação: getBonus() é uma leitura pura (não muta
     *     estado), então recalcular em cada render do diálogo (prévia da
     *     fórmula) dá sempre o resultado certo — um guard "já apliquei"
     *     travaria a prévia depois da primeira renderização.
     */
    libWrapper.register(
        MODULE_ID,
        'game.system.api.dice.DamageRoll.prototype.applyBaseBonus',
        function (wrapped, part) {
            const modifiers = wrapped(part);
            if (this.options.hasHealing) return modifiers;

            const options = part ?? this.options;

            const extraMagic = this.getBonus(EXTRA_MAGIC_KEY, 'Dano Extra Mágico');
            if (extraMagic.length) {
                modifiers.push(...extraMagic);
                options.damageTypes?.add?.('magical');
            }

            const extraPhysical = this.getBonus(EXTRA_PHYSICAL_KEY, 'Dano Extra Físico');
            if (extraPhysical.length) {
                modifiers.push(...extraPhysical);
                options.damageTypes?.add?.('physical');
            }

            return modifiers;
        },
        'WRAPPER'
    );

    /* 3c) Sobrescreve (RANGE_ARMA_KEY) e/ou incrementa (RANGE_ARMA_BONUS_KEY)
     *     o range (alcance) da action de ataque base da arma, lendo direto
     *     de appliedEffects (mesmo padrão das outras flags — o sistema não
     *     resolve sozinho o modo CUSTOM de Active Effect, então só a
     *     PRESENÇA do change é confiável, não o valor "aplicado").
     *
     *     prepareData() roda toda vez que os embedded documents do item são
     *     preparados, então isso recalcula sozinho sempre que o Active
     *     Effect for ligado/desligado, sem precisar reabrir a ficha.
     *
     *     Ordem: primeiro aplica a sobrescrita absoluta (se houver), depois
     *     soma o incremento relativo em cima do que sobrar — assim as duas
     *     flags podem coexistir no mesmo Ator sem conflito.
     */
    libWrapper.register(
        MODULE_ID,
        'game.system.api.models.actions.actionsTypes.attack.prototype.prepareData',
        function (wrapped, ...args) {
            wrapped(...args);

            if (this.item?.type !== 'weapon') return;
            if (!this.actor) return;

            const changes = (this.actor.appliedEffects ?? [])
                .flatMap(effect => effect.system.changes);

            // Sobrescrita absoluta (valor 1-5 -> range fixo, primeiro efeito vence)
            const overrideChange = changes.find(c => c.key === RANGE_ARMA_KEY);
            if (overrideChange) {
                const newRange = RANGE_ARMA_MAP[String(overrideChange.value).trim()];
                if (newRange) this.range = newRange;
            }

            // Incremento relativo (soma passos na escala de alcance)
            const steps = changes
                .filter(c => c.key === RANGE_ARMA_BONUS_KEY)
                .reduce((total, c) => total + (Number(c.value) || 0), 0);
            if (steps) {
                const currentIndex = RANGE_ARMA_ORDER.indexOf(this.range);
                if (currentIndex !== -1) {
                    const newIndex = Math.max(0, Math.min(RANGE_ARMA_ORDER.length - 1, currentIndex + steps));
                    this.range = RANGE_ARMA_ORDER[newIndex];
                }
            }
        },
        'WRAPPER'
    );

    /* 3d) Sobrescreve o(s) tipo(s) de dano (physical/magical) de uma rolagem
     *     de dano — SELECIONÁVEL como chip na seção "Efeitos" (igual o Dano
     *     Extra), não uma sobrescrita sempre-ligada. Por isso lemos de
     *     `this.options.bonusEffects` (o dado que getBonus() consulta
     *     internamente pra saber quais chips estão marcados) em vez de
     *     `appliedEffects` cru: só queremos aplicar quando o chip estiver
     *     marcado, não sempre que o Active Effect existir na ficha.
     *
     *     CONFIRMADO NA FONTE REAL DO SISTEMA (daggerheart.js,
     *     DHRoll.bonusEffectBuilder): `this.options.bonusEffects` é um objeto
     *     simples indexado por id de efeito (`acc[effect.id] = {...}`), nunca
     *     array. Cada entrada NÃO é um change isolado com `key`/`value`
     *     soltos — é o Active Effect INTEIRO ({ id, name, changes: [...],
     *     selected, origEffect, ... }), com um array `changes` contendo
     *     TODAS as mudanças daquele efeito que bateram com
     *     getActionChangeKeys(). O `key`/`value` do nosso change ficam
     *     DENTRO de `changes`, não na entrada em si — por isso o filtro
     *     abaixo primeiro pega as entradas selecionadas, depois "achata"
     *     (`flatMap`) os `changes` de todas elas, e só então procura pela
     *     nossa chave. Tudo isso roda dentro de um try/catch: se o sistema
     *     mudar esse formato numa atualização futura, a flag é ignorada
     *     naquela rolagem (com um aviso no console) em vez de quebrar TODA
     *     rolagem de dano do jogo.
     *
     *     Não reaproveitamos getBonus() aqui porque ele resolve o valor via
     *     DhActiveEffect.getChangeValue(), pensado pra número/dado/fórmula —
     *     nosso valor é a string "f"/"m" (não "physical"/"magical" — só a
     *     letra é gravada na flag, TIPO_DANO_FORCADO_MAP traduz pro nome
     *     interno do tipo), então lemos o `.value` do change casado
     *     diretamente e traduzimos pelo mapa, sem passar por essa resolução.
     *
     *     Interceptamos ANTES de chamar o wrapped() nativo, porque
     *     constructFormula() usa formulaData.damageTypes tanto pra calcular
     *     bônus de dano por tipo (system.bonuses.damage.<tipo>) quanto,
     *     depois, pro options.damageTypes final da Roll avaliada — que é o
     *     que decide resistência/imunidade em Actor#calculateDamage. Mutar
     *     o mesmo objeto antes do wrapped() propaga a mudança pros dois
     *     lugares de uma vez.
     *
     *     BUG REAL ENCONTRADO E CORRIGIDO: como `formulaData` é reaproveitado
     *     em toda re-renderização do diálogo, só sobrescrever quando o chip
     *     está marcado (sem restaurar quando desmarcado) fazia o tipo forçado
     *     "grudar" pra sempre depois da primeira vez que o chip era marcado —
     *     desmarcar não voltava ao tipo original, porque o Set original já
     *     tinha sido perdido. Por isso guardamos uma cópia do tipo original
     *     (`formulaData.matanzaOriginalDamageTypes`) na primeira passagem, e
     *     toda chamada seguinte decide entre o tipo forçado (chip marcado) ou
     *     essa cópia guardada (chip desmarcado) — nunca deixa o valor antigo
     *     perdido de vez.
     */
    libWrapper.register(
        MODULE_ID,
        'game.system.api.dice.DamageRoll.prototype.constructFormula',
        function (wrapped, formulaData, config, isDamage) {
            try {
                if (isDamage && formulaData?.damageTypes instanceof Set) {
                    // CONFIRMADO na fonte real do sistema (DHRoll.bonusEffectBuilder,
                    // daggerheart.js): this.options.bonusEffects é um objeto simples
                    // indexado por id de efeito — `acc[effect.id] = {...}` — nunca
                    // array nem Set. Cada valor é
                    // { id, name, changes: [...], selected, origEffect, ... }; o
                    // `key`/`value` do NOSSO change ficam DENTRO de `changes`, junto
                    // com quaisquer outras mudanças daquele mesmo efeito que também
                    // bateram com getActionChangeKeys() — não soltos na entrada.
                    const match = Object.values(this.options?.bonusEffects ?? {})
                        .filter(e => e?.selected)
                        .flatMap(e => (Array.isArray(e.changes) ? e.changes : []))
                        .find(c => c?.key === TIPO_DANO_FORCADO_KEY);

                    const forcedType = match
                        ? TIPO_DANO_FORCADO_MAP[String(match.value).trim().toLowerCase()]
                        : null;

                    // formulaData é o MESMO objeto reaproveitado em toda
                    // re-renderização do diálogo (confirmado na fonte: é
                    // montado uma única vez, antes do diálogo abrir, por
                    // DamageField.formatFormulas). Por isso guardamos o tipo
                    // ORIGINAL na primeira vez que passamos por aqui — sem
                    // isso, ao desmarcar o chip depois de já ter forçado o
                    // tipo, não haveria pra onde voltar: o Set original já
                    // teria sido sobrescrito e perdido de vez.
                    if (!formulaData.matanzaOriginalDamageTypes) {
                        formulaData.matanzaOriginalDamageTypes = new Set(formulaData.damageTypes);
                    }

                    formulaData.damageTypes = forcedType
                        ? new Set([forcedType])
                        : new Set(formulaData.matanzaOriginalDamageTypes);
                }
            } catch (err) {
                console.error(
                    `[${MODULE_ID}] Tipo de Dano Forçado falhou ao ler bonusEffects — flag ignorada` +
                    ` nesta rolagem, dano segue normal. Reporte este erro:`,
                    err
                );
            }

            return wrapped(formulaData, config, isDamage);
        },
        'WRAPPER'
    );


    /* 4) Acrescenta nossas onze flags (Matança + os dois Danos Extras +
     *    Experiência Usa Estresse + Estresse Dobra Bônus + Range de Arma
     *    Customizado + Range de Arma Incremento + Tipo de Dano Forçado +
     *    Limiar Extra + Dado de Ataque/Reação do Adversário) na lista de
     *    sugestões do autocomplete de "Chave do Atributo" na configuração
     *    de Active Effects, agrupadas sob "Customizado DH-BR".
     */
    libWrapper.register(
        MODULE_ID,
        'game.system.api.applications.sheetConfigs.ActiveEffectConfig.getChangeChoices',
        function (wrapped, ...args) {
            const choices = wrapped(...args);
            choices.push(
                {
                    value: MATANZA_CHANGE_KEY,
                    label: 'Dado de Matança',
                    hint: 'Concede 1d6 extra, consumido ao ser usado numa rolagem de ataque/ação ou de dano.',
                    group: 'Customizado DH-BR'
                },
                {
                    value: EXTRA_MAGIC_KEY,
                    label: 'Dano Extra Mágico',
                    hint: 'Número, dado ou fórmula somado como dano mágico extra em qualquer rolagem de dano (chip na seção Efeitos).',
                    group: 'Customizado DH-BR'
                },
                {
                    value: EXTRA_PHYSICAL_KEY,
                    label: 'Dano Extra Físico',
                    hint: 'Número, dado ou fórmula somado como dano físico extra em qualquer rolagem de dano (chip na seção Efeitos).',
                    group: 'Customizado DH-BR'
                },
                {
                    value: EXP_STRESS_KEY,
                    label: 'Experiência Usa Estresse',
                    hint: 'Acrescenta um custo em Estresse ao marcar uma Experiência (rolagem de ataque/ação), somado ao custo nativo de Esperança/Medo.',
                    group: 'Customizado DH-BR'
                },
                {
                    value: EXP_STRESS_DOUBLE_KEY,
                    label: 'Estresse Dobra Bônus da Experiência',
                    hint: 'Só tem efeito junto com Experiência Usa Estresse: dobra o bônus da Experiência quando ela é paga com Estresse.',
                    group: 'Customizado DH-BR'
                },
                {
                    value: RANGE_ARMA_KEY,
                    label: 'Range de Arma Customizado',
                    hint: 'Sobrescreve o alcance da arma equipada. Valor: 1=Adjacente 2=Muito Próximo 3=Próximo 4=Distante 5=Muito Distante.',
                    group: 'Customizado DH-BR'
                },
                {
                    value: RANGE_ARMA_BONUS_KEY,
                    label: 'Range de Arma - Incremento',
                    hint: 'Soma N passos ao alcance que a arma já tem, sem travar num valor fixo (positivo sobe, negativo desce). Valor: número inteiro (ex: "1").',
                    group: 'Customizado DH-BR'
                },
                {
                    value: TIPO_DANO_FORCADO_KEY,
                    label: 'Tipo de Dano Forçado',
                    hint: 'Sobrescreve o tipo do dano principal, independente do que estiver marcado na arma/ação. Valor: "f" (Físico) ou "m" (Mágico).',
                    group: 'Customizado DH-BR'
                },
                {
                    value: LIMIAR_BONUS_KEY,
                    label: 'Limiar Extra',
                    hint: 'Todo dano recebido por este Ator é calculado como se estivesse N limiares acima do valor bruto. Valor: número inteiro (ex: "1").',
                    group: 'Customizado DH-BR'
                },
                {
                    value: DADO_ATAQUE_ADVERSARIO_KEY,
                    label: 'Dado de Teste (Ataque) do Adversário',
                    hint: 'Troca o d20 da rolagem de ATAQUE deste Adversário por outro dado. Valor: número de faces ou "dN" (ex: "12" ou "d12").',
                    group: 'Customizado DH-BR'
                },
                {
                    value: DADO_REACAO_ADVERSARIO_KEY,
                    label: 'Dado de Teste (Reação) do Adversário',
                    hint: 'Troca o d20 da Rolagem de Reação deste Adversário por outro dado. Valor: número de faces ou "dN" (ex: "12" ou "d12").',
                    group: 'Customizado DH-BR'
                }
            );
            return choices;
        },
        'WRAPPER'
    );

    /* 4b) "Limiar Extra" — intercepta o cálculo de limiar do dano recebido
     *     (ver comentário completo junto de LIMIAR_BONUS_KEY, acima do
     *     Hooks.once('init'). Alvo diferente dos itens 1-4: não é a
     *     Action/DamageRoll de quem ATACA, é o próprio Ator que RECEBE o
     *     dano — por isso mora em CONFIG.Actor.documentClass.prototype, não
     *     em game.system.api.dice/fields como os outros.
     */
    libWrapper.register(
        MODULE_ID,
        'CONFIG.Actor.documentClass.prototype.convertDamageToThreshold',
        function (wrapped, damage) {
            const baseTier = wrapped(damage);

            try {
                const bonus = (this.appliedEffects ?? [])
                    .flatMap(effect => effect.system.changes)
                    .filter(change => change.key === LIMIAR_BONUS_KEY)
                    .reduce((total, change) => total + (Number(change.value) || 0), 0);

                if (!bonus) return baseTier;

                return Math.max(1, Math.min(4, baseTier + bonus));
            } catch (err) {
                console.error(
                    `[${MODULE_ID}] Limiar Extra falhou ao ler appliedEffects — flag ignorada` +
                    ` neste cálculo, limiar segue normal. Reporte este erro:`,
                    err
                );
                return baseTier;
            }
        },
        'WRAPPER'
    );

    /* 5) "Experiência Usa Estresse" — ver por que isto precisou de uma
     *    abordagem diferente dos itens 1-4 no comentário logo abaixo do
     *    Hooks.once('init'.
     *
     *    Em vez de SUBSTITUIR o custo de Esperança/Medo por Estresse,
     *    ACRESCENTAMOS um segundo item de custo (key 'stress') ao lado do
     *    item nativo. CostField.getRealCosts (nativo) agrupa por 'key', então
     *    ter 'hope' e 'stress' ao mesmo tempo gera DOIS itens separados na
     *    seção "Custo" do diálogo, em vez de somar num só. Os dois
     *    compartilham o mesmo extKey da Experiência, então marcar/desmarcar
     *    remove os dois juntos — a lógica nativa de toggle já filtra por
     *    extKey, então isso vem de graça.
     *
     *    Descoberta importante (ver comentário abaixo): D20RollDialog.
     *    selectExperience é uma action de ApplicationV2, registrada em
     *    `static DEFAULT_OPTIONS.actions.selectExperience`. Essa referência é
     *    capturada UMA VEZ na definição da classe, então um
     *    libWrapper.register comum nesse método NÃO tem efeito — o
     *    dispatcher de ações do Foundry recria o mapa actions a cada `new
     *    D20RollDialog(...)`, lendo direto de DEFAULT_OPTIONS.actions, então
     *    o wrapper "sumia": nunca era chamado. A correção é sobrescrever
     *    DEFAULT_OPTIONS.actions.selectExperience diretamente, aqui no
     *    'init' (antes de qualquer diálogo ser aberto pela primeira vez).
     */
    const D20RollDialog = game.system.api.applications.dialogs.d20RollDialog;
    const nativeSelectExperience = D20RollDialog.DEFAULT_OPTIONS.actions.selectExperience;

    D20RollDialog.DEFAULT_OPTIONS.actions.selectExperience = function (event, button) {
        nativeSelectExperience.call(this, event, button); // roda o handler nativo normal (hope/fear + render)

        const actor = this.config?.data?.parent;
        if (!actor) return;

        const hasExpStress = (actor.appliedEffects ?? []).some(effect =>
            effect.system.changes.some(c => c.key === EXP_STRESS_KEY)
        );
        if (!hasExpStress) return;

        // Se o clique foi pra DESMARCAR a Experiência, o handler nativo já
        // removeu a entrada de custo (por extKey) — nada a acrescentar aqui.
        const nativeCost = this.config.costs.find(c => c.extKey === button.dataset.key);
        if (!nativeCost) return;

        // A Esperança/Medo continua aparecendo na seção "Custo" (não é removida),
        // mas fica DESMARCADA por padrão — só o Estresse é cobrado. O jogador ainda
        // pode marcar a Esperança manualmente se quiser (é só um checkbox nativo).
        nativeCost.enabled = false;

        this.config.costs.push({
            extKey: button.dataset.key,
            key: 'stress',
            value: 1,
            enabled: true,
            name: this.config.data?.system.experiences?.[button.dataset.key]?.name
        });

        const doublesBonus = (actor.appliedEffects ?? []).some(effect =>
            effect.system.changes.some(c => c.key === EXP_STRESS_DOUBLE_KEY)
        );
        if (doublesBonus) {
            // Duplica o id da Experiência em this.config.experiences. O loop nativo
            // de D20Roll.configureModifiers soma um modificador por OCORRÊNCIA do id
            // nesse array — uma segunda cópia soma o bônus da Experiência de novo,
            // dobrando o total sem reimplementar a soma manualmente.
            this.config.experiences.push(button.dataset.key);
        }

        this.render();
    };

    /* 6) Corrige um bug do PRÓPRIO sistema Daggerheart: o autocomplete de
     *    "Chave do Atributo" na configuração de Active Effect sempre gruda um
     *    'system.' na frente de QUALQUER escolha, sem checar se é um campo do
     *    modelo de dados (onde 'system.' faz sentido) ou uma flag de módulo
     *    (onde nunca deveria ter isso). Código nativo, dentro de
     *    ActiveEffectConfig._attachPartListeners:
     *
     *        onSelect: function (item) {
     *            element.value = `system.${item.value}`;
     *        }
     *
     *    Isso deixa nossas 11 flags (todas começando com 'flags.') inutilizáveis
     *    quando escolhidas pela listagem — viram 'system.flags.daggerheart-br...',
     *    que não bate com nenhuma flag real (flags nunca ficam dentro de
     *    'system' em documento nenhum do Foundry).
     *
     *    _attachPartListeners é um método de instância comum (não uma action de
     *    ApplicationV2 como o selectExperience do item 5) — libWrapper funciona
     *    normal aqui. Mas o onSelect problemático é uma função interna, dentro
     *    de uma closure que não temos como sobrescrever direto (é local à
     *    própria autocomplete() do sistema). Em vez disso, interceptamos o
     *    PRÓPRIO SETTER de `.value` de cada campo de chave, via
     *    Object.defineProperty: sempre que algo tentar setar um valor que
     *    comece com 'system.flags.', a gente tira o 'system.' antes dele
     *    realmente ser aplicado — não importa se foi o autocomplete, digitação
     *    manual, ou qualquer outra coisa que sete `.value` depois.
     */
    const nativeValueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    function fixFlagPrefix(input) {
        if (input.dataset.matanzaFlagFixApplied) return; // já corrigido nesse elemento
        input.dataset.matanzaFlagFixApplied = 'true';

        Object.defineProperty(input, 'value', {
            configurable: true,
            get() {
                return nativeValueDescriptor.get.call(this);
            },
            set(newValue) {
                if (typeof newValue === 'string' && newValue.startsWith('system.flags.')) {
                    newValue = newValue.slice('system.'.length); // 'system.flags.x' -> 'flags.x'
                }
                nativeValueDescriptor.set.call(this, newValue);
            }
        });
    }

    libWrapper.register(
        MODULE_ID,
        'game.system.api.applications.sheetConfigs.ActiveEffectConfig.prototype._attachPartListeners',
        function (wrapped, partId, htmlElement, options) {
            wrapped(partId, htmlElement, options);
            htmlElement.querySelectorAll('.effect-change-input').forEach(fixFlagPrefix);
        },
        'WRAPPER'
    );

    /* 7) Contador Dinâmico de Cartas de Domínio — intercepta prepareDerivedData
     *    do Ator pra calcular em tempo real a quantidade de cartas, os
     *    domínios e a matemática dos níveis. Os valores ficam disponíveis
     *    como Roll Data (@system.cartas...) em qualquer fórmula.
     *
     *    CONFIRMADO na fonte real (daggerheart.js, classe DhCharacter):
     *    `domainCards` é um getter (não campo salvo), recalculado a cada
     *    acesso, e já entrega `loadout`, `vault` E `total` (mão+reserva)
     *    prontos — por isso reaproveitamos `total` em vez de remontar o
     *    array na mão. `domain` (StringField) e `level` (NumberField) já
     *    vêm no formato certo (confirmado na classe DHDomainCard) — o
     *    parseInt() abaixo é só uma rede de segurança extra, não a correção
     *    de um bug confirmado nesse campo.
     */
    libWrapper.register(
        MODULE_ID,
        'Actor.prototype.prepareDerivedData',
        function (wrapped, ...args) {
            wrapped(...args); // Garante que o cálculo nativo rode primeiro

            // Só nos interessa calcular isso para Personagens (Jogadores)
            if (this.type !== 'character') return;

            // O sistema já separa (e combina) as cartas sozinho, via getter:
            const handCards = this.system?.domainCards?.loadout ?? [];
            const vaultCards = this.system?.domainCards?.vault ?? [];
            const allCards = this.system?.domainCards?.total ?? [...handCards, ...vaultCards];

            // Função interna para fazer a matemática do array de cartas
            function analyzeCards(cards) {
                const countByDomain = {};
                const levels = [];

                cards.forEach(c => {
                    // O item pode vir como Document completo ou só os dados
                    const systemData = c.system || c;

                    const dom = (systemData.domain || 'unknown').toLowerCase();
                    countByDomain[dom] = (countByDomain[dom] || 0) + 1;

                    const lvl = parseInt(systemData.level, 10);
                    if (!isNaN(lvl)) {
                        levels.push(lvl);
                    }
                });

                levels.sort((a, b) => a - b);
                const uniqueLevels = [...new Set(levels)];

                const totalNiveis = levels.reduce((acc, val) => acc + val, 0);
                const min = uniqueLevels[0] || 0;
                const max = uniqueLevels[uniqueLevels.length - 1] || 0;

                const isDirectSeq = uniqueLevels.length > 1 && ((max - min) === (uniqueLevels.length - 1));
                const isIndirectSeq = uniqueLevels.length > 1 && !isDirectSeq;

                return {
                    total: cards.length,
                    por_dominio: countByDomain,
                    niveis: {
                        total: totalNiveis,
                        min: min,
                        max: max,
                        sequencia_direta: isDirectSeq ? 1 : 0,
                        sequencia_indireta: isIndirectSeq ? 1 : 0
                    }
                };
            }

            const statusCartas = {
                mao: analyzeCards(handCards),
                reserva: analyzeCards(vaultCards),
                todas: analyzeCards(allCards) // Soma de mão e reserva
            };

            // Injeta na flag (leitura via actor.getFlag(MODULE_ID, 'cartas') no console/macros)
            foundry.utils.setProperty(this, `flags.${MODULE_ID}.cartas`, statusCartas);

            // INJETA DIRETO NO SYSTEM: é o que fica acessível como @system.cartas...
            // em fórmulas de dado (Active Effects). Evita o path @flags.daggerheart-br...
            // em fórmulas, cujo hífen o parser de dados do Foundry pode interpretar
            // como subtração — não é um problema de setProperty em si (isso é JS puro,
            // sem esse risco), só importa pra quem for referenciar o valor DENTRO de
            // uma fórmula de dado.
            foundry.utils.setProperty(this, `system.cartas`, statusCartas);
        },
        'WRAPPER'
    );

    /* 8) "Dado de Teste do Adversário" (Ataque / Reação) — ver comentário
     *    completo junto de DADO_ATAQUE_ADVERSARIO_KEY /
     *    DADO_REACAO_ADVERSARIO_KEY, acima do Hooks.once('init').
     *
     *    Deixamos o wrapped() nativo criar o Die{faces:20} normalmente, e só
     *    DEPOIS sobrescrevemos a face — assim continuamos compatíveis com o
     *    guard nativo do próprio createBaseDice() (`if (this.terms[0]
     *    instanceof Die) return;`), sem duplicar essa lógica aqui.
     */
    libWrapper.register(
        MODULE_ID,
        'game.system.api.dice.D20Roll.prototype.createBaseDice',
        function (wrapped, ...args) {
            wrapped(...args);

            try {
                const actor = this.data?.parent;
                if (!actor) return;
                // DualityRoll (character/companion) nem chega a passar por
                // aqui na prática (rollClass diferente), mas a checagem fica
                // como segurança extra caso algo herde D20Roll no futuro.
                if (['character', 'companion'].includes(actor.type)) return;

                const isAttack = this.options?.roll?.type === 'attack';
                const isReaction = this.options?.actionType === 'reaction';
                if (!isAttack && !isReaction) return;

                const key = isAttack ? DADO_ATAQUE_ADVERSARIO_KEY : DADO_REACAO_ADVERSARIO_KEY;
                const change = (actor.appliedEffects ?? [])
                    .flatMap(effect => effect.system.changes)
                    .find(c => c.key === key);
                if (!change) return;

                this.d20 = change.value; // setter nativo: aceita '12' ou 'd12', resolve via getFaces()
            } catch (err) {
                console.error(
                    `[${MODULE_ID}] Dado de Teste do Adversário falhou — flag ignorada` +
                    ` nesta rolagem, dado segue d20 normal. Reporte este erro:`,
                    err
                );
            }
        },
        'WRAPPER'
    );
});

/**
 * 3) Injeta a linha "Dado de Matança" no diálogo de rolagem (D20RollDialog), logo
 * abaixo da linha do Rally — confirmado contra o rollSelection.hbs real:
 *
 *   <span class="formula-label">...</span>
 *   <select name="roll.dice._rallyIndex">...</select>
 *
 * dentro de <fieldset class="modifier-container ...">. Inserimos nosso par
 * span+select logo depois do <select> do Rally (ou, se o personagem não tiver Rally,
 * logo antes do Bônus Situacional).
 */
Hooks.on('renderD20RollDialog', (app, element) => {
    const actor = app.actor; // D20RollDialog.actor => this.config?.data?.parent
    if (!actor) return;

    const choices = (actor.appliedEffects ?? []).reduce((acc, effect) => {
        const change = effect.system.changes.find(c => c.key === MATANZA_CHANGE_KEY);
        if (change) acc.push({ id: effect.id, name: effect.name });
        return acc;
    }, []);

    if (!choices.length) return;

    const root = normalizarElementoRaiz(element);
    if (!root) return;

    const fieldset = root.querySelector('fieldset.modifier-container');
    if (!fieldset) return; // roll "lite" ou sem seção de modificadores

    const selected = app.roll?._matanzaIndex ?? '';
    const label = document.createElement('span');
    label.className = 'formula-label';
    label.textContent = 'Dado de Matança';

    const select = document.createElement('select');
    select.name = 'roll.dice._matanzaIndex';
    select.innerHTML =
        `<option value=""></option>` +
        choices.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.name} (d6)</option>`).join('');

    const rallySelect = fieldset.querySelector('select[name="roll.dice._rallyIndex"]');
    if (rallySelect) {
        // insere logo depois do <select> do Rally
        rallySelect.insertAdjacentElement('afterend', select);
        select.insertAdjacentElement('beforebegin', label);
    } else {
        // sem Rally nesse ator: insere no lugar equivalente, antes do Bônus Situacional
        const extraFormulaInput = fieldset.querySelector('input[name="extraFormula"]');
        const anchor =
            extraFormulaInput?.previousElementSibling?.classList?.contains('formula-label')
                ? extraFormulaInput.previousElementSibling
                : extraFormulaInput;
        if (anchor) {
            anchor.insertAdjacentElement('beforebegin', label);
            label.insertAdjacentElement('afterend', select);
        } else {
            fieldset.append(label, select);
        }
    }
});
