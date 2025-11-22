Hooks.on('init', () => {
  
  if (typeof Babele !== 'undefined') {
    Babele.get().register({
      module: 'daggerheart-br',
      lang: 'pt-BR',
      dir: 'compendiums'
    })
  }
  
})
