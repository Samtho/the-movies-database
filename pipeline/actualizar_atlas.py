# Actualizador del atlas The Movies Database.
# Uso: python3 actualizar_atlas.py [ruta_export_trakt]
# Con cada nuevo export de Trakt: re-cruza, pide a TMDB solo lo nuevo (cache),
# reentrena el modelo de gusto, recalcula scores/porques/backtest, y si hay
# >=150 notas entrena la segunda etapa P(gustar|ver) y la mezcla en el score.
# Al terminar, copia los JSON a la web (falta build+push del dist).
import pandas as pd, numpy as np, pickle, json, glob, os, sys, time, warnings, urllib.request
from concurrent.futures import ThreadPoolExecutor
warnings.filterwarnings("ignore")
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

AQUI = os.path.dirname(os.path.abspath(__file__))
os.chdir(AQUI)
TRAKT = sys.argv[1] if len(sys.argv) > 1 else glob.glob("/Users/samuelortega/Desktop/TFM/The_Movies_TFM/trakt-export-*/")[0]
WEB = "/Users/samuelortega/Desktop/TFM/the-movies-database/public/data/"
KEY = open("tmdb_key.txt").read().strip()
CORTE_BT = "2015-01-01"

md = pickle.load(open("md_full.pkl", "rb")); md = md[md.year.notna()].copy()

# ---------- Trakt ----------
tr = []
for f in sorted(glob.glob(os.path.join(TRAKT, "watched-movies-*.json"))):
    tr += json.load(open(f))
fecha = {m["movie"]["ids"]["tmdb"]: m["last_watched_at"][:10] for m in tr}
plays = {m["movie"]["ids"]["tmdb"]: m["plays"] for m in tr}
md["visto"] = md.tmdb.isin(fecha)
md["fvista"] = md.tmdb.map(fecha)
ratings = json.load(open(os.path.join(TRAKT, "ratings-movies.json")))
notas = {r["movie"]["ids"].get("tmdb"): r["rating"] for r in ratings if r["movie"]["ids"].get("tmdb")}
json.dump({int(k): {"d": v, "n": plays.get(k, 1)} for k, v in fecha.items()}, open("out/vistas.json", "w"))
print("vistas:", len(fecha), "| en dataset:", int(md.visto.sum()), "| notas:", len(notas))

# ---------- TMDB: solo lo nuevo ----------
cache = json.load(open("poster_refresh.json"))
rec = json.load(open("tmdb_cache.json"))
en_dataset = set(md.tmdb)
faltan = [t for t in fecha if t not in en_dataset and str(t) not in rec]
def fetch_movie(tid, store):
    url = f"https://api.themoviedb.org/3/movie/{tid}?api_key={KEY}&append_to_response=credits"
    try:
        d = json.load(urllib.request.urlopen(url, timeout=12)); cr = d.get("credits", {})
        store[str(tid)] = {"t": d.get("original_title") or d.get("title"),
            "a": int((d.get("release_date") or "0000")[:4] or 0),
            "g": [g["name"] for g in d.get("genres", [])][:3], "rt": d.get("runtime"),
            "va": round(d.get("vote_average") or 0, 1), "nv": d.get("vote_count") or 0,
            "p": d.get("poster_path"), "o": (d.get("overview") or "")[:220],
            "d": next((c["name"] for c in cr.get("crew", []) if c.get("job") == "Director"), None),
            "dp": next((c.get("profile_path") for c in cr.get("crew", []) if c.get("job") == "Director"), None),
            "c": [c["name"] for c in cr.get("cast", [])[:3]],
            "cp": [c.get("profile_path") for c in cr.get("cast", [])[:3]]}
    except Exception: pass
for t in faltan: fetch_movie(t, rec); time.sleep(0.05)
json.dump(rec, open("tmdb_cache.json", "w"))
print("nuevas pedidas a TMDB:", len(faltan))

# ---------- embeddings ----------
md["texto"] = (md.overview.fillna("") + " " + md.genres_l.str.join(" ") + " " + md.kw_l.str.join(" ") * 2)
X_t = TfidfVectorizer(max_features=50000, stop_words="english", min_df=3).fit_transform(md.texto)
E = TruncatedSVD(128, random_state=42).fit_transform(X_t)
idx_of = {t: i for i, t in enumerate(md.tmdb.values)}

def make_feats(md_, ycol):
    pre = md_[md_[ycol]]
    dir_count = pre.director.value_counts().to_dict()
    act_count = {}
    for c in pre.cast3:
        for a in c: act_count[a] = act_count.get(a, 0) + 1
    GEN = sorted({g for l in md_.genres_l for g in l})
    def feats(df):
        F = pd.DataFrame(index=df.index)
        for g in GEN: F[f"g_{g}"] = df.genres_l.apply(lambda l: int(g in l))
        F["year"] = (df.year - 1950) / 80; F["runtime"] = df.runtime.fillna(100).clip(50, 240) / 240
        F["vote_avg"] = df.vote_average.fillna(6) / 10; F["log_votes"] = np.log1p(df.vote_count) / 10
        F["log_pop"] = np.log1p(df.popularity.fillna(0)) / 6
        F["lang_en"] = (df.original_language == "en").astype(int); F["lang_es"] = (df.original_language == "es").astype(int)
        ad = df.apply(lambda r: max(0, dir_count.get(r.director, 0) - (1 if r[ycol] else 0)) if dir_count.get(r.director, 0) else 0, axis=1)
        ac = df.apply(lambda r: max(0, (sum(act_count.get(a, 0) for a in r.cast3) - (3 if r[ycol] else 0))), axis=1)
        F["aff_dir"] = np.log1p(ad); F["aff_cast"] = np.log1p(ac)
        rows = [idx_of[t] for t in df.tmdb]
        for i in range(24): F[f"txt_{i}"] = E[rows, i]
        return F
    return feats

# ---------- modelo principal P(ver) ----------
feats = make_feats(md, "visto")
train = md[md.vote_count >= 100]
logit = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced"))
logit.fit(feats(train).values, train.visto.values.astype(int))
amp = md[(md.vote_count >= 30) & (~md.visto)]
Fam = feats(amp)
proba = logit.predict_proba(Fam.values)[:, 1]

# ---------- segunda etapa P(gustar|ver): se activa con >=150 notas ----------
mezcla = None
md["nota"] = md.tmdb.map(notas)
con_nota = md[md.nota.notna() & (md.vote_count >= 30)]
if len(con_nota) >= 150:
    like = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced"))
    like.fit(feats(con_nota).values, (con_nota.nota >= 7).values.astype(int))
    p_like = like.predict_proba(Fam.values)[:, 1]
    mezcla = 0.6 * proba + 0.4 * p_like
    print(f"segunda etapa ACTIVA con {len(con_nota)} notas: score = 0.6*P(ver) + 0.4*P(gustar|ver)")
else:
    print(f"segunda etapa pendiente: {len(con_nota)}/150 notas con ficha (puntúa en Trakt lo que veas)")
score = mezcla if mezcla is not None else proba

# ---------- porques ----------
sc = logit.named_steps["standardscaler"]; lr = logit.named_steps["logisticregression"]
Z = (Fam.values - sc.mean_) / sc.scale_; CONTRIB = Z * lr.coef_[0]
cols = list(Fam.columns)
ES = {"Drama": "drama", "Comedy": "comedia", "Action": "acción", "Thriller": "thriller", "Horror": "terror", "Romance": "romance", "Adventure": "aventura", "Crime": "crimen", "Science Fiction": "ciencia ficción", "Fantasy": "fantasía", "Animation": "animación", "Family": "familiar", "Documentary": "documental", "Mystery": "misterio", "War": "bélico", "History": "histórico", "Music": "musical", "Western": "western"}
def nombre(c):
    if c.startswith("g_"): return "género " + ES.get(c[2:], c[2:])
    return {"year": "su época", "runtime": "su duración", "vote_avg": "su nota", "log_votes": "muy conocida", "log_pop": "popularidad actual", "lang_en": "en inglés", "lang_es": "en español", "aff_dir": "director que ya has visto", "aff_cast": "reparto que conoces"}.get(c)
legibles = [i for i, c in enumerate(cols) if not c.startswith("txt_")]
LEG, leg_idx, razones = [], {}, []
for fila in CONTRIB:
    rr = []
    for _, c in sorted(((fila[i], cols[i]) for i in legibles if fila[i] > 0.08), reverse=True)[:3]:
        n = nombre(c)
        if not n: continue
        if n not in leg_idx: leg_idx[n] = len(LEG); LEG.append(n)
        rr.append(leg_idx[n])
    razones.append(rr)

# ---------- backtest temporal ----------
md["visto_pre"] = md.fvista.notna() & (md.fvista < CORTE_BT)
md["visto_post"] = md.fvista.notna() & (md.fvista >= CORTE_BT)
feats_bt = make_feats(md, "visto_pre")
tr_bt = md[(md.vote_count >= 100) & (~md.visto_post)]
lg_bt = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced"))
lg_bt.fit(feats_bt(tr_bt).values, tr_bt.visto_pre.values.astype(int))
cand_bt = md[(md.vote_count >= 30) & (~md.visto_pre)].copy()
cand_bt["s"] = lg_bt.predict_proba(feats_bt(cand_bt).values)[:, 1]
cand_bt = cand_bt.sort_values("s", ascending=False).reset_index(drop=True)
cand_bt["pct"] = (cand_bt.index + 1) / len(cand_bt) * 100
tst = cand_bt[cand_bt.visto_post]
bt = {"corte": CORTE_BT, "n_test": int(len(tst)), "n_cand": int(len(cand_bt)),
      "mediana_pct": round(float(tst.pct.median()), 1), "top10": round(float((tst.pct <= 10).mean() * 100)),
      "top20": round(float((tst.pct <= 20).mean() * 100)), "p100": int(cand_bt.head(100).visto_post.sum()),
      "p300": int(cand_bt.head(300).visto_post.sum()), "p500": int(cand_bt.head(500).visto_post.sum()),
      "azar100": round(len(tst) / len(cand_bt) * 100, 1)}

# ---------- gusto.json ----------
g = json.load(open("out/gusto.json"))
orden = np.argsort(-score); tm = amp.tmdb.values
g["candidatos"] = [{"id": int(tm[i]), "s": round(float(score[i]), 3), "r": razones[i]} for i in orden]
g["leyenda"] = LEG; g["backtest"] = bt
g["segunda_etapa"] = {"activa": mezcla is not None, "notas": int(len(con_nota)), "umbral": 150}
json.dump(g, open("out/gusto.json", "w"))

# ---------- stats (recalcular con historial nuevo) ----------
hist = []
for f in glob.glob(os.path.join(TRAKT, "watched-history-*.json")):
    hist += [h for h in json.load(open(f)) if h.get("type") == "movie"]
from collections import Counter
dt = pd.to_datetime([h["watched_at"] for h in hist])
mensual = Counter(f"{d.year}-{d.month:02d}" for d in dt)
finde = np.zeros((7, 24), dtype=int)
for d in dt: finde[d.weekday(), d.hour] += 1
dec = Counter((m["movie"].get("year") or 0) // 10 * 10 for m in tr)
rew = sorted([{"t": m["movie"]["title"], "a": m["movie"].get("year"), "n": m["plays"], "id": m["movie"]["ids"].get("tmdb")} for m in tr if m["plays"] > 1], key=lambda d: -d["n"])[:14]
vm = md[md.visto]
fotos_st = json.load(open("out/stats.json"))
foto_de = {d["n"]: d.get("p") for k in ("top_directores", "top_actores") for d in fotos_st[k]}
ust = json.load(open(os.path.join(TRAKT, "user-stats.json")))
stats = {"total_vistas": len(tr), "plays": ust["movies"]["plays"], "minutos": ust["movies"]["minutes"],
    "match_dataset": int(md.visto.sum()), "post2017": len(tr) - int(md.visto.sum()),
    "mensual": sorted(mensual.items()), "semana_hora": finde.tolist(),
    "decadas": sorted((k, v) for k, v in dec.items() if k > 0), "rewatch": rew,
    "top_directores": [{"n": k, "c": int(v), "p": foto_de.get(k)} for k, v in vm.director.value_counts().head(12).items()],
    "top_actores": [{"n": k, "c": v, "p": foto_de.get(k)} for k, v in Counter(a for c in vm.cast3 for a in c).most_common(12)],
    "top_generos": [{"n": k, "c": v} for k, v in Counter(g_ for l in vm.genres_l for g_ in l).most_common(12)],
    "ratings": [{"t": r["movie"]["title"], "r": r["rating"], "id": r["movie"]["ids"].get("tmdb")} for r in ratings]}
json.dump(stats, open("out/stats.json", "w"))

# ---------- copiar a la web ----------
for f in ("gusto.json", "vistas.json", "stats.json"):
    os.system(f"cp out/{f} {WEB}")
print("\nLISTO. Backtest:", bt)
print("Siguiente paso manual: cd the-movies-database && npm run build && (push del dist)")
