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

    /* 3a) Faz nossas duas flags aparecerem como chip clicável na seção
     *     "Efeitos" do diálogo de dano, não importa o tipo de dano da arma.
     *     Nativamente essas chaves só incluiriam bônus do MESMO tipo da arma
     *     (ex.: "system.bonuses.damage.physical" se a arma for física) — por
     *     isso extendemos em vez de deixar como está.
     */
    libWrapper.register(
        MODULE_ID,
        'game.system.api.dice.DamageRoll.prototype.getActionChangeKeys',
        function (wrapped, ...args) {
            const keys = wrapped(...args);
            keys.push(EXTRA_MAGIC_KEY, EXTRA_PHYSICAL_KEY);
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

    /* 4) Acrescenta nossas cinco flags (Matança + os dois Danos Extras +
     *    Experiência Usa Estresse + Estresse Dobra Bônus) na lista de
     *    sugestões do autocomplete de "Chave do Atributo" na configuração de
     *    Active Effects, agrupadas sob "Customizado DH-BR".
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
                }
            );
            return choices;
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
     *    Isso deixa nossas 5 flags (todas começando com 'flags.') inutilizáveis
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

    const root = element instanceof HTMLElement ? element : element?.[0];
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
