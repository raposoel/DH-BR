const MODULE_ID = 'daggerheart-br';

const ASCII_ART = `
 ____  _   _       ____  ____
|  _ \\| | | |     | __ )|  _ \\
| | | | |_| |_____|  _ \\| |_) |
| |_| |  _  |_____| |_) |  _ <
|____/|_| |_|     |____/|_| \\_\\`;

Hooks.once("init", () => {
    registrarFontesDeAtribuicao();
    registrarReferenciasDeLore();
    registrarExclusividadeTransformacao();
    registrarLogoPersonalizado();
});

console.log(`${MODULE_ID} | Script carregado.`);

// Usamos o hook 'ready' para garantir que o sistema já carregou suas configurações
Hooks.on('ready', async () => {
    if (game.system.id !== 'daggerheart') return;

    // Apenas o mestre precisa rodar a lógica de registro
    if (game.user.isGM) {
        await registrarConteudoCaseiro();
    }

    // Banner fica pro final do 'ready' de propósito: só roda depois que o
    // sistema, os outros módulos e o registro de conteúdo caseiro (acima)
    // já terminaram, então vira (quase) a última coisa impressa no console
    // ao abrir o mundo, em vez de sumir lá em cima no meio do carregamento.
    // Versão vem do próprio manifesto (module.json), então nunca fica
    // desatualizada aqui no código.
    const versao = game.modules.get(MODULE_ID)?.version ?? '?';
    console.log(`\n${ASCII_ART}\n================================\n  daggerheart-br | v${versao}\n================================\n`);
});

function registrarFontesDeAtribuicao() {
    // Diferente do Homebrew (que é uma configuração do mundo, salva via game.settings),
    // attributionSources é um objeto de CONFIG em memória -- roda em todo cliente, não só
    // no mestre, então não usa game.user.isGM aqui. "Hope & Fear" e "The Void" são
    // expansão, então entram como values dentro do próprio grupo "daggerheart" (não
    // criam categoria própria). O array values não é congelado, mesmo com GENERAL vindo
    // com Object.freeze, então dá pra empurrar itens nele sem tocar no sistema.
    if (game.system.id !== 'daggerheart' || !CONFIG.DH?.GENERAL?.attributionSources?.daggerheart) return;

    CONFIG.DH.GENERAL.attributionSources.daggerheart.values.push(
        { label: 'Hope & Fear' },
        { label: 'The Void' }
    );
}

function registrarReferenciasDeLore() {
    // Mesma lógica do attributionSources acima: CONFIG.DH.lore é um objeto em
    // memória (não um settings salvo), roda em todo cliente (não só GM), e o
    // sistema já populou CONFIG.DH antes do nosso 'init' rodar. Cada chave
    // aqui é o valor que vai em "Referência ao Universo" (system.loreReference)
    // do item, apontando pro heading correspondente dentro da MESMA página de
    // journal traduzida "Ancestralidades - BR" -- igual o sistema oficial faz
    // com a página "CORE MATERIALS" dele.
    if (game.system.id !== 'daggerheart' || !CONFIG.DH?.lore?.ancestry) return;

    const PACK = 'daggerheart-br.diarios-br';
    const JOURNAL_ID = 'p6NS51APjfJuG4NV';
    const PAGE_ID = 'tWyfg5m7bDYbx1ng';
    const uuidAncestralidade = ancora =>
        `Compendium.${PACK}.JournalEntry.${JOURNAL_ID}.JournalEntryPage.${PAGE_ID}#${ancora}`;

    // Núcleo -- sufixo "-br" só nas que o nome bate com o original em inglês
    // (clank, drakona, firbolg, fungril, galapa, goblin, infernis, katari, orc),
    // pra não colidir com a âncora do mesmo nome no journal oficial em inglês
    const ancestralidadesNucleo = [
        'clank-br', 'drakona-br', 'anao', 'elfo', 'fada', 'fauno', 'firbolg-br',
        'fungril-br', 'galapa-br', 'gigante', 'goblin-br', 'metadilio', 'humano',
        'infernis-br', 'katari-br', 'orc-br', 'quacho', 'simio'
    ];

    // Esperança & Medo -- nenhuma bate com o nome em inglês, então sem sufixo
    const ancestralidadesEsperancaMedo = [
        'eteris', 'telurio', 'igneo', 'ceruleo', 'mareano', 'gnomo'
    ];

    for (const ancora of [...ancestralidadesNucleo, ...ancestralidadesEsperancaMedo]) {
        CONFIG.DH.lore.ancestry[ancora] = uuidAncestralidade(ancora);
    }
}

function registrarLogoPersonalizado() {
    // Troca o logo do sistema que aparece no painel "Game System" da aba de
    // Configurações (a mesma sidebar que mostra Versão / Wiki / Discord).
    // Esse trecho de HTML é inserido pelo próprio sistema via
    // DhSettings._onRender (renderiza o template
    // "sidebar/settings/info-insert.hbs" e cospe o resultado na aba), e o
    // CSS do sistema (daggerheart.css) confirma a estrutura e as classes:
    //
    //   .dh-sidebar-settings .sidebar-settings-dh-info img { width: 80px; ... }
    //
    // Ou seja, dentro do container ".sidebar-settings-dh-info" tem um único
    // <img> com o logo. Em vez de tentar sincronizar com o momento exato em
    // que essa aba é (re)renderizada -- o que exigiria caçar o hook certo
    // toda vez que o usuário abre/fecha a aba de Configurações -- resolvemos
    // via CSS puro: a propriedade `content: url(...)` troca a imagem
    // exibida de um <img> já existente na página. Isso funciona em qualquer
    // renderização (inicial ou reaberturas), já que é uma regra de estilo
    // global, não uma manipulação pontual do DOM.
    //
    // Roda em todo cliente (não só GM), já que a aba de Configurações é
    // visível pra todo mundo.
    if (document.getElementById('daggerheart-br-logo-override')) return;

    const style = document.createElement('style');
    style.id = 'daggerheart-br-logo-override';
    style.textContent = `
        .dh-sidebar-settings .sidebar-settings-dh-info img {
            content: url("modules/${MODULE_ID}/imagens/dh-br-02.webp") !important;
            /* O sistema aplica margin-bottom: -8px nesse <img> pra colar o
               logo original no texto de versão logo abaixo. Como o nosso
               logo tem proporção/recorte diferente, isso deixa tudo grudado
               -- por isso sobrescrevemos aqui (precisa de !important porque
               a regra original do sistema tem mais classes no seletor e
               ganharia da nossa por especificidade). Ajuste os valores
               abaixo à vontade pra calibrar o respiro. */
            margin-top: 8px !important;
            margin-bottom: 6px !important;
            /* O container pai (.sidebar-settings-dh-info) já centraliza via
               flexbox (align-items: center), então isso aqui é só reforço
               -- caso o logo pareça puxado pra um lado, o mais provável é
               sobra de espaço transparente desigual dentro do próprio
               arquivo .webp, não a centralização em si. */
            display: block !important;
            margin-left: auto !important;
            margin-right: auto !important;
        }
    `;
    document.head.appendChild(style);
}

// Troque para `true` se um dia quiserem permitir várias Transformações
// acumuladas no mesmo personagem.
const ALLOW_MULTIPLE_TRANSFORMATIONS = false;

function registrarExclusividadeTransformacao() {
    // O sistema já tem um tipo de Item nativo "transformation" (ficha,
    // Habilidades vinculadas, seção própria na aba Habilidades do
    // Personagem) — só falta ele impedir mais de uma Transformação ativa
    // por personagem, que é o que este hook resolve.
    //
    // Não precisamos replicar a remoção das Habilidades concedidas pela
    // Transformação antiga: `DHItem.deleteDocuments` do próprio sistema
    // já apaga junto tudo cujo `system.granter.id` aponte pra ela.
    //
    // Reagimos em 'createItem' (em vez de 'preCreateItem' + Hooks.once)
    // porque a Transformação e as Habilidades que ela concede nascem no
    // mesmo lote de criação -- filtrar por tipo aqui não depende da
    // ordem em que os itens desse lote disparam o hook.
    Hooks.on('createItem', async (item, options, userId) => {
        if (ALLOW_MULTIPLE_TRANSFORMATIONS) return;
        if (game.system.id !== 'daggerheart' || item.type !== 'transformation') return;

        const actor = item.parent;
        if (!actor || actor.type !== 'character') return;

        // Só o cliente que criou o item faz a limpeza, pra não ter todo
        // mundo conectado tentando apagar a mesma coisa.
        if (userId !== game.user.id) return;

        const others = actor.items.filter(
            i => i.type === 'transformation' && i.id !== item.id
        );
        if (!others.length) return;

        await actor.deleteEmbeddedDocuments('Item', others.map(i => i.id));
    });
}

async function registrarConteudoCaseiro() {
    // Identifica qual a chave correta da configuração (o sistema às vezes muda entre maiúsculo/minúsculo)
    let chaveConfig = 'Homebrew';
    if (!game.settings.settings.has('daggerheart.Homebrew')) {
        chaveConfig = 'homebrew';
    }

    try {
        // Pega as configurações atuais de Homebrew do sistema
        const configHomebrew = game.settings.get('daggerheart', chaveConfig);
        let houveMudanca = false;

        // ===== DOMÍNIOS =====
        let dominiosAtuais = configHomebrew.domains || {};

        const meusDominios = {
            "sangue": {
                "id": "sangue",
                "label": "Sangue",
                "src": `modules/${MODULE_ID}/Imagens/Void/sangue-dom.webp`
            },
            "curinga": {
                "id": "curinga",
                "label": "Curinga",
                "src": `modules/${MODULE_ID}/Imagens/Void/dh.webp`
            }
        };

        for (let id in meusDominios) {
            if (!dominiosAtuais[id]) {
                dominiosAtuais[id] = meusDominios[id];
                houveMudanca = true;
                console.log(`${MODULE_ID} | Adicionando domínio: ${id}`);
            }
        }

        // ===== TIPOS DE ADVERSÁRIO =====
        let tiposAtuais = configHomebrew.adversaryTypes || {};

        const meusTiposAdversario = {
            "colosso": {
                "label": "Colosso",
                "description": ""
            }
        };

        for (let id in meusTiposAdversario) {
            if (!tiposAtuais[id]) {
                tiposAtuais[id] = meusTiposAdversario[id];
                houveMudanca = true;
                console.log(`${MODULE_ID} | Adicionando tipo de adversário: ${id}`);
            }
        }

        if (houveMudanca) {
            const novaConfig = {
                ...configHomebrew,
                domains: dominiosAtuais,
                adversaryTypes: tiposAtuais
            };

            await game.settings.set('daggerheart', chaveConfig, novaConfig);

            ui.notifications.info("Daggerheart Brasil: Novo conteúdo caseiro registrado! Recarregando para aplicar...");

            setTimeout(() => location.reload(), 1500);
        }

    } catch (err) {
        console.error(`${MODULE_ID} | Erro ao registrar conteúdo caseiro:`, err);
    }
}
