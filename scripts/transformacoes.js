/**
 * TRANSFORMAÇÃO — script para módulo Daggerheart-BR para o sistema Foundryborne
 * ------------------------------------------------------------------
 * Cria um novo sub-tipo de Item, "daggerheart-br.transformacao",
 * que funciona nos mesmos moldes de Classe/Ancestralidade/Comunidade:
 *
 *  - Tem uma lista de Habilidades (feature) vinculadas por UUID.
 *  - Quando esse item é criado/arrastado para dentro de um Personagem,
 *    o próprio sistema (BaseDataItem#_preCreate) copia essas Habilidades
 *    para o ator automaticamente, marcando-as com
 *    `system.originItemType = "daggerheart-br.transformacao"`.
 *    Isso é o MESMO mecanismo genérico que Classe/Comunidade já usam —
 *    não precisamos reescrever nada disso, só herdar de DHCommunity.
 *  - Tem uma aba de Descrição (com a lista de habilidades concedidas,
 *    igual a Comunidade/Ancestralidade), uma aba de Habilidades
 *    (arrastar/soltar, reaproveitando o template global do sistema) e
 *    uma aba de Perguntas (6 blocos empilhados).
 *  - Ganha sua PRÓPRIA seção nativa dentro da aba "Habilidades" da ficha
 *    do Personagem, logo abaixo da seção de Subclasse — usando o mesmo
 *    mecanismo (`system.sheetLists`) que gera as seções de
 *    Ancestralidade/Comunidade/Classe/Subclasse, então os cards saem
 *    idênticos (descrição, ícone de chat, botões de ação).
 *  - O nome da transformação ativa aparece, clicável, no cabeçalho da
 *    ficha, logo depois da Ancestralidade — abre a carta ao clicar,
 *    igual aos outros itens dessa linha.
 *
 * Por padrão, só é permitida UMA transformação ativa por personagem:
 * ao conceder uma nova, a anterior (e as habilidades que ela concedeu)
 * é removida — igual ao comportamento de Ancestralidade/Comunidade.
 * Se preferir permitir várias transformações acumuladas, mude
 * `ALLOW_MULTIPLE_TRANSFORMATIONS` para `true` mais abaixo.
 */

const MODULE_ID = 'daggerheart-br';
const ITEM_TYPE = `${MODULE_ID}.transformacao`;

const ALLOW_MULTIPLE_TRANSFORMATIONS = false;

Hooks.once('init', () => {
  const api = game.system.api;

  const DHCommunity = api?.data?.items?.DHCommunity;
  const DHHeritageSheet = api?.applications?.sheets?.api?.DHHeritageSheet;

  if (!DHCommunity || !DHHeritageSheet) {
    console.error(
      `${MODULE_ID} | Não encontrei game.system.api.data.items.DHCommunity ou ` +
        'game.system.api.applications.sheets.api.DHHeritageSheet. ' +
        'A versão do sistema Daggerheart instalada pode ter mudado essa API interna.'
    );
    return;
  }

  const fields = foundry.data.fields;

  /* ------------------------------------------------------------ */
  /*  Data Model                                                   */
  /* ------------------------------------------------------------ */

  class TransformationData extends DHCommunity {
    /** @override */
    static get metadata() {
      return foundry.utils.mergeObject(super.metadata, {
        label: 'TRANSFORMACAO.ItemType.label',
        type: ITEM_TYPE,
        hasDescription: true,
        isInventoryItem: false
      });
    }

    /** @override */
    static defineSchema() {
      return {
        ...super.defineSchema(),
        // Aba de Perguntas: 6 blocos empilhados, sobre a transformação.
        questions: new fields.ArrayField(new fields.StringField(), {
          initial: ['', '', '', '', '', '']
        })
      };
    }

    /** @override */
    static DEFAULT_ICON = 'icons/magic/light/explosion-star-large-orange.webp';
  }

  CONFIG.Item.dataModels[ITEM_TYPE] = TransformationData;
  CONFIG.Item.typeLabels[ITEM_TYPE] = 'TRANSFORMACAO.ItemType.label';
  CONFIG.Item.typeIcons ??= {};
  CONFIG.Item.typeIcons[ITEM_TYPE] = 'fa-solid fa-person-rays';

  CONFIG.DH.ITEM.featureTypes[ITEM_TYPE] = {
    id: ITEM_TYPE,
    label: 'TRANSFORMACAO.ItemType.label'
  };

  /* ------------------------------------------------------------ */
  /*  Ficha do Item                                                */
  /* ------------------------------------------------------------ */

  class TransformationSheet extends DHHeritageSheet {
    /** @override */
    static DEFAULT_OPTIONS = {
      classes: ['transformation'],
      actions: {
        dhRemoveFeature: TransformationSheet.#onRemoveFeature
      }
    };

    /** @override */
    static PARTS = {
      header: { template: `modules/${MODULE_ID}/templates/item/header.hbs` },
      ...super.PARTS,
      features: {
        // Template próprio (não o global genérico): dá o mesmo visual
        // de Classe/Subclasse — imagem, nome, globo (abrir) e lixeira
        // (remover da lista) — sem depender do partial interno de
        // habilidades TIPADAS (foundation/specialization/mastery), já
        // que o nosso `system.features` é uma lista simples de UUIDs.
        template: `modules/${MODULE_ID}/templates/item/features.hbs`,
        scrollable: ['.feature-list']
      },
      questions: {
        template: `modules/${MODULE_ID}/templates/item/questions.hbs`,
        scrollable: ['.questions']
      }
    };

    /**
     * Remove uma habilidade da lista `system.features` (só desvincula
     * da carta — não apaga o item do compêndio/mundo).
     */
    static async #onRemoveFeature(event, target) {
      const uuid = target.closest('[data-item-uuid]')?.dataset.itemUuid;
      if (!uuid) return;
      const remaining = this.document.system.features
        .filter(f => f?.uuid !== uuid)
        .map(f => f.uuid);
      await this.document.update({ 'system.features': remaining });
    }

    /** @override */
    static TABS = {
      primary: {
        tabs: [{ id: 'description' }, { id: 'features' }, { id: 'questions' }, { id: 'effects' }],
        initial: 'description',
        labelPrefix: 'DAGGERHEART.GENERAL.Tabs'
      }
    };

    /** @override */
    get relatedDocs() {
      return this.document.system.features;
    }
  }

  const { Items } = foundry.documents.collections;
  Items.registerSheet(MODULE_ID, TransformationSheet, {
    types: [ITEM_TYPE],
    makeDefault: true,
    label: () => game.i18n.localize('TRANSFORMACAO.ItemType.sheetLabel')
  });
});

/* ------------------------------------------------------------------ */
/*  Área própria na ficha do Personagem (aba Habilidades)              */
/* ------------------------------------------------------------------ */

/**
 * `document.system.sheetLists` é o getter que a aba "Habilidades" do
 * Personagem usa pra montar as seções de Ancestralidade/Comunidade/
 * Classe/Subclasse (cada uma vira um card nativo via o partial
 * `daggerheart.inventory-items`). Em vez de desenhar nossa própria
 * seção na mão, entramos NESSE getter — assim ganhamos o mesmo card
 * nativo (descrição, ícone de chat, botões) de graça, sem duplicar
 * HTML/CSS do sistema.
 *
 * Rodamos em `setup` (depois que o sistema já registrou
 * `CONFIG.Actor.dataModels.character` no próprio `init` dele).
 */
Hooks.once('setup', () => {
  const CharacterModel = CONFIG.Actor.dataModels.character;
  if (!CharacterModel) {
    console.error(`${MODULE_ID} | CONFIG.Actor.dataModels.character não encontrado.`);
    return;
  }

  const descriptor = Object.getOwnPropertyDescriptor(CharacterModel.prototype, 'sheetLists');
  if (!descriptor?.get) {
    console.error(`${MODULE_ID} | Getter "sheetLists" não encontrado no data model do Personagem.`);
    return;
  }

  const originalGetter = descriptor.get;

  Object.defineProperty(CharacterModel.prototype, 'sheetLists', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get() {
      const lists = originalGetter.call(this);

      const transformations = this.parent.items.filter(i => i.type === ITEM_TYPE);
      const grantedFeatures = this.parent.items.filter(i => i.system.originItemType === ITEM_TYPE);

      // Tira as habilidades concedidas pela Transformação do balde
      // genérico "Habilidades" — elas só devem aparecer no bucket
      // próprio, sem se misturar.
      if (lists.features?.values?.length && grantedFeatures.length) {
        lists.features.values = lists.features.values.filter(
          i => !grantedFeatures.some(g => g.id === i.id)
        );
      }

      if (!transformations.length) return lists;

      const title =
        transformations.length === 1
          ? `${game.i18n.localize('TRANSFORMACAO.ItemType.label')} - ${transformations[0].name}`
          : game.i18n.localize('TRANSFORMACAO.ItemType.labelPlural');

      // Reconstrói o objeto pra inserir "transformationFeatures" logo
      // depois de "subclassFeatures" (posição pedida: abaixo da
      // seção de Subclasse).
      const reordered = {};
      for (const [key, value] of Object.entries(lists)) {
        reordered[key] = value;
        if (key === 'subclassFeatures') {
          reordered.transformationFeatures = {
            title,
            type: 'transformation',
            values: grantedFeatures
          };
        }
      }
      return reordered;
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Nome clicável no cabeçalho da ficha (depois da Ancestralidade)     */
/* ------------------------------------------------------------------ */

Hooks.on('renderCharacterSheet', (app, element) => {
  const actor = app.document;
  if (!actor || actor.type !== 'character') return;

  const root = element instanceof HTMLElement ? element : element[0];

  root
    .querySelectorAll(`[data-module="${MODULE_ID}"].dh-transformation-header`)
    .forEach(el => el.remove());

  const transformation = actor.items.find(i => i.type === ITEM_TYPE);
  if (!transformation) return;

  // Mesma linha onde ficam Classe • Subclasse • Comunidade • Ancestralidade.
  const breadcrumb = root.querySelector('.character-details > div');
  if (!breadcrumb) return;

  const dot = document.createElement('span');
  dot.className = 'dot dh-transformation-header';
  dot.dataset.module = MODULE_ID;
  dot.textContent = '•';

  const link = document.createElement('span');
  link.className = 'dh-transformation-header';
  link.dataset.module = MODULE_ID;
  link.dataset.action = 'editDoc';
  link.dataset.itemUuid = transformation.uuid;
  link.textContent = transformation.name;

  breadcrumb.appendChild(dot);
  breadcrumb.appendChild(link);
});

/* ------------------------------------------------------------------ */
/*  Concessão / substituição da transformação em um Personagem         */
/* ------------------------------------------------------------------ */

Hooks.on('preCreateItem', (item, data, options, userId) => {
  if (ALLOW_MULTIPLE_TRANSFORMATIONS) return;
  if (data.type !== ITEM_TYPE) return;

  const actor = item.parent;
  if (!actor || actor.type !== 'character') return;

  const existing = actor.items.filter(i => i.type === ITEM_TYPE);
  if (!existing.length) return;

  const idsToDelete = [
    ...existing.map(i => i.id),
    ...actor.items.filter(i => i.system.originItemType === ITEM_TYPE).map(i => i.id)
  ];

  Hooks.once('createItem', createdItem => {
    if (createdItem.parent?.uuid !== actor.uuid || createdItem.type !== ITEM_TYPE) return;
    const stillThere = idsToDelete.filter(id => actor.items.get(id));
    if (stillThere.length) actor.deleteEmbeddedDocuments('Item', stillThere);
  });
});

Hooks.on('preDeleteItem', (item, options) => {
  if (item.type !== ITEM_TYPE) return;
  const actor = item.parent;
  if (!actor || actor.type !== 'character') return;

  const grantedIds = actor.items
    .filter(i => i.id !== item.id && i.system.originItemType === ITEM_TYPE)
    .map(i => i.id);
  options[MODULE_ID] = { grantedIds };
});

Hooks.on('deleteItem', async (item, options) => {
  if (item.type !== ITEM_TYPE) return;
  const actor = item.parent;
  const grantedIds = options[MODULE_ID]?.grantedIds;
  if (!actor || !grantedIds?.length) return;

  const stillThere = grantedIds.filter(id => actor.items.get(id));
  if (stillThere.length) await actor.deleteEmbeddedDocuments('Item', stillThere);
});
