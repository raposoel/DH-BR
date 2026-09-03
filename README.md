<!--
PROPOSTA DE README — v1.6.0 "Oiapoque"
Pontos marcados com [CONFIRMAR: ...] precisam da sua palavra final antes de publicar —
não inventei número, versão ou afirmação legal que não pude confirmar nos arquivos que
você me passou. Ver a lista de perguntas no final desta entrega (fora deste arquivo).
-->

<p align="center">
  <img src="[CONFIRMAR: caminho de um banner/logo do módulo, se existir]" alt="daggerheart-br" width="480"/>
</p>

<p align="center">
  <img alt="Foundry Version" src="https://img.shields.io/badge/Foundry-v14-informational">
  <img alt="Sistema" src="https://img.shields.io/badge/Daggerheart%20(Foundryborne)-v[2.9.1]-blue">
  <img alt="Requer Babele" src="https://img.shields.io/badge/requer-Babele-orange">
  <img alt="Requer libWrapper" src="https://img.shields.io/badge/requer-libWrapper-orange">
  <img alt="Versão" src="https://img.shields.io/badge/vers%C3%A3o-1.6.0%20Oiapoque-green">
  <img alt="Licença do código" src="https://img.shields.io/badge/código-MIT-lightgrey">
  <img alt="Conteúdo" src="https://img.shields.io/badge/conteúdo-DPCGL%20(SRD%202.0)-lightgrey">
</p>

# daggerheart-br

Tradução **Brasileira** completa para o sistema **Daggerheart** (Foundryborne) no
Foundry VTT — interface, itens de compêndio e um conjunto de automações extras
pensadas pra deixar a mesa mais rápida de rodar. Sem inventar mecânica: a
prioridade é ficar o mais próximo possível do texto e da matemática originais.

---

## Índice

- [Filosofia de tradução](#filosofia-de-tradução)
- [O que vem no módulo](#o-que-vem-no-módulo)
  - [Interface traduzida](#interface-traduzida)
  - [Compêndios](#compêndios)
  - [Conteúdo caseiro incluso (Homebrew)](#conteúdo-caseiro-incluso-homebrew)
  - [Automações e recursos extras](#automações-e-recursos-extras)
- [Instalação](#instalação)
- [Dependências obrigatórias](#dependências-obrigatórias)
- [Compatibilidade](#compatibilidade)
- [O que NÃO está pronto nesta versão](#o-que-não-está-pronto-nesta-versão)
- [Avisos de estabilidade](#avisos-de-estabilidade)
- [Problemas conhecidos / passos manuais](#problemas-conhecidos--passos-manuais)
- [Documentação técnica](#documentação-técnica)
- [Créditos e licença](#créditos-e-licença)

---

## Filosofia de tradução

- Sem "Pontos de" — o texto fica mais limpo e mais perto do tom literário original
  ("Esperança", não "Pontos de Esperança").
- Preserva construções que remetem à ficha física — "marque uma Esperança",
  "limpe um Estresse" — porque é assim que o material original fala com quem
  joga.
- Termos revisados quando a tradução oficial parecia duvidosa (ex.: "Fadiga").
- Sem inventar, só traduzir, conforme está no original mesmo — qualquer
  número, dado ou fórmula vem do material em inglês; só o idioma muda.

## O que vem no módulo

### Interface traduzida

Todo o sistema — fichas, diálogos, configurações, chat — traduzido pro
Brasileiro. [CONFIRMAR: se quiser, uma frase sobre cobertura de % ou "sem
strings em inglês conhecidas restantes", já que vocês validaram isso a fundo
numa sessão anterior.]

### Compêndios

Todos os compêndios de criação de personagem estão traduzidos:

| Compêndio | Conteúdo | Itens |
|---|---|---|
| Ancestralidades | [CONFIRMAR quantidade] | [CONFIRMAR] |
| Comunidades | [CONFIRMAR quantidade] | [CONFIRMAR] |
| Classes e Subclasses | [CONFIRMAR quantidade] | [CONFIRMAR] |
| Domínios (Cartas) | [CONFIRMAR quantidade] | [CONFIRMAR] |
| Armas | [CONFIRMAR quantidade] | [CONFIRMAR] |
| Armaduras | [CONFIRMAR quantidade] | [CONFIRMAR] |
| Consumíveis / Tesouros | [CONFIRMAR quantidade] | [CONFIRMAR] |

> Não tenho os números reais — preciso que você me passe a contagem (ou os
> arquivos de export dos packs) pra preencher essa tabela com precisão em vez
> de chute.

### Conteúdo caseiro incluso (Homebrew)

Registrado automaticamente ao carregar o mundo (não precisa configurar nada):

- **Domínios extras**: Sangue, Pavor, Curinga.
- **Tipo de Adversário extra**: Colosso.
- **Fontes de atribuição**: "Hope & Fear" e "The Void" aparecem como opção no
  dropdown de fonte de qualquer item — ambos conteúdo oficial da Darrington
  Press (o primeiro é um suplemento coberto desde a DPCGL 2.0; o segundo é
  material de playtest oficial do Daggerheart, "The Void").

### Automações e recursos extras

Além da tradução, o módulo inclui scripts próprios que mudam/aceleram parte do
fluxo de jogo. Cada um tem documentação técnica detalhada linkada
(veja [Documentação técnica](#documentação-técnica)):

| Recurso | O que faz |
|---|---|
| **Botões rápidos de Dano/Cura** | Aplicar dano/cura em 1 clique, com variantes 2x e ½, direto no card de rolagem |
| **Ações no dado individual** | Rerolar, Dobrar, Rolar +N ou Remover um dado específico do total, ao clicar nele |
| **Prestar Ajuda** | Botão "Ajudar" em qualquer rolagem de Ação/Ataque/Reação — gasta 1 Esperança pra somar um dado ao resultado de um aliado |
| **Transformação** | Novo tipo de Item, concedível a qualquer momento da campanha (não só na criação), com o mesmo comportamento de Classe/Ancestralidade |
| **Automação de Recursos (Foco, Favor, etc.)** | Faz Actions de itens diferentes conseguirem debitar/restaurar o recurso de um item "gerador" — contorna uma limitação nativa do sistema |
| **Oculto ↔ Escondido** | Vincula automaticamente o efeito da carta "Oculto" à condição nativa "Escondido" |
| **Dado de Matança, Dano Extra, Range Customizado, Limiar Extra e mais** | Conjunto de flags de Active Effect pra homebrew de poderes (ver tabela detalhada no link da documentação) |

## Instalação

Manifest:
```
[CONFIRMAR: URL do manifesto — o README anterior aponta pra
https://raw.githubusercontent.com/raposoel/DH-BR/refs/heads/main/module.json,
mantenho essa ou mudou?]
```

1. No Foundry, aba **Add-on Modules** → **Install Module** → cole o manifest acima.
2. Instale também as [dependências obrigatórias](#dependências-obrigatórias).
3. No seu Mundo, ative `daggerheart-br`, **Babele** e **libWrapper**.
4. Configuração → Idioma → selecione **Português (Brasil)**.

## Dependências obrigatórias

| Módulo | Por quê |
|---|---|
| [Babele](https://foundryvtt.com/packages/babele) | Traduz o conteúdo dos compêndios em tempo de execução |
| [libWrapper](https://foundryvtt.com/packages/lib-wrapper) | Necessário para as automações extras (Dado de Matança e correlatos) |

## Compatibilidade

- **Foundry VTT**: v14 [CONFIRMAR: mínimo suportado — v13 também funciona ou é v14 only?]
- **Sistema Daggerheart (Foundryborne)**: verificado até a v[CONFIRMAR — 2.7.3 aparece nos
  seus docs técnicos, mas confirme se é isso mesmo que quer publicar como "testado"]

## O que NÃO está pronto nesta versão

Ainda pendentes pra uma cobertura 100% do sistema:

- Bestiários
- Diários
- Tabelas de Rolagem

[CONFIRMAR: o README anterior também listava "Adversários" e "Ambientes"
separado de "Bestiários" — isso já foi resolvido (adversários/ambientes
prontos, só falta o conceito de "Bestiário" em si), ou continua tudo junto
como pendência?]

## Avisos de estabilidade

- As features de `matanza.js` (Dado de Matança, Dano Extra, Range Customizado,
  Tipo de Dano Forçado, Limiar Extra, Contador de Cartas de Domínio) foram
  construídas por engenharia reversa do sistema e validadas **apenas por
  sintaxe** — nenhuma foi confirmada numa sessão de jogo real ainda. Use com a
  expectativa de um recurso beta; reporte qualquer comportamento estranho.
- Os demais scripts (Dano/Cura, Transformação, Recursos, Oculto/Escondido) já
  passaram por uso prático. [CONFIRMAR: isso é preciso, ou algum desses também
  precisa do mesmo aviso de beta?]

## Problemas conhecidos / passos manuais

- **Forma de Fera do Druida**: por limitação do sistema, é preciso mover
  manualmente as pastas do compêndio de Formas de Fera pra aba de Itens do
  Mundo (não funciona direto do compêndio). Guia com prints no repositório.
- **Invocações**: pra personalizar uma invocação, copie a pasta correspondente
  do compêndio pra aba de Atores e edite a partir daí — o sistema não permite
  duplicar/referenciar sem esse passo.
- Recomendado: apague os compêndios oficiais de "Character Options" em inglês
  do seu mundo, se possível, pra evitar duplicidade na hora de criar
  personagem.

## Documentação técnica

Pra quem quiser entender o funcionamento interno de cada script (ou dar
manutenção depois de um update do sistema):

- `APRENDIZADOS-daggerheart-br.md` — packs, schema de itens, Homebrew, metodologia de tradução
- `README-transformacao.md` — o item Transformação
- `README-dano-cura.md` — botões de Dano/Cura e Prestar Ajuda
- `README-matanza.md` — Dado de Matança e as demais flags de Active Effect
- `README-recursos.md` — automação de recursos vinculados (Foco/Favor/etc.)

## Créditos e licença

O Daggerheart **não** usa CC-BY/OGL como o D&D 5e — usa uma licença própria,
a **Darrington Press Community Gaming License (DPCGL)**, atualmente na
versão 2.0. O Foundry VTT está na lista oficial de VTTs autorizados pra
rodar conteúdo do SRD. Isso dá duas camadas de licença separadas neste
projeto:

- **Código deste módulo** (os scripts `.js`, a lógica das automações): **MIT**.
  São criação original de vocês; licenciar como MIT deixa claro que qualquer
  pessoa pode reusar/adaptar o *código*, dando crédito.
- **Conteúdo traduzido** (textos de compêndio, strings de interface): não é
  propriedade de vocês nem pode ser relicenciado livremente — é "Conteúdo
  Adaptativo" sobre o SRD da Daggerheart, sob os termos da DPCGL 2.0. Vocês
  são donos da *tradução em si* (o texto em Brasileiro), mas não do sistema,
  mecânica ou nomes por trás dela.

Este produto inclui material do **Daggerheart System Reference Document
2.0**, © Critical Role, LLC, sob os termos da Darrington Press Community
Gaming License. Mais informações em https://www.daggerheart.com. "Hope &
Fear" está coberto desde a atualização da DPCGL de 25/08/2026; "The Void" é
material de playtest oficial do Daggerheart — pode ser compartilhado
livremente (o que este módulo faz, de graça), mas **nunca vendido nem
monetizado** enquanto for conteúdo de playtest.

"Daggerheart" é marca registrada de Critical Role, LLC — este projeto é
**"Daggerheart™ Compatible"**, não afiliado nem endossado pela Darrington
Press.

[CONFIRMAR: seu nome/usuário de crédito, e se quer baixar e incluir os
logos oficiais de "Community Content" da Darrington Press — tem um link
pra isso na página da licença, dá pra colocar no topo do README junto dos
badges.]
