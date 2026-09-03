const MODULE_ID = 'daggerheart-br';

const ASCII_ART = `
 ____  _   _       ____  ____
|  _ \\| | | |     | __ )|  _ \\
| | | | |_| |_____|  _ \\| |_) |
| |_| |  _  |_____| |_) |  _ <
|____/|_| |_|     |____/|_| \\_\\`;

Hooks.once("init", () => {
    registrarFontesDeAtribuicao();
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
