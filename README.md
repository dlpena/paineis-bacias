# Painéis de bacias

Acompanhamento hidrológico automático de bacias do SIN em páginas estáticas (GitHub Pages), atualizado a cada hora
pelo GitHub Actions, só com fontes públicas e sem credencial. A página inicial mostra o mapa das bacias do SIN; as
bacias com painel são clicáveis. Hoje: **Iguaçu** e **Paranapanema**.

| Dado | Fonte | Coletor |
|---|---|---|
| Nível, defluência, turbinada, vertida, volume útil e vazão natural das usinas | ONS, Dados Abertos, parquets públicos no S3 (`dados_hidrologicos_ho` e `dados_hidrologicos_di`) | `coleta/ons.py` |
| Cota, vazão e chuva das estações da Resolução Conjunta ANEEL/ANA nº 3 | ANA, webservice de telemetria `telemetriaws1.ana.gov.br` | `coleta/telemetria.py` |
| Chuva média da bacia e por célula de 0,1°, MLT 1998–2024 | INPE/CPTEC, produto MERGE (GRIB2 diário e climatologia NetCDF) | `coleta/merge.py` |

**Painel técnico não oficial.** Não é produto da ANA nem do ONS. Exibe dado bruto e regra; não conclui descumprimento.

## Estrutura

```
config/bacias.yaml          bacias publicadas (ordem da página inicial)
config/mapa_sin.json        contornos das bacias do SIN para o mapa da página inicial
config/<bacia>/             bacia.yaml (identidade e textos), usinas.yaml, estacoes.csv, trechos.yaml,
                            condicionantes.yaml (regras vigentes, com fonte), bacia.geojson, hidrografia.geojson
coleta/                     coletores e montadores, os mesmos para todas as bacias (BACIA=<slug> no ambiente)
paginas/                    páginas de uma bacia, com marcadores {{...}}; publica_paginas.py copia para docs/<bacia>/
paginas_raiz/index.html     página inicial; publica_inicio.py grava docs/index.html
dados/<bacia>/              histórico em parquet/CSV commitado pelo fluxo (ons/, tele/, merge/, status/)
docs/                       site: index.html, app.js, estilo.css e uma pasta por bacia com as páginas e data/
```

## Rodar localmente

```bash
pip install -r requirements.txt
BACIA=paranapanema python coleta/ons.py --desde 2025-01
BACIA=paranapanema python coleta/telemetria.py --dias 60
BACIA=paranapanema python coleta/merge.py --desde 2026-01-01 --mlt
BACIA=paranapanema python coleta/monta_site.py      # também publica as páginas da bacia
python coleta/publica_inicio.py
python -m http.server 8767 --directory docs
```

## Nova bacia

1. `config/<slug>/bacia.geojson`: polígono do SNIRH/ANA (camada Meso Região Hidrográfica, por `DME_CD`).
2. `config/<slug>/bacia.yaml`: nome, rio, `nom_bacia` do ONS, nome no mapa do SIN, centro do mapa, textos, destaque e
   rios da hidrografia (copiar o de uma bacia existente).
3. `config/<slug>/usinas.yaml`: usinas do ONS (`ons`/`id_ons` como no parquet; tipo e coordenadas do cadastro de
   reservatórios do ONS). `montante:` explícito quando há usina em afluente.
4. `config/<slug>/estacoes.csv`: estações da Res. nº 3 que o painel acompanha (telemétricas em operação).
5. `config/<slug>/trechos.yaml`: o desenho do rio, de montante para jusante, com o papel de cada estação, a margem
   dos afluentes e o que chega e o que sai de cada trecho. Usina num afluente vira trecho com `ramal_de:` (no
   diagrama, braço paralelo ao rio principal, como o ONS desenha). Afluente que deságua em outro afluente monitorado leva
   `desagua_em:` com o rio de destino (conferir a confluência na hidrografia do SNIRH); no diagrama os dois se juntam
   num tronco antes de chegar ao rio.
6. `config/<slug>/condicionantes.yaml`: só limites lidos em documento primário (outorga, resolução, FSAR-H).
7. `BACIA=<slug> python coleta/hidrografia.py`, depois a coleta; acrescentar a bacia em `config/bacias.yaml`.

O que muda de uma bacia para outra é o desenho do rio e as regras, não o código.

## Regras exibidas

Tipos em `condicionantes.yaml`: `minimo`, `maximo`, `maximo_declarado` (FSAR-H), `rampa`, `texto` e `faixas`
(faixas de operação por nível com vazão máxima média semanal, como na Resolução ANA nº 132/2022 do Paranapanema).
Regra com `de:`/`ate:` sai do painel quando vence; `condicional: true` marca limite que a outorga prevê elevar por
termo aditivo (aviso informativo).

## Atualização automática

`atualiza.yml` roda por `workflow_dispatch` (disparo pontual do cron-job.org a cada hora), por `schedule` como rede de
segurança e manualmente, com opções de backfill e de escolha das bacias. GitHub Pages serve a pasta `docs/` do `main`.
