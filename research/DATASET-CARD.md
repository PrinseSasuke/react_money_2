# Карточка датасета — research/ids-ml (3 класса, перебалансированный)

Сгенерировано: 2026-10-02 · стенд k3s react-money · 119 прогонов, 12 сценариев (рандомизация интенсивности) · окно 30с/шаг 10с/выборка 10с

## dataset.csv — RF/MLP

- **Окон:** 4243 · **признаков:** 105 (21 серия × 5 агрегатов) · прогонов: 119
- **Классы:** norm=2232 (53%), attack=1063 (25%), fault=948 (22%)
- boundary=1: 593 · пропусков: 0

## windows.csv — Transformer

- строк: 76374 · окон: 4243 · 18 отсчётов × 21 метрика

## Окон по сценариям

| сценарий | класс | всего | целевого класса |
|---|---|---|---|
| 00-norm-baseline | norm | 340 | 340 |
| 01-norm-flashcrowd | norm | 352 | 352 |
| 10-fault-netdelay | fault | 442 | 282 |
| 11-fault-kill-backend | fault | 412 | 252 |
| 12-fault-cpu-stress | fault | 448 | 288 |
| 14-fault-authfail | fault | 280 | 126 |
| 20-attack-bruteforce | attack | 339 | 179 |
| 21-attack-flood | attack | 316 | 164 |
| 22-attack-sqli | attack | 321 | 177 |
| 23-attack-lowbrute | attack | 332 | 182 |
| 24-attack-pathscan | attack | 313 | 163 |
| 25-attack-lowflood | attack | 348 | 198 |

## Пары-двойники (похожи по общей метрике, различимы по другой; медиана max-агрегата)

| Сценарий | класс | rps | conns | 401/с | 4xx/с | 5xx/с | pg_tps |
|---|---|---|---|---|---|---|---|
| 01 flash-crowd | norm | 1300 | 1500 | 0 | 0 | 0 | 1300 |
| 21 флуд | attack | 2103 | 694 | 0 | 0 | 0 | 117 |
| 25 low-flood | attack | 412 | 150 | 0 | 0 | 0 | 107 |
| 14 authfail | fault | 400 | 100 | 300 | 300 | 0 | 112 |
| 20 brute | attack | 293 | 60 | 184 | 184 | 0 | 298 |
| 23 low-brute | attack | 95 | 70 | 10 | 10 | 0 | 102 |
| 24 pathscan | attack | 150 | 100 | 0 | 50 | 0 | 97 |
| 22 sqli | attack | 226 | 52 | 0 | 0 | 139 | 232 |
| 00 норма | norm | 80 | 50 | 0 | 0 | 0 | 87 |

**Пары:** flash-crowd↔флуд/low-flood (↑rps, но норма 2xx+pg-load vs атака); authfail↔brute/low-brute (↑401, но authfail без pg-load); pathscan — 404 (новая сигнатура); sqli — 5xx+pg. Стелс-варианты (low-brute/low-flood) ближе к норме — труднее.

## Ограничения

1. Класс «атака» — 25% (после ребаланса, было 11%).
2. Обобщение на НЕизвестные типы атак ограничено (см. ml/DIAGNOSTICS.md, leave-one-attack-out).
3. kill-backend слабо заметен (self-healing ~6с).
4. Двойник-сбой для SQLi (устойчивый 5xx) — отложен (отказ БД даёт 499, HTTPChaos не инжектится).