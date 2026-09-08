-- Troca o /f/live de Tailândia para Japão e China. Rodar no SQL editor do
-- Supabase do Dashboard (pkdcglrzbjvcedlizqqv). O link NÃO muda.
update stfv_forms_publicados set
  nome = 'Live Japão e China — captacao',
  html = replace(replace(replace(replace(replace(replace(html,
            'Live Tailândia — captacao', 'Live Japão e China — captacao'),
            'em 24/08/2026, 12:09:21',   'em 28/08/2026, 19:46:33'),
            'live-tailandia-2026',       'live-japao-china-2027'),
            'LIVE_TAILANDIA',            'LIVE_JAPAO_CHINA'),
            '[Tailândia] - Live',        '[Japão e China] - Live'),
            '"expedicao": "Tailândia"',  '"expedicao": "Japão e China"'),
  spec = replace(replace(replace(replace(replace(spec::text,
            'Live Tailândia — captacao', 'Live Japão e China — captacao'),
            'live-tailandia-2026',       'live-japao-china-2027'),
            'LIVE_TAILANDIA',            'LIVE_JAPAO_CHINA'),
            '[Tailândia] - Live',        '[Japão e China] - Live'),
            '"valor":"Tailândia"',       '"valor":"Japão e China"')::jsonb,
  atualizado_em = now()
where slug = 'live'
returning slug, nome, md5(html) as md5_html,
  spec->'destino'->'camposFixos' as campos_fixos;
-- Esperado: md5_html = 84d1cb43c228468c8d9b93bd6206d9a3
