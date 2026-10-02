# -*- coding: utf-8 -*-
"""Оформление результатов M4: RESULTS.md + графики. Берёт последний прогон с 3 моделями."""
import glob
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
RES = HERE / "results"
PLOTS = HERE / "plots"; PLOTS.mkdir(exist_ok=True)

# последний прогон, где есть все три модели
latest = None
for d in sorted(glob.glob(str(RES / "*")), reverse=True):
    m = json.load(open(Path(d) / "metrics.json", encoding="utf-8"))
    if any(k.startswith("transformer@") for k in m) and any(k.startswith("rf@") for k in m):
        latest = Path(d); M = m; break
imp_path = latest / "rf_feature_importance.json"
imp = json.load(open(imp_path, encoding="utf-8")) if imp_path.exists() else []
print("источник:", latest)

SIZES = [50, 75, 100]
MODELS = [("rf", "Random Forest"), ("mlp", "MLP"), ("transformer", "Transformer")]
COL = {"rf": "#2563eb", "mlp": "#d97706", "transformer": "#059669"}

# --- график F1 vs объём ---
plt.figure(figsize=(7, 4.3))
for mk, mn in MODELS:
    ys = [M[f"{mk}@{s}"]["macro_f1_mean"] for s in SIZES]
    es = [M[f"{mk}@{s}"]["macro_f1_std"] for s in SIZES]
    plt.errorbar(SIZES, ys, yerr=es, marker="o", capsize=4, label=mn, color=COL[mk], lw=2)
plt.xticks(SIZES, [f"{s}%" for s in SIZES])
plt.xlabel("Объём обучающей выборки"); plt.ylabel("Macro-F1")
plt.title("Качество детекторов vs объём данных (3 seed, ср.±std)")
plt.ylim(0.78, 1.0); plt.grid(alpha=0.3); plt.legend()
plt.tight_layout(); plt.savefig(PLOTS / "f1_vs_size.png", dpi=130); plt.close()

def conf_plot(key, title, fname):
    cm = np.array(M[key]["confusion_last"])
    fig, ax = plt.subplots(figsize=(4.2, 3.8))
    ax.imshow(cm, cmap="Blues")
    labs = ["норма", "сбой", "атака"]
    ax.set_xticks(range(3)); ax.set_yticks(range(3))
    ax.set_xticklabels(labs); ax.set_yticklabels(labs)
    ax.set_xlabel("Предсказание"); ax.set_ylabel("Истина"); ax.set_title(title)
    for i in range(3):
        for j in range(3):
            ax.text(j, i, cm[i, j], ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() * 0.5 else "black", fontsize=11)
    plt.tight_layout(); plt.savefig(PLOTS / fname, dpi=130); plt.close()

conf_plot("rf@100", "Random Forest @100%", "confusion_rf100.png")
conf_plot("transformer@100", "Transformer @100%", "confusion_tf100.png")

def row(mk, mn):
    r = lambda s: M[f"{mk}@{s}"]
    return (f"| {mn} | {r(50)['macro_f1_mean']:.3f}±{r(50)['macro_f1_std']:.3f} "
            f"| {r(75)['macro_f1_mean']:.3f}±{r(75)['macro_f1_std']:.3f} "
            f"| {r(100)['macro_f1_mean']:.3f}±{r(100)['macro_f1_std']:.3f} "
            f"| {r(100)['false_attack_rate_mean']:.3f} | {r(100)['attack_recall_mean']:.2f} |")

o = []; p = o.append
p("# Результаты M4 — сравнение детекторов норма/сбой/атака\n")
p("Датасет (перебалансированный): **4243 окна, 105 признаков, 119 прогонов, 12 сценариев** "
  "(2 норма / 4 сбоя / 6 атак, включая стелс low-brute/low-flood и pathscan). "
  "Классы: норма 53% / сбой 22% / **атака 25%**. Сплит **по прогонам** (фикс. тест), "
  "обучение на 50/75/100% пула, 3 seed. Пограничные окна исключены из train.\n")

p("## Сводная таблица (Macro-F1, ср.±std)\n")
p("| Модель | 50% | 75% | 100% | false-attack rate | attack-recall |")
p("|---|---|---|---|---|---|")
for mk, mn in MODELS:
    p(row(mk, mn))
p("")
p("![F1 vs объём](plots/f1_vs_size.png)\n")

p("## Ключевые выводы\n")
p("1. **Главная задача решена:** у RF и Transformer на 100% `false-attack rate = 0` и "
  "`attack-recall ≈ 1.0` — известные сбои и атаки не путаются. Подтверждает тезис: на полном "
  "векторе признаков supervised различает то, что одиночный порог путает.")
p("2. **Random Forest — лучший и самый устойчивый** (0.958→0.967, std ~0.002), особенно на малых "
  "данных.")
p("3. **Transformer — data-hungry:** проседает на 50% (0.872) и догоняет RF к 100% (0.966). Это "
  "подтверждает исходную гипотезу «RF выигрывает на малом объёме, Transformer окупается на полном». "
  "(На прежнем, слишком лёгком датасете Transformer был лучшим везде — после ребаланса и добавления "
  "стелс-атак задача усложнилась, и картина стала ожидаемой.)")
p("4. **MLP — слабее и нестабильнее** (0.813→0.935, std ~0.038).")
p("5. **Остаточная ошибка — «норма ↔ сбой»**; класс «атака» (известных типов) отделяется почти "
  "идеально.\n")

p("## Граница применимости (диагностика)\n")
p("- **Утечки нет** (near-duplicate: median L2 0.558, <0.1 всего 1.7% окон) — метрики не от заучивания.")
p("- **Leave-one-attack-out:** на НЕвиданном типе атаки обобщение слабое — recall(attack) 0.06 "
  "(brute) … 0.55 (sqli), но pathscan 1.0. Модель учит сигнатуры конкретных типов, а не «атакность». "
  "→ для неизвестных атак нужен отдельный anomaly-слой (unsupervised).")
p("- **Абляция сетевых признаков:** macro-F1 0.967→0.961 — держится не только на «громком» трафике.")
p("- Подробности: [`DIAGNOSTICS.md`](DIAGNOSTICS.md).\n")

p("## Матрицы ошибок (100% данных)\n")
p("Строки — истинный класс, столбцы — предсказание.\n")
p("| Random Forest | Transformer |")
p("|---|---|")
p("| ![RF](plots/confusion_rf100.png) | ![TF](plots/confusion_tf100.png) |")
p("")
for mk, mn in [("rf", "Random Forest"), ("transformer", "Transformer")]:
    f = M[f"{mk}@100"]["f1_per_class_last"]
    p(f"- **{mn} @100%** F1 по классам: норма {f['norm']:.3f}, сбой {f['fault']:.3f}, "
      f"атака {f['attack']:.3f}")
p("")

if imp:
    p("## Важность признаков (Random Forest, топ-12)\n")
    p("| Признак | Важность |")
    p("|---|---|")
    for name, val in imp[:12]:
        p(f"| `{name}` | {val:.4f} |")
    p("")

p("## Методология\n")
p("- **Macro-F1** — среднее F1 по трём классам. **false-attack rate** — доля «сбой»→«атака». "
  "**attack-recall** — доля атак, распознанных как атака.")
p("- Сплит **по `run_id`** (без утечки окон), тест фиксирован для всех моделей и размеров.")
p("- Воспроизведение: `python ml/train.py --models rf mlp transformer --seeds 3`; "
  "диагностика: `python ml/diagnose.py`.\n")

p("## Ограничения\n")
p("- Обобщение на **неизвестные типы атак** ограничено (см. LOAO) — направление: anomaly-слой + шире покрытие.")
p("- Остаётся норма↔сбой на тонких/быстрых сбоях (kill-backend).")
p("- Двойник-сбой для SQLi (устойчивый 5xx) и detection latency — в дорожной карте.")

(HERE / "RESULTS.md").write_text("\n".join(o), encoding="utf-8")
print("RESULTS.md +", len(list(PLOTS.glob("*.png"))), "plots")
