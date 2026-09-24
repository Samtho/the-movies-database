"""Modelo de gusto: P(verías esta película), entrenado con tu historial.

Regresión logística sobre variables legibles (género, época, duración, nota, votos,
idioma, afinidad con dirección y reparto que ya viste) más 24 componentes del texto
(sinopsis, géneros y keywords vía TF-IDF + SVD).
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler

from . import config

N_COMPONENTES_TEXTO = 24


def embeddings_texto(md: pd.DataFrame, componentes: int = 128, min_df: int = 3, max_features: int = 50_000) -> np.ndarray:
    """Vector de contenido por película (una fila por fila de md, mismo orden)."""
    texto = md.overview.fillna("") + " " + md.genres_l.str.join(" ") + " " + md.kw_l.str.join(" ") * 2
    tfidf = TfidfVectorizer(max_features=max_features, stop_words="english", min_df=min_df).fit_transform(texto)
    return TruncatedSVD(componentes, random_state=config.SEMILLA).fit_transform(tfidf)


Featurizador = Callable[[pd.DataFrame], pd.DataFrame]


def construir_features(md: pd.DataFrame, positiva: str, E: np.ndarray, excluir: Iterable[str] = ()) -> Featurizador:
    """Devuelve la función que calcula las variables de cualquier subconjunto de md.

    La afinidad con dirección y reparto se cuenta SOLO con las películas de la columna
    `positiva` (p. ej. las vistas antes del corte en el backtest), y a cada película
    positiva se le resta su propia aportación: una película no puede "explicarse" a sí misma.
    """
    positivas = md[md[positiva]]
    por_director = positivas.director.value_counts().to_dict()
    por_actor: dict[str, int] = {}
    for reparto in positivas.cast3:
        for a in reparto:
            por_actor[a] = por_actor.get(a, 0) + 1
    generos = sorted({g for lista in md.genres_l for g in lista})
    fila_de = {t: i for i, t in enumerate(md.tmdb.values)}
    excluir = tuple(excluir)

    def features(df: pd.DataFrame) -> pd.DataFrame:
        F = pd.DataFrame(index=df.index)
        for g in generos:
            F[f"g_{g}"] = df.genres_l.apply(lambda lista, g=g: int(g in lista))
        F["year"] = (df.year - 1950) / 80
        F["runtime"] = df.runtime.fillna(100).clip(50, 240) / 240
        F["vote_avg"] = df.vote_average.fillna(6) / 10
        F["log_votes"] = np.log1p(df.vote_count) / 10
        F["log_pop"] = np.log1p(df.popularity.fillna(0)) / 6
        F["lang_en"] = (df.original_language == "en").astype(int)
        F["lang_es"] = (df.original_language == "es").astype(int)
        propia = df[positiva].astype(int)
        dir_n = df.director.map(lambda d: por_director.get(d, 0)).fillna(0)
        F["aff_dir"] = np.log1p(np.maximum(0, dir_n - propia * (dir_n > 0)))
        rep_n = df.cast3.map(lambda reparto: sum(por_actor.get(a, 0) for a in reparto))
        F["aff_cast"] = np.log1p(np.maximum(0, rep_n - propia * df.cast3.map(len)))
        filas = [fila_de[t] for t in df.tmdb]
        for i in range(N_COMPONENTES_TEXTO):
            F[f"txt_{i}"] = E[filas, i]
        return F.drop(columns=list(excluir))

    return features


def nuevo_modelo() -> Pipeline:
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced"))


def entrenar(features: Featurizador, datos: pd.DataFrame, objetivo: str) -> Pipeline:
    modelo = nuevo_modelo()
    modelo.fit(features(datos).values, datos[objetivo].values.astype(int))
    return modelo


def auc_validacion_cruzada(features: Featurizador, datos: pd.DataFrame, objetivo: str, pliegues: int = 5) -> tuple[float, float]:
    """AUC media y desviación en validación cruzada estratificada (determinista)."""
    y = datos[objetivo].values.astype(int)
    pliegues = min(pliegues, int(y.sum()), int(len(y) - y.sum()))
    if pliegues < 2:
        raise ValueError("Hacen falta al menos 2 positivas y 2 negativas para validar el modelo")
    cv = StratifiedKFold(n_splits=pliegues, shuffle=True, random_state=config.SEMILLA)
    aucs = cross_val_score(nuevo_modelo(), features(datos).values, y, cv=cv, scoring="roc_auc")
    return float(aucs.mean()), float(aucs.std())


# ---------- porqués ----------
GENERO_ES = {
    "Drama": "drama", "Comedy": "comedia", "Action": "acción", "Thriller": "thriller", "Horror": "terror",
    "Romance": "romance", "Adventure": "aventura", "Crime": "crimen", "Science Fiction": "ciencia ficción",
    "Fantasy": "fantasía", "Animation": "animación", "Family": "familiar", "Documentary": "documental",
    "Mystery": "misterio", "War": "bélico", "History": "histórico", "Music": "musical", "Western": "western",
}
NOMBRE_VARIABLE = {
    "year": "su época", "runtime": "su duración", "vote_avg": "su nota", "log_votes": "muy conocida",
    "log_pop": "popularidad actual", "lang_en": "en inglés", "lang_es": "en español",
    "aff_dir": "director que ya has visto", "aff_cast": "reparto que conoces",
}
UMBRAL_PORQUE = 0.08
MAX_PORQUES = 3


def nombre_legible(variable: str) -> str | None:
    if variable.startswith("g_"):
        return "género " + GENERO_ES.get(variable[2:], variable[2:])
    return NOMBRE_VARIABLE.get(variable)


@dataclass
class Porques:
    leyenda: list[str]
    por_fila: list[list[int]]


def porques(modelo: Pipeline, F: pd.DataFrame) -> Porques:
    """Para cada película, hasta 3 variables legibles que más suben su score."""
    escala = modelo.named_steps["standardscaler"]
    lr = modelo.named_steps["logisticregression"]
    contrib = ((F.values - escala.mean_) / escala.scale_) * lr.coef_[0]
    columnas = list(F.columns)
    legibles = [i for i, c in enumerate(columnas) if not c.startswith("txt_")]
    leyenda: list[str] = []
    indice: dict[str, int] = {}
    por_fila: list[list[int]] = []
    for fila in contrib:
        razones: list[int] = []
        # orden: mayor contribución primero; empate, por nombre de variable (determinista)
        for _, c in sorted(((fila[i], columnas[i]) for i in legibles if fila[i] > UMBRAL_PORQUE), key=lambda x: (-x[0], x[1]))[:MAX_PORQUES]:
            nombre = nombre_legible(c)
            if not nombre:
                continue
            if nombre not in indice:
                indice[nombre] = len(leyenda)
                leyenda.append(nombre)
            razones.append(indice[nombre])
        por_fila.append(razones)
    return Porques(leyenda=leyenda, por_fila=por_fila)


def coeficientes_legibles(modelo: Pipeline, columnas: list[str], maximo: int = 22) -> list[dict[str, float]]:
    """Coeficientes de las variables legibles, de mayor a menor |peso|."""
    lr = modelo.named_steps["logisticregression"]
    etiquetas = {
        "year": "Año de estreno", "runtime": "Duración", "vote_avg": "Nota media TMDB",
        "log_votes": "Nº de votos (popularidad)", "log_pop": "Popularidad TMDB", "lang_en": "En inglés",
        "lang_es": "En español", "aff_dir": "Director que ya has visto", "aff_cast": "Reparto que ya has visto",
    }
    filas = []
    for c, w in zip(columnas, lr.coef_[0]):
        if c.startswith("txt_"):
            continue
        nombre = f"Género: {c[2:]}" if c.startswith("g_") else etiquetas.get(c, c)
        filas.append({"f": nombre, "w": round(float(w), 3)})
    return sorted(filas, key=lambda x: (-abs(x["w"]), x["f"]))[:maximo]
