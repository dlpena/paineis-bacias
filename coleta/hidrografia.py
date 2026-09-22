# -*- coding: utf-8 -*-
"""Hidrografia para os mapas: rio principal e afluentes monitorados, da camada "Rios principais" do SNIRH/ANA.

  https://portal1.snirh.gov.br/arcgis/rest/services/SNIRH2016/Cursos_Agua_dominialidade/FeatureServer/0/query
  (camada "Curso d'Água": NORIOCOMP nome, DEDOMINIAL domínio, NUAREAMONT área a montante em km²)

Consulta por nome, recorta ao polígono da bacia (config/<bacia>/bacia.geojson) e grava
config/<bacia>/hidrografia.geojson (rodar uma vez por bacia; os mapas leem docs/<bacia>/data/hidrografia.geojson).
Uso: BACIA=<slug> py coleta/hidrografia.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import requests
from matplotlib.path import Path as MplPath

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comum import CONFIG, bacia, log  # noqa: E402
from geo import aneis  # noqa: E402

URL = "https://portal1.snirh.gov.br/arcgis/rest/services/SNIRH2016/Cursos_Agua_dominialidade/FeatureServer/0/query"
# nome exato na camada -> rótulo e classe (principal ou afluente monitorado), em config/<bacia>/bacia.yaml
# (chave "hidrografia"). Só afluentes com estação no painel.
RIOS = {k: tuple(v) for k, v in bacia()["hidrografia"].items()}
CITACAO = ('ANA/SNIRH, serviço "Rios principais" (SNIRH2016/Rios_principais, camada Curso d\'Água), '
           'https://portal1.snirh.gov.br/arcgis/rest/services/SNIRH2016/Cursos_Agua_dominialidade/FeatureServer')


def dentro_da_bacia(poligonos):
    def f(lon, lat):
        for ext, furos in poligonos:
            if MplPath(ext).contains_point((lon, lat)) and not any(MplPath(h).contains_point((lon, lat)) for h in furos):
                return True
        return False
    return f


def main() -> int:
    where = " OR ".join(f"NORIOCOMP = '{n}'" for n in RIOS)
    pol = list(aneis(CONFIG / "bacia.geojson"))
    # caixa da bacia como filtro espacial e paginação: sem isso, rios homônimos no país inteiro (Rio Verde,
    # Rio Pardo...) enchiam o limite de registros do serviço e afluentes da bacia saíam cortados
    xs = [x for ext, _ in pol for x, _y in ext]; ys = [y for ext, _ in pol for _x, y in ext]
    caixa = f"{min(xs)},{min(ys)},{max(xs)},{max(ys)}"
    gj = {"features": []}
    while True:
        # f=json (esri): no formato geojson o serviço devolve geometrias nulas
        r = requests.get(URL, params={"where": where, "outFields": "NORIOCOMP,NUAREAMONT,DEDOMINIAL", "returnGeometry": "true",
                                      "outSR": "4326", "geometry": caixa, "geometryType": "esriGeometryEnvelope", "inSR": "4326",
                                      "spatialRel": "esriSpatialRelIntersects", "resultOffset": len(gj["features"]), "f": "json"}, timeout=180)
        r.raise_for_status()
        pag = r.json()
        if "error" in pag:
            raise RuntimeError(pag["error"])
        gj["features"] += pag.get("features", [])
        if not pag.get("exceededTransferLimit"):
            break
    dentro = dentro_da_bacia(pol)
    saida = []
    for f in gj.get("features", []):
        g = f.get("geometry") or {}
        linhas = g.get("paths") or []
        f["properties"] = f.get("attributes", {})
        nome_ana = f["properties"]["NORIOCOMP"]
        rotulo, classe = RIOS[nome_ana]
        for ln in linhas:
            pts = np.asarray(ln, dtype=float)
            if not len(pts):
                continue
            # trecho fica se a maioria dos vértices está dentro da bacia (há rios homônimos fora dela)
            n_in = sum(dentro(x, y) for x, y in pts[:: max(1, len(pts) // 20)])
            if n_in < max(1, len(pts[:: max(1, len(pts) // 20)]) * 0.6):
                continue
            saida.append({"type": "Feature", "properties": {"nome": rotulo, "classe": classe, "nome_ana": nome_ana,
                                                             "dominio": f["properties"].get("DEDOMINIAL"), "area_montante_km2": f["properties"].get("NUAREAMONT")},
                          "geometry": {"type": "LineString", "coordinates": np.round(pts, 4).tolist()}})
    out = {"type": "FeatureCollection", "fonte": CITACAO, "features": saida}
    (CONFIG / "hidrografia.geojson").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    from collections import Counter
    log(f"{len(saida)} trechos gravados: {dict(Counter(f['properties']['nome'] for f in saida))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
