/**
 * fera-br.js — Formas de Fera em PT-BR
 *
 * Redireciona o diálogo de Transformação do sistema (que busca sempre no
 * pack fixo "daggerheart.beastforms") para o compêndio traduzido, via
 * libWrapper na classe do compêndio — não na instância do pack. A versão
 * anterior sobrescrevia o método diretamente no objeto do pack e não estava
 * se sustentando de forma confiável; isso troca pra um wrapper na classe,
 * que é o jeito robusto de fazer esse tipo de interceptação no Foundry.
 *
 * Mantém também a guarda contra tokens fantasma (ator com token registrado
 * que não existe mais na cena, o que quebrava a troca de token e a remoção
 * do efeito ao transformar/destransformar).
 *
 * Requer libWrapper ativo.
 */

const MODULE_ID = 'daggerheart-br'; // ajuste se o id do seu módulo for outro
const PACK_EN = 'daggerheart.beastforms';
const PACK_BR = 'daggerheart-br.formas-de-fera-br'; // ajuste se o ID for outro

const log = (msg, cor = '#7ac943') => console.log(`%cfera-br | ${msg}`, `color:${cor};font-weight:bold`);

Hooks.once('ready', () => {
    if (!game.modules.get('lib-wrapper')?.active) {
        console.error('fera-br | libWrapper não está ativo. Nada foi aplicado.');
        return;
    }

    log('carregado');

    // 1) Redireciona a busca de Formas de Fera pro pack traduzido.
    libWrapper.register(
        MODULE_ID,
        'foundry.documents.collections.CompendiumCollection.prototype.getDocuments',
        async function (wrapped, ...args) {
            if (this.metadata.id !== PACK_EN) return wrapped(...args);

            const packBR = game.packs.get(PACK_BR);
            if (!packBR) {
                console.warn(`fera-br | pack "${PACK_BR}" não encontrado — usando o compêndio em inglês.`);
                return wrapped(...args);
            }
            return packBR.getDocuments(...args);
        },
        'MIXED'
    );
    log(`${PACK_EN} → ${PACK_BR}`);

    // 2) Guarda contra tokens fantasma (ator com token registrado que não
    //    existe mais na cena — quebra a troca de token e a remoção do
    //    efeito ao transformar/destransformar).
    libWrapper.register(
        MODULE_ID,
        'CONFIG.Actor.documentClass.prototype.getDependentTokens',
        function (wrapped, ...args) {
            return wrapped(...args).filter(token => {
                const existe = Boolean(token?.id) && Boolean(token.parent?.tokens?.has?.(token.id));
                if (!existe) {
                    console.warn(`fera-br | token fantasma ignorado: ${token?.id} (cena: ${token?.parent?.name ?? '—'})`);
                }
                return existe;
            });
        },
        'WRAPPER'
    );
    log('guarda de tokens fantasma ativa');
});
