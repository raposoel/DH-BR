Hooks.on('init', () => {
  
  if (typeof Babele !== 'undefined') {
    Babele.get().register({
      module: 'daggerheart-ptbr',
      lang: 'pt-BR',
      dir: 'compendiums'
    })
  }
  
})
