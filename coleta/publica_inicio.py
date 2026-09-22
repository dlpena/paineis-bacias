# -*- coding: utf-8 -*-
"""Página inicial (docs/index.html): mapa das bacias do SIN com as bacias de config/bacias.yaml clicáveis.
Uso: py coleta/publica_inicio.py (roda no fim do fluxo, depois de todas as bacias)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comum import RAIZ, bacias, log  # noqa: E402


def main() -> int:
    mapa = json.loads((RAIZ / "config" / "mapa_sin.json").read_text(encoding="utf-8"))
    lista = []
    for b in bacias():
        cfg = yaml.safe_load((RAIZ / "config" / b["slug"] / "bacia.yaml").read_text(encoding="utf-8"))
        lista.append({"slug": b["slug"], "sin_svg": b["sin_svg"], "nome": cfg["nome"], "resumo_inicial": cfg.get("resumo_inicial", "")})
    nomes = {x["bacia"] for x in mapa["bacias"]}
    faltam = [x["sin_svg"] for x in lista if x["sin_svg"] not in nomes]
    if faltam:
        raise ValueError(f"bacias sem contorno no mapa do SIN: {faltam}")
    s = (RAIZ / "paginas_raiz" / "index.html").read_text(encoding="utf-8")
    s = s.replace("{{FONTE_MAPA}}", mapa["fonte"])
    s = s.replace("{{MAPA_SIN}}", json.dumps({k: mapa[k] for k in ("w", "h", "brasil", "ufs", "bacias", "nomes")}, ensure_ascii=False, separators=(",", ":")))
    s = s.replace("{{BACIAS}}", json.dumps(lista, ensure_ascii=False))
    (RAIZ / "docs" / "index.html").write_text(s, encoding="utf-8")
    log(f"página inicial: {len(lista)} bacias ({', '.join(x['nome'] for x in lista)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
