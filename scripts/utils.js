/**
 * daggerheart-br — utilidades compartilhadas entre os scripts do módulo
 * ------------------------------------------------------------------
 * Funções pequenas e sem estado, que estavam duplicadas (de forma
 * idêntica ou quase) em mais de um script antes dessa extração.
 * Nenhuma delas registra hook nem tem efeito colateral sozinha —
 * importar este arquivo não muda nada no jogo por conta própria.
 */

export const MODULE_ID = 'daggerheart-br';

/**
 * Normaliza o "elemento raiz" recebido por um hook de render do Foundry
 * pra sempre devolver um HTMLElement puro (ou null). Cobre os dois
 * formatos que hooks de render já mandam por aí: um HTMLElement direto
 * (padrão em ApplicationV2 / Foundry v13+), ou um array-like (ex.:
 * jQuery) cujo primeiro item é o elemento de verdade.
 *
 * Substitui o "el instanceof HTMLElement ? el : el?.[0]" que estava
 * repetido em matanza.js, recursos.js e transformacoes.js.
 *
 * @param {HTMLElement|ArrayLike<HTMLElement>|null|undefined} el
 * @returns {HTMLElement|null}
 */
export function normalizarElementoRaiz(el) {
    if (el instanceof HTMLElement) return el;
    return el?.[0] ?? null;
}

/**
 * Lê o identificador de origem (compendium source) de um Document,
 * tentando os dois lugares onde o Foundry já guardou isso ao longo das
 * versões: a flag legada "flags.core.sourceId" e o campo atual
 * "_stats.compendiumSource". Retorna null se nenhum dos dois existir.
 *
 * Usada pra reconhecer uma cópia embutida (num Ator) de um item/efeito
 * específico de compêndio mesmo depois que o Foundry troca o `_id` ao
 * copiar o documento — substitui a função idêntica que estava separada
 * em recursos.js e oculto-escondido.js.
 *
 * @param {ClientDocument|null|undefined} doc
 * @returns {string|null}
 */
export function obterIdDeOrigem(doc) {
    return doc?.flags?.core?.sourceId ?? doc?._stats?.compendiumSource ?? null;
}
