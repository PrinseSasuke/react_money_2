# -*- coding: utf-8 -*-
"""Оформление результатов M4: RESULTS.md + графики (F1 vs объём, матрицы ошибок)."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
RES = HERE / "results"
PLOTS = HERE / "plots"; PLOTS.mkdir(exist_ok=True)

rfmlp = json.load(open(RES / "20260926-220406" / "metrics.json", encoding="utf-8"))
tf = json.load(open(RES / "20260926-223020" / "metrics.json", encoding="utf-8"))
imp = json.load(open(RES / "20260926-220406" / "rf_feature_importance.json", encoding="utf-8"))
M = {**rfmlp, **tf}
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
plt.ylim(0.90, 1.0); plt.grid(alpha=0.3); plt.legend()
plt.tight_layout(); plt.savefig(PLOTS / "f1_vs_size.png", dpi=130); plt.close()

# --- матрицы ошибок RF@100 и Transformer@100 ---
def conf_plot(key, title, fname):
    cm = np.array(M[key]["confusion_last"])
    fig, ax = plt.subplots(figsize=(4.2, 3.8))
    im = ax.imshow(cm, cmap="Blues")
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

# --- RESULTS.md ---
def row(mk, mn):
    r = lambda s: M[f"{mk}@{s}"]
    return (f"| {mn} | {r(50)['macro_f1_mean']:.3f}±{r(50)['macro_f1_std']:.3f} "
            f"| {r(75)['macro_f1_mean']:.3f}±{r(75)['macro_f1_std']:.3f} "
            f"| {r(100)['macro_f1_mean']:.3f}±{r(100)['macro_f1_std']:.3f} "
            f"| {r(100)['false_attack_rate_mean']:.3f} | {r(100)['attack_recall_mean']:.2f} |")

o = []; p = o.append
p("# Результаты M4 — сравнение детекторов норма/сбой/атака\n")
p("Датасет: 6030 окон, 105 признаков, 135 прогонов (9 сценариев × 15). Сплит **по прогонам** "
  "(27 прогонов в фиксированном тесте, 1060 окон), обучение на 50/75/100% пула прогонов, "
  "3 seed на конфигурацию. Пограничные окна исключены из train.\n")

p("## Сводная таблица (Macro-F1, ср.±std)\n")
p("| Модель | 50% | 75% | 100% | false-attack rate | attack-recall |")
p("|---|---|---|---|---|---|")
for mk, mn in MODELS:
    p(row(mk, mn))
p("")
p("![F1 vs объём](plots/f1_vs_size.png)\n")

p("## Ключевые выводы\n")
p("1. **Главная задача решена у всех моделей:** `false-attack rate = 0` и `attack-recall ≈ 1.0` — "
  "сбои никогда не принимаются за атаки, все атаки пойманы. Это ответ на вопрос статьи: на полном "
  "векторе признаков supervised-детектор различает то, что одиночный порог путает.")
p("2. **Transformer — лучший** (0.985 на 100%), обгоняет Random Forest (0.961) и MLP (0.954) на "
  "**всех** объёмах. Выигрыш — за счёт временной динамики окна.")
p("3. **Гипотеза уточнена:** ожидали преимущество RF на малых данных и «догоняющий» Transformer на "
  "100%. По факту Transformer лучше уже на 50% — последовательность даёт ему преимущество сразу.")
p("4. **Остаточная ошибка — только «норма ↔ сбой»**; класс «атака» отделяется практически идеально "
  "(см. матрицы ниже).\n")

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

p("## Важность признаков (Random Forest, топ-12)\n")
p("| Признак | Важность |")
p("|---|---|")
for name, val in imp[:12]:
    p(f"| `{name}` | {val:.4f} |")
p("\nЛидируют сетевой трафик (`net_rx/tx_bytes`), задержка (`lat_mean_s`), память, `pg_tps`, "
  "`rps_total` — метрики, отличающие атаки и профиль нагрузки.\n")

p("## Метрики и методология\n")
p("- **Macro-F1** — среднее F1 по трём классам (не завышается доминирующей нормой).")
p("- **false-attack rate** — доля окон «сбой», предсказанных «атака» (ключевая метрика новизны).")
p("- **attack-recall** — доля атак, распознанных как атака.")
p("- Сплит **по `run_id`** исключает утечку между train/test; тест фиксирован для всех моделей и размеров.")
p("- Воспроизведение: `python ml/train.py --models rf mlp transformer --seeds 3`.\n")

p("## Ограничения\n")
p("- Класс «атака» — меньшинство (~11%); компенсируется взвешиванием классов.")
p("- Разделение «атака vs сбой» на текущем наборе почти идеальное — атаки дают сильную сетевую "
  "сигнатуру; более скрытные атаки (low-rate) — направление дальнейшей работы.")
p("- Двойник-сбой для SQLi (устойчивый 5xx) и метрики detection latency — в дорожной карте.")

(HERE / "RESULTS.md").write_text("\n".join(o), encoding="utf-8")
print("RESULTS.md +", len(list(PLOTS.glob("*.png"))), "plots written")
