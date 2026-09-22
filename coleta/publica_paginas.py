# -*- coding: utf-8 -*-
"""Publica as páginas de uma bacia: copia paginas/*.html para docs/<bacia>/ trocando os marcadores {{...}} pelos
textos de config/<bacia>/bacia.yaml e injetando window.BACIA antes do app.js.

As páginas são uma só para todas as bacias (paginas/); o que muda de bacia para bacia fica no bacia.yaml.
Roda no fim do monta_site.py (a cada hora) e pode rodar sozinho: BACIA=<slug> py coleta/publica_paginas.py
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comum import DOCS, RAIZ, bacia, log  # noqa: E402

PAGINAS = RAIZ / "paginas"


def publicar() -> int:
    b = bacia()
    f = b.get("fontes", {})
    js = {k: b.get(k) for k in ("slug", "nome", "rio", "centro", "zoom", "trecho_padrao", "destaque", "rodape_regras")}
    trocas = {
        "{{NOME}}": b["nome"],
        "{{RIO}}": b["rio"],
        "{{SLUG}}": b["slug"],
        "{{NOM_BACIA_ONS}}": b["nom_bacia_ons"],
        "{{TITULO_INICIO}}": html.escape(b["titulo_inicio"]),
        "{{APRESENTACAO}}": b["apresentacao"],
        "{{FONTE_USINAS}}": f.get("usinas", ""),
        "{{FONTE_POLIGONO}}": f.get("poligono", ""),
        "{{FONTE_LIMITES}}": f.get("limites", ""),
        "{{FONTE_ZEROS}}": f.get("zeros", ""),
    }
    DOCS.mkdir(parents=True, exist_ok=True)
    n = 0
    for p in sorted(PAGINAS.glob("*.html")):
        s = p.read_text(encoding="utf-8")
        for k, v in trocas.items():
            s = s.replace(k, v)
        # recursos compartilhados ficam na raiz de docs/
        s = s.replace('href="estilo.css"', 'href="../estilo.css"')
        s = s.replace('<script src="app.js"></script>',
                      f'<script>window.BACIA = {json.dumps(js, ensure_ascii=False)};</script>\n<script src="../app.js"></script>')
        sobra = re.findall(r"\{\{[A-Z_]+\}\}", s)
        if sobra:
            raise ValueError(f"{p.name}: marcadores sem valor {sorted(set(sobra))}")
        (DOCS / p.name).write_text(s, encoding="utf-8")
        n += 1
    log(f"{n} páginas publicadas em docs/{b['slug']}/")
    return n


if __name__ == "__main__":
    publicar()
