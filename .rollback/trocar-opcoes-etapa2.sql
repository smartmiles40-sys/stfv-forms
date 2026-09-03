update stfv_forms_publicados set
  html = replace(replace(replace(html,'Sim, eu assisti tudo e quero seguir os próximos passos','Sim, assisti completa e quero saber mais.'),'Peguei pela metade, e quero entender mais das expedições','Assisti metade, e quero saber mais.'),'Não consegui assistir a live e quero entender o roteiro','Não consegui assistir a live e quero saber mais.'),
  spec = replace(replace(replace(spec::text,'Sim, eu assisti tudo e quero seguir os próximos passos','Sim, assisti completa e quero saber mais.'),'Peguei pela metade, e quero entender mais das expedições','Assisti metade, e quero saber mais.'),'Não consegui assistir a live e quero entender o roteiro','Não consegui assistir a live e quero saber mais.')::jsonb,
  atualizado_em = now()
where slug in ('amalfitana','tailandia','turquia','islandia','japao','egito','peru')
returning slug, md5(html) as md5_html,
  spec->'etapas'->1->'campos'->0->'opcoes'->0->>'label' as opcao1;